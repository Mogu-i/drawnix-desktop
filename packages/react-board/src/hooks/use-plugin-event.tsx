import {
  BOARD_TO_MOVING_POINT,
  BOARD_TO_MOVING_POINT_IN_BOARD,
  PlaitBoard,
  WritableClipboardOperationType,
  deleteFragment,
  getClipboardData,
  hasInputOrTextareaTarget,
  setFragment,
  toHostPoint,
  toViewBoxPoint,
} from '@plait/core';
import { useEventListener } from 'ahooks';

const useBoardPluginEvent = (
  board: PlaitBoard,
  viewportContainerRef: React.RefObject<HTMLDivElement>,
  hostRef: React.RefObject<SVGSVGElement>
) => {
  useEventListener(
    'pointerdown',
    (event) => {
      board.pointerDown(event);
    },
    { target: hostRef }
  );

  useEventListener(
    'pointermove',
    (event) => {
      BOARD_TO_MOVING_POINT_IN_BOARD.set(board, [event.x, event.y]);
      board.pointerMove(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'pointerleave',
    (event) => {
      BOARD_TO_MOVING_POINT_IN_BOARD.delete(board);
      board.pointerLeave(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'pointerup',
    (event) => {
      board.pointerUp(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'touchstart',
    (event) => {
      board.touchStart(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'touchmove',
    (event) => {
      board.touchMove(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'touchend',
    (event) => {
      board.touchEnd(event);
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'dblclick',
    (event) => {
      if (PlaitBoard.isFocus(board) && !PlaitBoard.hasBeenTextEditing(board)) {
        board.dblClick(event);
      }
    },
    { target: hostRef }
  );

  useEventListener('pointermove', (event) => {
    BOARD_TO_MOVING_POINT.set(board, [event.x, event.y]);
    board.globalPointerMove(event);
  });

  useEventListener('pointerup', (event) => {
    board.globalPointerUp(event);
  });

  useEventListener('keydown', (event) => {
    board.globalKeyDown(event);
    if (
      PlaitBoard.isFocus(board) &&
      !PlaitBoard.hasBeenTextEditing(board) &&
      !hasInputOrTextareaTarget(event.target)
    ) {
      board.keyDown(event);
    }
  });

  useEventListener('keyup', (event) => {
    // keyUp 必须无条件回灌给 board.keyUp，不能像 keyDown 那样受 isFocus 限制：
    // 空格拖拽平移由 withHandPointer.keyDown 进入临时 hand 模式，
    // 而只有对应的 keyUp 会复位 isShortcutKeyPressed 并清理 BOARD_TO_TEMPORARY_POINTER。
    // 拖拽过程中画布 selection 可能被清空（例如在画板外松开鼠标触发 globalPointerUp
    // 清除选区），此时 isFocus 为 false，若沿用 keyDown 的门控，松开的空格 keyUp 将无法
    // 送达，临时 hand 模式永远残留，导致之后每一次左键 pointerUp 被 withHandPointer 吞掉，
    // 表现为“松开空格后左键点击画板工具/元素无响应”。
    // 仅保留对画板内 slate 文本编辑的保护，避免干扰编辑区内空格的正常输入。
    if (!PlaitBoard.hasBeenTextEditing(board)) {
      board?.keyUp(event);
    }
  });

  useEventListener('copy', (event) => {
    if (PlaitBoard.isFocus(board) && !PlaitBoard.hasBeenTextEditing(board)) {
      event.preventDefault();
      setFragment(board, WritableClipboardOperationType.copy, event.clipboardData);
    }
  });

  useEventListener('paste', async (clipboardEvent) => {
    if (
      PlaitBoard.isFocus(board) &&
      !PlaitBoard.isReadonly(board) &&
      !PlaitBoard.hasBeenTextEditing(board)
    ) {
      const mousePoint = PlaitBoard.getMovingPointInBoard(board);
      if (mousePoint) {
        const targetPoint = toViewBoxPoint(board, toHostPoint(board, mousePoint[0], mousePoint[1]));
        const clipboardData = await getClipboardData(clipboardEvent.clipboardData);
        board.insertFragment(clipboardData, targetPoint, WritableClipboardOperationType.paste);
      }
    }
  });

  useEventListener('cut', (event) => {
    if (
      PlaitBoard.isFocus(board) &&
      !PlaitBoard.isReadonly(board) &&
      !PlaitBoard.hasBeenTextEditing(board)
    ) {
      event.preventDefault();
      setFragment(board, WritableClipboardOperationType.cut, event.clipboardData);
      deleteFragment(board);
    }
  });

  useEventListener(
    'drop',
    (event) => {
      if (!PlaitBoard.isReadonly(board)) {
        event.preventDefault();
        board.drop(event);
      }
    },
    { target: viewportContainerRef }
  );

  useEventListener(
    'dragover',
    (event) => {
      event.preventDefault();
    },
    { target: viewportContainerRef }
  );
};

export default useBoardPluginEvent;
