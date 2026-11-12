import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TauriFileType } from './tauri-file';

// tauri-file 依赖 @tauri-apps 的 invoke（测试环境不可用），
// 自动保存模块只用它的页签状态查询，这里提供可控替身。
// vi.mock 的工厂会被提升，共享状态必须用 vi.hoisted 创建
const mocks = vi.hoisted(() => ({
  /** 活动页签身份（getTauriFileState 的返回） */
  fileState: { currentFile: 'spec/a' as string | null, fileType: 'drawnix' as string },
  /** 脏文件集合（键为「路径:类型」） */
  dirty: new Set<string>(),
  /** 保存屏蔽集合（键为「路径:类型」） */
  suppressed: new Set<string>(),
}));

vi.mock('./tauri-file', () => ({
  getTauriTabId: (path: string, fileType: string) => `${path}:${fileType}`,
  getTauriFileState: () => mocks.fileState,
  isTauriFileDirty: (path: string, fileType: string) => mocks.dirty.has(`${path}:${fileType}`),
  isTauriFileSaveSuppressed: (path: string, fileType: string) =>
    mocks.suppressed.has(`${path}:${fileType}`),
}));

import {
  cancelTauriAutoSave,
  flushTauriAutoSaveNow,
  scheduleTauriAutoSave,
} from './tauri-auto-save';

const PATH_A = 'spec/a';
const PATH_B = 'spec/b';

/** 把 PATH_A 标为脏的活动文件（默认可写盘状态） */
const markRunnable = (path: string = PATH_A, fileType: TauriFileType = 'drawnix') => {
  mocks.fileState.currentFile = path;
  mocks.fileState.fileType = fileType;
  mocks.dirty.add(`${path}:${fileType}`);
};

describe('tauri-auto-save scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mocks.fileState.currentFile = PATH_A;
    mocks.fileState.fileType = 'drawnix';
    mocks.dirty.clear();
    mocks.suppressed.clear();
  });

  afterEach(() => {
    // 清空模块级任务与定时器，避免用例间污染（cancel 不执行任务回调）
    cancelTauriAutoSave(PATH_A, 'drawnix');
    cancelTauriAutoSave(PATH_B, 'drawnix');
    cancelTauriAutoSave(PATH_A, 'md');
    vi.useRealTimers();
  });

  it('runs the scheduled task after the debounce window', async () => {
    markRunnable();
    const run = vi.fn(() => Promise.resolve());
    scheduleTauriAutoSave(PATH_A, 'drawnix', run);
    // 防抖窗口内尚未写盘
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps only the latest task per tab during the debounce window', async () => {
    markRunnable();
    const first = vi.fn(() => Promise.resolve());
    const latest = vi.fn(() => Promise.resolve());
    scheduleTauriAutoSave(PATH_A, 'drawnix', first);
    scheduleTauriAutoSave(PATH_A, 'drawnix', latest);
    await vi.advanceTimersByTimeAsync(1000);
    // 同页签防抖合并：只执行最后一次调度的任务
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('skips the task when the file is no longer dirty', async () => {
    // 不脏（如已手动保存）时触发校验跳过，避免无谓写盘
    mocks.fileState.currentFile = PATH_A;
    const run = vi.fn(() => Promise.resolve());
    scheduleTauriAutoSave(PATH_A, 'drawnix', run);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).not.toHaveBeenCalled();
    // 标脏后重新调度则正常写盘
    markRunnable();
    scheduleTauriAutoSave(PATH_A, 'drawnix', run);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('skips the task while save is suppressed (delete/move in progress)', async () => {
    markRunnable();
    mocks.suppressed.add(`${PATH_A}:drawnix`);
    const run = vi.fn(() => Promise.resolve());
    scheduleTauriAutoSave(PATH_A, 'drawnix', run);
    await vi.advanceTimersByTimeAsync(1000);
    // 屏蔽期间不写盘（防止把已删除/已改名的文件重建出来）
    expect(run).not.toHaveBeenCalled();
  });

  it('skips the task when the tab is no longer active', async () => {
    markRunnable(PATH_A);
    const run = vi.fn(() => Promise.resolve());
    scheduleTauriAutoSave(PATH_A, 'drawnix', run);
    // 切到另一个文件后再触发：捕获的旧内容不得写进当前画布对应的路径
    mocks.fileState.currentFile = PATH_B;
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).not.toHaveBeenCalled();
  });

  it('flushes runnable tasks immediately and clears their timers', async () => {
    markRunnable(PATH_A);
    const runA = vi.fn(() => Promise.resolve());
    const runB = vi.fn(() => Promise.resolve());
    scheduleTauriAutoSave(PATH_A, 'drawnix', runA);
    // 非活动文件的任务 flush 时同样校验跳过（防错写保护）
    mocks.dirty.add(`${PATH_B}:drawnix`);
    scheduleTauriAutoSave(PATH_B, 'drawnix', runB);
    await flushTauriAutoSaveNow();
    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).not.toHaveBeenCalled();
    // 定时器已被清掉：防抖窗口过后不再重复触发
    await vi.advanceTimersByTimeAsync(1000);
    expect(runA).toHaveBeenCalledTimes(1);
    expect(runB).not.toHaveBeenCalled();
  });

  it('cancels the pending task and timer', async () => {
    markRunnable();
    const run = vi.fn(() => Promise.resolve());
    scheduleTauriAutoSave(PATH_A, 'drawnix', run);
    cancelTauriAutoSave(PATH_A, 'drawnix');
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).not.toHaveBeenCalled();
    await flushTauriAutoSaveNow();
    expect(run).not.toHaveBeenCalled();
  });
});
