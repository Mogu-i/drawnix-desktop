import { isMainPointer, PlaitBoard } from '@plait/core';

// 拖拽期间加到白板容器上的类名，配合 react-board 样式中的
// user-select: none 规则禁止原生文本选中
export const TEXT_SELECTION_SUPPRESSED_CLASS_NAME = 'text-selection-suppressed';

// pointerdown 落在文本编辑区（contentEditable / 输入框）上时不禁止文本选中，
// 保证卡片标题/正文、slate 文本编辑器内的光标定位与拖选照常工作。
// 卡片内容区在 pointerdown 时已阻止冒泡，正常不会走到这里，此处兜底覆盖
// 其他 contentEditable 元素（如编辑中的形状/思维导图文本）。
const isTextEditableTarget = (target: EventTarget | null): boolean => {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      !!target.closest('input, textarea, [contenteditable="true"]'))
  );
};

/**
 * 白板拖拽期间禁止浏览器原生文本选中：
 * 按住左键拖动元素/框选/缩放时，鼠标划过卡片（foreignObject 中的 HTML 内容）
 * 会触发浏览器的文本选区（蓝色高亮），拖拽结束后选区残留。
 * 这里在 pointerdown 时给白板容器加上 user-select: none，pointerup/pointercancel
 * 时移除，从源头阻止选区产生；单选拖动、多选框选、缩放等所有按下拖拽场景均覆盖。
 */
export const withTextSelection = (board: PlaitBoard) => {
  const { pointerDown, globalPointerUp, pointerCancel } = board;

  const suppress = (event: PointerEvent) => {
    if (isMainPointer(event) && !isTextEditableTarget(event.target)) {
      PlaitBoard.getBoardContainer(board).classList.add(
        TEXT_SELECTION_SUPPRESSED_CLASS_NAME
      );
      // 清掉拖拽前遗留的选区（例如刚在卡片内选中的文本），保证拖拽结束不留选区
      window.getSelection()?.removeAllRanges();
    }
  };

  const restore = () => {
    PlaitBoard.getBoardContainer(board).classList.remove(
      TEXT_SELECTION_SUPPRESSED_CLASS_NAME
    );
  };

  board.pointerDown = (event) => {
    suppress(event);
    pointerDown(event);
  };

  board.globalPointerUp = (event) => {
    restore();
    globalPointerUp(event);
  };

  board.pointerCancel = (event) => {
    restore();
    pointerCancel(event);
  };

  return board;
};
