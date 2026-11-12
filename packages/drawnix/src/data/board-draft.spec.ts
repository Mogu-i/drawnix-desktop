import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearBoardDraft,
  clearBoardDraftsByPrefix,
  clearBoardViewport,
  flushBoardDraftNow,
  flushBoardViewportNow,
  getBoardDraft,
  getBoardViewport,
  isUsableViewport,
  renameBoardDraft,
  renameBoardViewport,
  scheduleBoardDraft,
  scheduleBoardViewport,
  setBoardDraft,
} from './board-draft';

const DRAFT_PATH_A = 'spec-draft/a';
const DRAFT_PATH_B = 'spec-draft/b';
const DRAFT_PREFIX = 'spec-draft/';

describe('board-draft persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await clearBoardDraftsByPrefix(DRAFT_PREFIX);
    clearBoardViewportsByPrefixForTest(DRAFT_PREFIX);
  });

  it('writes and reads a draft back by file path', async () => {
    await setBoardDraft(DRAFT_PATH_A, '{"elements":[]}');
    await expect(getBoardDraft(DRAFT_PATH_A)).resolves.toBe('{"elements":[]}');
    await expect(getBoardDraft(DRAFT_PATH_B)).resolves.toBeNull();
  });

  it('flushes a scheduled draft after the debounce window', async () => {
    scheduleBoardDraft(DRAFT_PATH_A, '{"scheduled":true}');
    // 防抖窗口内尚未落盘（读不到），窗口过后可读
    await expect(getBoardDraft(DRAFT_PATH_A)).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(400);
    await expect(getBoardDraft(DRAFT_PATH_A)).resolves.toBe('{"scheduled":true}');
  });

  it('flushes all pending drafts immediately with flushBoardDraftNow', async () => {
    scheduleBoardDraft(DRAFT_PATH_A, '{"a":1}');
    scheduleBoardDraft(DRAFT_PATH_B, '{"b":2}');
    await flushBoardDraftNow();
    await expect(getBoardDraft(DRAFT_PATH_A)).resolves.toBe('{"a":1}');
    await expect(getBoardDraft(DRAFT_PATH_B)).resolves.toBe('{"b":2}');
  });

  it('keeps only the latest scheduled content per path', async () => {
    scheduleBoardDraft(DRAFT_PATH_A, '{"v":1}');
    scheduleBoardDraft(DRAFT_PATH_A, '{"v":2}');
    await vi.advanceTimersByTimeAsync(400);
    await expect(getBoardDraft(DRAFT_PATH_A)).resolves.toBe('{"v":2}');
  });

  it('does not resurrect a cleared draft on later flush', async () => {
    scheduleBoardDraft(DRAFT_PATH_A, '{"pending":true}');
    await clearBoardDraft(DRAFT_PATH_A);
    await flushBoardDraftNow();
    await expect(getBoardDraft(DRAFT_PATH_A)).resolves.toBeNull();
  });

  it('clears drafts by path prefix', async () => {
    await setBoardDraft(DRAFT_PATH_A, 'a');
    await setBoardDraft(DRAFT_PATH_B, 'b');
    await clearBoardDraftsByPrefix(DRAFT_PREFIX);
    await expect(getBoardDraft(DRAFT_PATH_A)).resolves.toBeNull();
    await expect(getBoardDraft(DRAFT_PATH_B)).resolves.toBeNull();
  });

  it('renames the draft key so unsaved edits survive rename/move', async () => {
    await setBoardDraft(DRAFT_PATH_A, '{"moved":true}');
    await renameBoardDraft(DRAFT_PATH_A, 'spec-draft/c');
    await expect(getBoardDraft(DRAFT_PATH_A)).resolves.toBeNull();
    await expect(getBoardDraft('spec-draft/c')).resolves.toBe('{"moved":true}');
    await clearBoardDraft('spec-draft/c');
  });
});

describe('board-draft viewport persistence', () => {
  const VIEWPORT_PATH = 'spec-draft/viewport';

  afterEach(() => {
    clearBoardViewport(VIEWPORT_PATH);
    clearBoardViewport('spec-draft/viewport-moved');
  });

  it('persists and reads back a usable viewport', () => {
    scheduleBoardViewport(VIEWPORT_PATH, { zoom: 1.5, origination: [10, 20] });
    // 防抖期间读不到
    expect(getBoardViewport(VIEWPORT_PATH)).toBeNull();
    flushBoardViewportNow();
    expect(getBoardViewport(VIEWPORT_PATH)).toEqual({ zoom: 1.5, origination: [10, 20] });
    clearBoardViewport(VIEWPORT_PATH);
    expect(getBoardViewport(VIEWPORT_PATH)).toBeNull();
  });

  it('ignores unusable viewports (bad zoom)', () => {
    scheduleBoardViewport(VIEWPORT_PATH, { zoom: 0 } as never);
    flushBoardViewportNow();
    expect(getBoardViewport(VIEWPORT_PATH)).toBeNull();
  });

  it('moves the viewport key on rename', () => {
    scheduleBoardViewport(VIEWPORT_PATH, { zoom: 2 });
    flushBoardViewportNow();
    renameBoardViewport(VIEWPORT_PATH, 'spec-draft/viewport-moved');
    expect(getBoardViewport(VIEWPORT_PATH)).toBeNull();
    // 无 origination 时序列化保留 origination: null（isUsableViewport 只校验 zoom）
    expect(getBoardViewport('spec-draft/viewport-moved')).toEqual({ zoom: 2, origination: null });
    clearBoardViewport('spec-draft/viewport-moved');
  });
});

describe('isUsableViewport', () => {
  it('accepts finite positive zoom', () => {
    expect(isUsableViewport({ zoom: 1 })).toBe(true);
    expect(isUsableViewport({ zoom: 0.4, origination: [1, 2] })).toBe(true);
  });

  it('rejects missing/invalid zoom so restore falls back to fit', () => {
    expect(isUsableViewport(undefined)).toBe(false);
    expect(isUsableViewport(null)).toBe(false);
    expect(isUsableViewport({ zoom: 0 })).toBe(false);
    expect(isUsableViewport({ zoom: -1 })).toBe(false);
    expect(isUsableViewport({ zoom: Number.NaN })).toBe(false);
    expect(isUsableViewport({ zoom: Infinity })).toBe(false);
    expect(isUsableViewport({ zoom: '2' })).toBe(false);
  });
});

/** 测试辅助：按前缀清理 localStorage 视口键（与模块内部键前缀约定一致） */
function clearBoardViewportsByPrefixForTest(prefix: string) {
  const storagePrefix = 'drawnix_board_viewport:';
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(storagePrefix)) {
      keys.push(key);
    }
  }
  keys
    .filter((key) => key.slice(storagePrefix.length).startsWith(prefix))
    .forEach((key) => window.localStorage.removeItem(key));
}
