import { BoardTransforms, getSelectedElements, PlaitBoard, PlaitPointerType } from '@plait/core';
import { isHotkey } from 'is-hotkey';
import { addImage, canCopySelectionAs, copySelectionAsSvg, saveAsSvg } from '../utils/image';
import { saveAsJSON, saveJSON } from '../data/json';
import { isTauriEnvironment } from '../data/tauri-file';
import {
  DrawnixBoard,
  DrawnixFreehandPointer,
  DrawnixPointerType,
  DrawnixState,
  DrawnixToolState,
} from '../hooks/use-drawnix';
import { BoardCreationMode, setCreationMode } from '@plait/common';
import { MindPointerType } from '@plait/mind';
import { FreehandShape } from './freehand/type';
import { ArrowLineShape, BasicShapes } from '@plait/draw';

/**
 * 文档编辑器（.table/.markdown 覆盖层）是否打开：与 react-board 的 board-clipboard
 * 同判定（未从包导出，避免跨包依赖），文档打开时白板的副作用快捷键全部让路
 */
const isDocEditorOpen = (): boolean => !!document.querySelector('.doc-editor');

/**
 * 可编辑元素判定（G5）：contentEditable 元素自身或编辑宿主的后代、
 * input/textarea。卡片内容编辑时事件 target 常是编辑宿主的子元素
 * （真实浏览器里其 isContentEditable 为 true）；部分环境（jsdom 测试）
 * 未实现该 getter，用 closest 按 contenteditable 属性兜底，两侧一致
 */
const isEditableElement = (element: HTMLElement): boolean =>
  element.isContentEditable ||
  !!element.closest('[contenteditable="true"], [contenteditable=""]') ||
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement;

/**
 * 撤销/重做是否应交给编辑器自身（G5）：焦点位于卡片内容 contentEditable、
 * input/textarea 等可编辑区域，或文档编辑器覆盖层打开时，Ctrl+Z /
 * Ctrl+Shift+Z 属于编辑器历史（contenteditable 原生撤销 / 文档历史栈），
 * 白板不消费、不 preventDefault，保持浏览器默认行为。
 * 与上方 globalKeyDown 的文档域守卫（isTypingNormal / isDocEditorOpen）同思路；
 * use-plugin-event 已在文档编辑器打开时拦截 board.keyDown，这里补上
 * 卡片 contentEditable 场景与纵深防御；工具栏按钮用 activeElement 做
 * 同域判定（见 app-toolbar 的 isEditorFocused）。
 */
export const shouldLetEditorUndoRedo = (event: KeyboardEvent): boolean => {
  if (isDocEditorOpen()) {
    return true;
  }
  const target = event.target;
  return target instanceof HTMLElement && isEditableElement(target);
};

export const buildDrawnixHotkeyPlugin = (
  updateAppState: (appState: Partial<DrawnixState>) => void
) => {
  const withDrawnixHotkey = (board: PlaitBoard) => {
    const { globalKeyDown, keyDown } = board;
    const updatePointer = (
      pointer: DrawnixPointerType,
      nextToolState: Partial<DrawnixToolState> = {}
    ) => {
      updateAppState({
        toolState: {
          ...(board as DrawnixBoard).appState.toolState,
          pointer,
          ...nextToolState,
        },
      });
    };
    board.globalKeyDown = (event: KeyboardEvent) => {
      const isTypingNormal =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      // 文档编辑器打开时白板的副作用快捷键全部让路（键盘守卫）：Ctrl+S 保存由
      // 页签栏的 saveCurrentFile 统一处理，mod+shift+s/e、mod+u 与单键工具切换
      // 属于文档编辑域；表格单元格是 <td> 不满足 isTypingNormal，不守卫会在
      // 编辑表格时同时触发白板快捷键（Ctrl+S 错写事故的触发链之一）。
      // 原始链路仍无条件回灌，不干扰白板内部状态机
      if (!isTypingNormal && isDocEditorOpen()) {
        globalKeyDown(event);
        return;
      }
      if (
        !isTypingNormal &&
        (PlaitBoard.getMovingPointInBoard(board) || PlaitBoard.isMovingPointInBoard(board)) &&
        !PlaitBoard.hasBeenTextEditing(board)
      ) {
        if (isHotkey(['mod+shift+e'], { byKey: true })(event)) {
          saveAsSvg(board);
          event.preventDefault();
          return;
        }
        if (isHotkey(['mod+shift+s'], { byKey: true })(event)) {
          saveAsJSON(board).then(({ fileHandle }) => {
            updateAppState({ fileHandle });
          });
          event.preventDefault();
          return;
        }
        if (isHotkey(['mod+s'], { byKey: true })(event)) {
          // Tauri 端保存统一走页签栏 saveCurrentFile（按 fileType 分派），这里不再
          // 直连 saveToTauriFile——一次按键两套保存曾把表格路径写成白板文件；
          // 仅 preventDefault 吞掉默认行为。web 端无页签栏，保留 saveJSON 原路径
          if (!isTauriEnvironment()) {
            saveJSON(board, (board as DrawnixBoard).appState.fileHandle).then(({ fileHandle }) => {
              updateAppState({ fileHandle });
            });
          }
          event.preventDefault();
          return;
        }
        if (isHotkey(['mod+backspace'])(event) || isHotkey(['mod+delete'])(event)) {
          updateAppState({
            openCleanConfirm: true,
          });
          event.preventDefault();
          return;
        }
        if (isHotkey(['mod+u'])(event)) {
          addImage(board);
          event.preventDefault();
          return;
        }
        if (!event.altKey && !event.metaKey && !event.ctrlKey) {
          if (event.key === 'h') {
            BoardTransforms.updatePointerType(board, PlaitPointerType.hand);
            updatePointer(PlaitPointerType.hand);
            event.preventDefault();
            return;
          }
          if (event.key === 'v') {
            BoardTransforms.updatePointerType(board, PlaitPointerType.selection);
            updatePointer(PlaitPointerType.selection);
            event.preventDefault();
            return;
          }
          if (event.key === 'm') {
            setCreationMode(board, BoardCreationMode.dnd);
            BoardTransforms.updatePointerType(board, MindPointerType.mind);
            updatePointer(MindPointerType.mind);
            event.preventDefault();
            return;
          }
          if (event.key === 'e') {
            setCreationMode(board, BoardCreationMode.drawing);
            BoardTransforms.updatePointerType(board, FreehandShape.eraser);
            updatePointer(FreehandShape.eraser, {
              lastFreehandPointer: FreehandShape.eraser as DrawnixFreehandPointer,
            });
            event.preventDefault();
            return;
          }
          if (event.key === 'p') {
            setCreationMode(board, BoardCreationMode.drawing);
            BoardTransforms.updatePointerType(board, FreehandShape.feltTipPen);
            updatePointer(FreehandShape.feltTipPen, {
              lastFreehandPointer: FreehandShape.feltTipPen as DrawnixFreehandPointer,
            });
            event.preventDefault();
            return;
          }
          if (event.key === 'a' && !isHotkey(['mod+a'])(event)) {
            // will trigger editing text
            if (getSelectedElements(board).length === 0) {
              setCreationMode(board, BoardCreationMode.drawing);
              BoardTransforms.updatePointerType(board, ArrowLineShape.straight);
              updatePointer(ArrowLineShape.straight, {
                lastArrowPointer: ArrowLineShape.straight,
              });
              event.preventDefault();
              return;
            }
          }
          if (event.key === 'r' || event.key === 'o' || event.key === 't') {
            const keyToPointer = {
              r: BasicShapes.rectangle,
              o: BasicShapes.ellipse,
              t: BasicShapes.text,
            };
            if (keyToPointer[event.key] === BasicShapes.text) {
              setCreationMode(board, BoardCreationMode.dnd);
            } else {
              setCreationMode(board, BoardCreationMode.drawing);
            }
            BoardTransforms.updatePointerType(board, keyToPointer[event.key]);
            if (keyToPointer[event.key] === BasicShapes.text) {
              updatePointer(keyToPointer[event.key]);
            } else {
              updatePointer(keyToPointer[event.key], {
                lastShapePointer: keyToPointer[event.key],
              });
            }
            event.preventDefault();
            return;
          }
        }
        if (isHotkey('shift+alt+c')(event)) {
          const canCopySvg = canCopySelectionAs('svg');
          if (canCopySvg) {
            copySelectionAsSvg(board).catch(() => undefined);
            event.preventDefault();
          }

          return;
        }
      }
      globalKeyDown(event);
    };

    board.keyDown = (event: KeyboardEvent) => {
      if (isHotkey(['mod+z'], { byKey: true })(event)) {
        // 焦点在可编辑区域（卡片内容/输入框）或文档编辑器打开时让路（G5）：
        // 不 preventDefault，contenteditable 的原生撤销继续生效
        if (!shouldLetEditorUndoRedo(event)) {
          board.undo();
          event.preventDefault();
        }
        return;
      }

      if (isHotkey(['mod+shift+z'], { byKey: true })(event)) {
        if (!shouldLetEditorUndoRedo(event)) {
          board.redo();
          event.preventDefault();
        }
        return;
      }

      keyDown(event);
    };

    return board;
  };
  return withDrawnixHotkey;
};
