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
        board.undo();
        event.preventDefault();
        return;
      }

      if (isHotkey(['mod+shift+z'], { byKey: true })(event)) {
        board.redo();
        event.preventDefault();
        return;
      }

      keyDown(event);
    };

    return board;
  };
  return withDrawnixHotkey;
};
