import {
  addSelectedElement,
  clearSelectedElement,
  getViewportOrigination,
  idCreator,
  PlaitBoard,
  Point,
  Transforms,
} from '@plait/core';
import {
  Card,
  CardElement,
  CARD_GEOMETRY_SHAPE,
  CARD_GEOMETRY_TYPE,
  CARD_HEIGHT,
  CARD_TYPE,
  CARD_WIDTH,
  FileRefType,
} from './type';
import {
  getTauriFileState,
  isTauriFileDirty,
  saveToTauriFile,
  setCurrentTauriFile,
} from '../../data/tauri-file';

const getCenterPoint = (board: PlaitBoard): Point => {
  const containerRect = PlaitBoard.getBoardContainer(board).getBoundingClientRect();
  const zoom = board.viewport.zoom;
  const origination = getViewportOrigination(board);
  const centerX = (origination?.[0] ?? 0) + containerRect.width / 2 / zoom;
  const centerY = (origination?.[1] ?? 0) + containerRect.height / 2 / zoom;
  return [centerX, centerY];
};

export const createCardElement = (points: [Point, Point]): CardElement => {
  return {
    id: idCreator(),
    type: CARD_GEOMETRY_TYPE,
    shape: CARD_GEOMETRY_SHAPE,
    customType: CARD_TYPE,
    points,
    title: '',
    content: '',
  };
};

export const insertCard = (board: PlaitBoard, center?: Point) => {
  const origin = center ?? getCenterPoint(board);
  const points: [Point, Point] = [
    [origin[0] - CARD_WIDTH / 2, origin[1] - CARD_HEIGHT / 2],
    [origin[0] + CARD_WIDTH / 2, origin[1] + CARD_HEIGHT / 2],
  ];
  const card = createCardElement(points);
  Transforms.insertNode(board, card, [board.children.length]);
  // Mirror the native draw creation flow: cache the selection directly
  // instead of issuing a set_selection operation. The onChange handler of
  // that operation resolves element paths (findPath) before ListRender has
  // registered the freshly inserted node, which would throw "Unable to find
  // the path for Plait node".
  clearSelectedElement(board);
  addSelectedElement(board, card);
  return card;
};

export const setCardData = (
  board: PlaitBoard,
  element: CardElement,
  data: Partial<Pick<CardElement, 'title' | 'content' | 'image'>>
) => {
  const path = PlaitBoard.findPath(board, element);
  Transforms.setNode(board, data, path);
};

// ---------------------------------------------------------------------------
// 文件引用卡片
// ---------------------------------------------------------------------------

export const FILE_REF_CARD_WIDTH = 320;

export const FILE_REF_CARD_HEIGHT = 240;

/** 在画布指定点（卡片中心）插入一个引用 Markdown/表格文件的卡片 */
export const insertFileRefCard = (
  board: PlaitBoard,
  point: Point,
  filePath: string,
  fileType: FileRefType
) => {
  const points: [Point, Point] = [
    [point[0] - FILE_REF_CARD_WIDTH / 2, point[1] - FILE_REF_CARD_HEIGHT / 2],
    [point[0] + FILE_REF_CARD_WIDTH / 2, point[1] + FILE_REF_CARD_HEIGHT / 2],
  ];
  const card: CardElement = {
    ...createCardElement(points),
    filePath,
    fileType,
  };
  Transforms.insertNode(board, card, [board.children.length]);
  // 与 insertCard 相同：直接缓存选中避免 set_selection 时机问题
  clearSelectedElement(board);
  addSelectedElement(board, card);
  return card;
};

/** 双击文件引用卡片：进入对应文件的文档编辑器；当前白板有未保存修改时先保存。
 *  保存显式按白板身份（path + drawnix）进行，并用复合键判脏，
 *  避免同名文档页签的脏状态触发白板写盘 */
export const openFileRefCardEditor = (board: PlaitBoard, element: CardElement) => {
  const { filePath, fileType } = element;
  if (!filePath || !fileType) {
    return;
  }
  const open = () => setCurrentTauriFile(filePath, fileType);
  const state = getTauriFileState();
  if (
    state.currentFile &&
    state.fileType === 'drawnix' &&
    isTauriFileDirty(state.currentFile, 'drawnix')
  ) {
    saveToTauriFile(board, state.currentFile, 'drawnix')
      .then(open)
      .catch((error) => {
        console.error('Failed to save current drawnix file:', error);
      });
    return;
  }
  open();
};

/**
 * 文件被重命名/移动后同步白板中引用卡片的路径；
 * from/to 既可以是文件路径，也可以是分组（目录）路径（按前缀替换其下所有引用）
 */
export const syncFileRefCardPaths = (
  board: PlaitBoard,
  changes: { from: string; to: string }[]
) => {
  if (!changes.length) {
    return;
  }
  board.children.forEach((child) => {
    if (!Card.isFileRefCard(child)) {
      return;
    }
    const element = child as CardElement;
    let nextPath: string | null = null;
    for (const { from, to } of changes) {
      if (element.filePath === from) {
        nextPath = to;
        break;
      }
      if (from && element.filePath!.startsWith(`${from}/`)) {
        nextPath = `${to}/${element.filePath!.slice(from.length + 1)}`;
        break;
      }
    }
    if (nextPath && nextPath !== element.filePath) {
      const path = PlaitBoard.findPath(board, element);
      Transforms.setNode(board, { filePath: nextPath }, path);
    }
  });
};
