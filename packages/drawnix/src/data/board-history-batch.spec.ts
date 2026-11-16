import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isMovingElements,
  PlaitBoard,
  setupTestingBoard,
  Transforms,
  withHistory,
} from '@plait/core';
import type { PlaitElement, TestingBoardFixture } from '@plait/core';
import { insertImage } from './image';
import { insertCard, setCardData } from '../plugins/card/transforms';
import type { CardElement } from '../plugins/card/type';

// isMovingElements 是 @plait/core 的公开导出（拖拽中判定）：image.ts 在
// 落地前用它等待进行中的拖拽结束。部分替换后各用例可控制其返回值，
// 模拟「粘贴图片后立刻拖动」的竞态窗口
vi.mock('@plait/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plait/core')>();
  return {
    ...actual,
    isMovingElements: vi.fn(() => false),
  };
});

const mockIsMovingElements = vi.mocked(isMovingElements);

// jsdom 不加载图片资源，loadHTMLImageElement 的 Image.onload 不会触发；
// 用立即异步 onload 的替身 Image 让真实的 insertImage 链路走通
class FakeImage {
  width = 100;
  height = 50;
  onload: (() => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  private srcValue = '';
  set src(value: string) {
    this.srcValue = value;
    setTimeout(() => this.onload?.(), 0);
  }
  get src(): string {
    return this.srcValue;
  }
}

const createRectangle = (id: string) => ({
  id,
  type: 'geometry',
  shape: 'rectangle',
  points: [
    [0, 0],
    [100, 100],
  ],
});

const createImageFile = () => new File(['x'], 'spec.png', { type: 'image/png' });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('图片插入批次（G2/G3）', () => {
  let fixture: TestingBoardFixture | undefined;

  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage);
    mockIsMovingElements.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fixture?.destroy();
    fixture = undefined;
  });

  const createBoardWith = (children: PlaitElement[]) => {
    fixture = setupTestingBoard([withHistory], children);
    return fixture!.board;
  };

  it('移动后异步落地自成批次：撤销一次只回退插入，既有元素不被动（G2/G3）', async () => {
    const board = createBoardWith([createRectangle('geo-existing')]);

    // 模拟用户移动元素（独立批次）
    Transforms.setNode(
      board,
      {
        points: [
          [10, 10],
          [110, 110],
        ],
      },
      [0]
    );
    expect(board.history.undos).toHaveLength(1);

    // 图片插入异步落地（粘贴/拖放后的两次 await 之后）
    await insertImage(board, createImageFile(), [200, 200]);

    // 插入未被并进移动批次：两个独立撤销批次
    expect(board.history.undos).toHaveLength(2);
    // 插入按落地时刻的 children.length 落在末尾（G3）
    expect(board.children).toHaveLength(2);
    expect(PlaitBoard.findPath(board, board.children[1])).toEqual([1]);

    // 撤销一次只回退插入批次：既有元素保留（含已移动的位置）
    board.undo();
    expect(board.children.map((element) => element.id)).toEqual(['geo-existing']);
    expect((board.children[0] as { points: number[][] }).points).toEqual([
      [10, 10],
      [110, 110],
    ]);

    // 再撤销一次才回退移动
    board.undo();
    expect((board.children[0] as { points: number[][] }).points).toEqual([
      [0, 0],
      [100, 100],
    ]);
  });

  it('拖拽进行中不落地：等待拖拽结束后才插入并独立成批（G2）', async () => {
    const board = createBoardWith([createRectangle('geo-existing')]);
    Transforms.setNode(
      board,
      {
        points: [
          [10, 10],
          [110, 110],
        ],
      },
      [0]
    );

    // 粘贴/拖放触发插入时拖拽仍在进行
    mockIsMovingElements.mockReturnValue(true);
    const inserting = insertImage(board, createImageFile(), [200, 200]);

    // 数据准备 + 首轮轮询已完成：拖拽未结束，插入尚未落地
    await delay(80);
    expect(board.children).toHaveLength(1);

    // pointerup：拖拽结束
    mockIsMovingElements.mockReturnValue(false);
    await inserting;

    // 拖拽结束后才落地，自成批次（不会被拖拽帧污染、也不并入移动批次）
    expect(board.children).toHaveLength(2);
    expect(board.history.undos).toHaveLength(2);
    board.undo();
    expect(board.children.map((element) => element.id)).toEqual(['geo-existing']);
  });
});

describe('卡片插入批次与 path（G2/G3）', () => {
  let fixture: TestingBoardFixture | undefined;

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
  });

  const createBoardWith = (children: PlaitElement[]) => {
    fixture = setupTestingBoard([withHistory], children);
    return fixture!.board;
  };

  it('同一 flush 窗口内的插入仍独立成批', () => {
    const board = createBoardWith([createRectangle('geo-existing')]);

    // 移动批次落地后 flush 尚未结束，同一同步 tick 内插入卡片：
    // 无 withNewBatch 时 operations.length !== 0 会把插入并进移动批次
    Transforms.setNode(
      board,
      {
        points: [
          [10, 10],
          [110, 110],
        ],
      },
      [0]
    );
    const card = insertCard(board, [200, 200]);

    expect(board.history.undos).toHaveLength(2);
    expect(PlaitBoard.findPath(board, card)).toEqual([1]);
  });

  it('插入与跨 flush 窗口的属性设置分两批：撤销一次只回退属性，元素仍在', async () => {
    const board = createBoardWith([]);
    const card = insertCard(board, [100, 100]);
    // 等待 flush 微任务结束：属性设置属于下一个手势（与真实使用一致；
    // 同一同步块内的 set_node 属于「创建卡片」动作本身，合并成批是正确语义）
    await Promise.resolve();
    await Promise.resolve();
    setCardData(board, card, { title: 'hello' });

    expect(board.history.undos).toHaveLength(2);
    board.undo();
    // 卡片仍在，属性设置被回退
    expect(board.children).toHaveLength(1);
    expect((board.children[0] as CardElement).title).toBe('');
    // 再撤销一次才移除刚插入的卡片
    board.undo();
    expect(board.children).toHaveLength(0);
  });

  it('插入后跨窗口的移动独立成批：撤销只回退移动，卡片不连坐删除', async () => {
    const board = createBoardWith([]);
    const card = insertCard(board, [100, 100]);
    const originalPoints = (card.points as number[][]).map((p) => [...p]);
    // 下一个手势：用户拖动卡片（报告 bug 的操作序列）
    await Promise.resolve();
    await Promise.resolve();
    Transforms.setNode(
      board,
      {
        points: [
          [200, 200],
          [400, 400],
        ],
      },
      PlaitBoard.findPath(board, card)
    );

    expect(board.history.undos).toHaveLength(2);
    board.undo();
    // 撤销移动：卡片回到原位置且未被删除
    expect(board.children).toHaveLength(1);
    expect(PlaitBoard.findPath(board, card)).toEqual([0]);
    expect((board.children[0] as CardElement).points).toEqual(originalPoints);
    // 再撤销一次移除卡片
    board.undo();
    expect(board.children).toHaveLength(0);
  });

  it('前置元素被移除后 set_node 仍写对位置（findPath 而非预计算下标）', () => {
    const board = createBoardWith([]);
    const cardA = insertCard(board, [100, 100]);
    const cardB = insertCard(board, [300, 300]);

    // cardA 被移除后 cardB 的真实下标从 1 变 0：
    // 若沿用插入前预计算的 [children.length]，setNode 会写错位置或越界
    Transforms.removeNode(board, PlaitBoard.findPath(board, cardA));
    setCardData(board, cardB, { title: 'B' });

    expect(board.children).toHaveLength(1);
    expect((board.children[0] as CardElement).id).toBe(cardB.id);
    expect((board.children[0] as CardElement).title).toBe('B');
  });
});
