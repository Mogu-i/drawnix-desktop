import {
  getSelectedElements,
  PlaitBoard,
  PlaitElement,
  PlaitPluginElementContext,
  RectangleClient,
  Selection,
  toHostPoint,
  toViewBoxPoint,
} from '@plait/core';
import { getTextManages, isDelete, isSpaceHotkey, isVirtualKey } from '@plait/common';
import { isGeometryIncludeText, PlaitDrawElement } from '@plait/draw';
import { CardComponent } from './card.component';
import { Card, CARD_GEOMETRY_SHAPE, CARD_GEOMETRY_TYPE, CARD_TYPE } from './type';
import { insertFileRefCard, openFileRefCardEditor } from './transforms';

// tolerance for clicking a card border, in board units
const CARD_HIT_TOLERANCE = 4;

/** 文件引用卡片支持的拖入文件扩展名 */
const FILE_REF_EXTS = ['md', 'table'];

/** 文件面板拖拽项的数据结构（写入 text/plain） */
type PanelDragItem = { type: 'file' | 'folder'; id: string; ext?: string };

/** 从拖放事件中解析可生成引用卡片的文件面板拖拽项 */
const readDroppedFileRef = (
  event: DragEvent
): { path: string; fileType: 'md' | 'table' } | null => {
  try {
    const raw = event.dataTransfer?.getData('text/plain');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PanelDragItem;
    if (
      parsed &&
      parsed.type === 'file' &&
      typeof parsed.id === 'string' &&
      parsed.ext &&
      FILE_REF_EXTS.includes(parsed.ext)
    ) {
      return { path: parsed.id, fileType: parsed.ext as 'md' | 'table' };
    }
  } catch {
    // 非文件面板的拖拽数据，忽略
  }
  return null;
};

// element types saved by card plugin versions before cards became geometry
// elements; they cannot be resolved by the plugin chain and must be migrated
const LEGACY_CARD_TYPE = 'card';
const LEGACY_CARD_LINK_TYPE = 'card-link';

// Normalize legacy board data: old card elements are upgraded in place to
// the geometry-based shape, old card-link elements (the removed custom link
// system) are dropped. Returns the same array unless legacy links were
// removed, so callers can memoize on a stable reference. Runs outside the
// history stack.
export const migrateLegacyBoardData = (
  children: PlaitElement[]
): PlaitElement[] => {
  let hasLegacyLink = false;
  children.forEach((child) => {
    const element = child as { type?: string } | undefined;
    if (!element || typeof element !== 'object') {
      return;
    }
    if (element.type === LEGACY_CARD_LINK_TYPE) {
      hasLegacyLink = true;
    } else if (element.type === LEGACY_CARD_TYPE) {
      element.type = CARD_GEOMETRY_TYPE;
      (element as Record<string, unknown>).shape = CARD_GEOMETRY_SHAPE;
      (element as Record<string, unknown>).customType = CARD_TYPE;
    }
  });
  if (!hasLegacyLink) {
    return children;
  }
  return children.filter(
    (child) => (child as { type?: string }).type !== LEGACY_CARD_LINK_TYPE
  );
};

export const withCard = (board: PlaitBoard) => {
  const { drawElement, isHit, isRectangleHit, keyDown, dblClick, drop } = board;

  board.children = migrateLegacyBoardData(board.children);

  board.drawElement = (context: PlaitPluginElementContext) => {
    if (Card.isCard(context.element)) {
      return CardComponent;
    }
    return drawElement(context);
  };

  // The card has no slate `text` field, while @plait/draw assumes every
  // geometry carries one: its hit-testing goes through the text manage
  // (isEmptyTextElement / isHitElementText) and crashes on cards. Keep the
  // card hits purely rectangle-based instead of entering that path.
  board.isHit = (element, point, isStrict?: boolean) => {
    if (Card.isCard(element)) {
      const rectangle = RectangleClient.inflate(
        RectangleClient.getRectangleByPoints(element.points),
        CARD_HIT_TOLERANCE
      );
      return RectangleClient.isPointInRectangle(rectangle, point);
    }
    // Draw's hit-testing for text-bearing geometries goes through the slate
    // TextManage, but a geometry component registers as mounted before its
    // TextManage is created in componentDidMount. In that window (e.g. the
    // first frames after a page refresh while persisted data loads) that
    // path warns "can not find textManage" and throws. Treat elements whose
    // TextManage is not ready yet as unhit for those frames.
    if (
      PlaitDrawElement.isGeometry(element) &&
      isGeometryIncludeText(element) &&
      !getTextManages(element).length
    ) {
      return false;
    }
    return isHit(element, point, isStrict);
  };

  board.isRectangleHit = (element: PlaitElement, selection: Selection) => {
    if (Card.isCard(element)) {
      const rect = RectangleClient.getRectangleByPoints(element.points);
      const selRect = RectangleClient.getRectangleByPoints([
        selection.anchor,
        selection.focus,
      ]);
      return !(
        selRect.x > rect.x + rect.width ||
        selRect.x + selRect.width < rect.x ||
        selRect.y > rect.y + rect.height ||
        selRect.y + selRect.height < rect.y
      );
    }
    return isRectangleHit(element, selection);
  };

  // The card is a native geometry element so arrows can bind to it, but it
  // edits text through its own contentEditable instead of the slate editor
  // used by @plait/draw. withDrawHotkey opens the slate editor for a single
  // selected geometry on any non-virtual key (including Enter) and on double
  // click, so both entries must be intercepted here.
  board.keyDown = (event: KeyboardEvent) => {
    const selectedElements = getSelectedElements(board);
    if (selectedElements.length === 1 && Card.isCard(selectedElements[0])) {
      const target = event.target as HTMLElement | null;
      // typing inside the card's own contentEditable must not be hijacked
      if (target && target.isContentEditable) {
        return;
      }
      // let deletion, virtual keys and space (canvas panning) fall through;
      // block everything else that withDrawHotkey would turn into editing
      if (!isDelete(event) && !isVirtualKey(event) && !isSpaceHotkey(event)) {
        event.preventDefault();
        return;
      }
    }
    keyDown(event);
  };

  // 从文件面板拖拽 Markdown/表格文件到画布：在鼠标松开位置生成文件引用卡片。
  // 插件链中该处理位于 with-image 之后：外部图片文件先由 with-image 处理，
  // 无图片文件时回落到这里，再继续向内层插件（with-draw 等）传递
  board.drop = (event: DragEvent) => {
    const fileRef = readDroppedFileRef(event);
    if (fileRef) {
      const point = toViewBoxPoint(board, toHostPoint(board, event.x, event.y));
      insertFileRefCard(board, point, fileRef.path, fileRef.fileType);
      return true;
    }
    return drop(event);
  };

  board.dblClick = (event: MouseEvent) => {
    const point = toViewBoxPoint(board, toHostPoint(board, event.x, event.y));
    const hitCard = board.children.find(
      (element) => Card.isCard(element) && board.isHit(element, point)
    );
    if (hitCard) {
      if (Card.isFileRefCard(hitCard)) {
        // 双击文件引用卡片：进入对应文件的文档编辑器
        openFileRefCardEditor(board, hitCard);
      }
      // let the card's own contentEditable handle text editing
      return;
    }
    dblClick(event);
  };

  return board;
};
