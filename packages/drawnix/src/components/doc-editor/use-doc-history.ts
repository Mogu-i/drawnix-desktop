import { useCallback, useRef, useState } from 'react';

/**
 * 文档编辑器（Markdown/表格）共用的撤销/重做历史栈：
 * - 修改前调用 pushHistory 保存旧快照；撤销/重做时由调用方提供应用函数，
 *   应用函数直接写入状态，不得再次入栈（否则恢复动作会被记进历史）；
 * - coalesce 选项用于把连续键入合并为一个撤销单元（默认 600ms 时间窗），
 *   程序化修改（工具栏动作、快捷键插入等）不带该选项，各自独立成单元；
 * - 新修改会使重做链失效；栈容量有限，超限丢弃最早快照
 */
export const useDocHistory = <T,>(options?: { limit?: number; mergeWindow?: number }) => {
  const limit = options?.limit ?? 100;
  const mergeWindow = options?.mergeWindow ?? 600;
  // 栈本体存 ref：快照可能较大（表格结构化拷贝），避免每步入栈触发整栈拷贝
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);
  const lastPushAt = useRef(0);
  // 栈变化时递增触发重渲染（值本身无人读取，渲染期直接读 ref）；
  // 这是“外部可变库 + 强制重渲染”的刻意用法
  const [, setVersion] = useState(0);

  /** 修改前保存旧快照；coalesce=true 且距上次保存不足一个时间窗时并入上一单元 */
  const pushHistory = useCallback(
    (snapshot: T, opts?: { coalesce?: boolean }) => {
      const now = Date.now();
      const merged =
        opts?.coalesce && now - lastPushAt.current < mergeWindow && undoStack.current.length > 0;
      if (!merged) {
        undoStack.current.push(snapshot);
        if (undoStack.current.length > limit) {
          undoStack.current.shift();
        }
      }
      lastPushAt.current = now;
      redoStack.current = [];
      setVersion((v) => v + 1);
    },
    [limit, mergeWindow]
  );

  /** 撤销：current 为当前值，恢复到上一快照；返回是否有可撤销内容 */
  const undo = useCallback((current: T, apply: (prev: T) => void): boolean => {
    const prev = undoStack.current.pop();
    if (prev === undefined) {
      return false;
    }
    redoStack.current.push(current);
    // 断开键入合并窗口：撤销后的下一次键入应另起单元，而非并入更早的历史
    lastPushAt.current = 0;
    apply(prev);
    setVersion((v) => v + 1);
    return true;
  }, []);

  /** 重做：恢复最近一次被撤销的值 */
  const redo = useCallback((current: T, apply: (next: T) => void): boolean => {
    const next = redoStack.current.pop();
    if (next === undefined) {
      return false;
    }
    undoStack.current.push(current);
    lastPushAt.current = 0;
    apply(next);
    setVersion((v) => v + 1);
    return true;
  }, []);

  // 每次渲染直接构造返回值：栈变化递增 version 触发重渲染后，
  // 渲染期读取 ref 即可拿到最新的 canUndo/canRedo，无需把栈放进 state
  return {
    pushHistory,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
};
