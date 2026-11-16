import type { PlaitBoard } from '@plait/core';

/**
 * 白板撤销历史的统一清空/查询工具。
 *
 * 背景：board.children 的整体替换（打开文件、切页签、启动恢复、受控回灌、
 * 旧数据迁移）不会经过 operation 流程，但 @plait 的撤销栈（board.history）
 * 里可能残留替换前的 operation 批次。撤销回放的是「逆操作 + 数组下标 path」，
 * 对新 children 施加旧下标会命中错误元素（图片/文件引用卡片被连坐删除）。
 * 因此凡是整体替换 children 的路径，都必须在替换后立即同步清空撤销栈。
 */

/** 清空指定白板的撤销与重做历史（原地 splice，不整体替换 history 对象） */
export const clearBoardHistory = (board: PlaitBoard): void => {
  board.history.undos.splice(0);
  board.history.redos.splice(0);
};

export type BoardHistoryStack = 'undo' | 'redo';

/** 指定方向的撤销栈是否为空：撤销按钮用 'undo'，重做按钮用 'redo' */
export const isBoardHistoryEmpty = (
  board: PlaitBoard,
  kind: BoardHistoryStack = 'undo'
): boolean => {
  const stack = kind === 'redo' ? board.history.redos : board.history.undos;
  return stack.length <= 0;
};
