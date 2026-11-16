import { afterEach, describe, expect, it } from 'vitest';
import { setupTestingBoard, Transforms, withHistory } from '@plait/core';
import type { PlaitElement, TestingBoardFixture } from '@plait/core';
import { clearBoardHistory, isBoardHistoryEmpty } from './board-history';

const createRectangle = (id: string) => ({
  id,
  type: 'geometry',
  shape: 'rectangle',
  points: [
    [0, 0],
    [100, 100],
  ],
});

describe('clearBoardHistory（G1：整体替换 children 后撤销栈必须清空）', () => {
  let fixture: TestingBoardFixture | undefined;

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
  });

  const createBoardWith = (children: PlaitElement[]) => {
    fixture = setupTestingBoard([withHistory], children);
    return fixture!.board;
  };

  it('清空后撤销变 no-op：旧批次的逆操作不会删错新 children 的元素', () => {
    const board = createBoardWith([createRectangle('geo-existing')]);

    // 残留批次：一次插入已入撤销栈
    Transforms.insertNode(board, createRectangle('geo-stale'), [board.children.length]);
    expect(board.history.undos).toHaveLength(1);
    expect(isBoardHistoryEmpty(board)).toBe(false);

    // 模拟 clearAndLoad 的「整体替换 children」：不经 operation 直接赋值
    board.children = [createRectangle('geo-fresh')];
    clearBoardHistory(board);

    expect(board.history.undos).toHaveLength(0);
    expect(board.history.redos).toHaveLength(0);
    expect(isBoardHistoryEmpty(board)).toBe(true);

    // 关键断言：撤销是 no-op，新 children 不会被旧批次的 remove_node 破坏
    const snapshot = [...board.children];
    board.undo();
    expect(board.children).toEqual(snapshot);
    expect(board.children[0].id).toBe('geo-fresh');
  });

  it('清空同时抹掉撤销产生的重做栈：重做同样无法回放旧批次', () => {
    const board = createBoardWith([]);

    Transforms.insertNode(board, createRectangle('geo-1'), [0]);
    board.undo();
    expect(board.children).toHaveLength(0);
    expect(board.history.redos).toHaveLength(1);

    clearBoardHistory(board);
    board.redo();
    // 重做栈已清空：旧插入批次不会回放到替换后的 children 上
    expect(board.children).toHaveLength(0);
  });

  it('isBoardHistoryEmpty 按方向报告 undo/redo 栈', () => {
    const board = createBoardWith([]);

    Transforms.insertNode(board, createRectangle('geo-1'), [0]);
    expect(isBoardHistoryEmpty(board)).toBe(false);
    expect(isBoardHistoryEmpty(board, 'redo')).toBe(true);

    board.undo();
    expect(isBoardHistoryEmpty(board)).toBe(true);
    expect(isBoardHistoryEmpty(board, 'redo')).toBe(false);

    clearBoardHistory(board);
    expect(isBoardHistoryEmpty(board)).toBe(true);
    expect(isBoardHistoryEmpty(board, 'redo')).toBe(true);
  });
});
