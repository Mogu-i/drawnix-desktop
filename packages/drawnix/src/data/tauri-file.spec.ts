import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';

// tauri-file 通过动态 import 调用 @tauri-apps 的 invoke（测试环境不可用），
// 这里提供 spy 替身：既能断言写盘调用参数，也能验证"拒绝写盘时零调用"。
// vi.mock 的工厂会被提升，共享状态必须用 vi.hoisted 创建
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

// serializeAsJSON 需要 board 内部结构；本文件专注保存分派与类型校验，固定序列化输出
vi.mock('./json', () => ({
  serializeAsJSON: () => '{"mocked":true}',
  isValidDrawnixData: () => true,
}));

import {
  closeTauriTab,
  forceMarkTauriFileDirty,
  flushAllTauriDirtyFiles,
  getTauriBoardSnapshot,
  getTauriDocDraft,
  getTauriTabId,
  isTauriFileDirty,
  renameTauriTabPath,
  saveTauriDocFile,
  saveToTauriFile,
  setCurrentTauriFile,
  setTauriBoardSnapshot,
  setTauriDocDraft,
} from './tauri-file';

const fakeBoard = { children: [], viewport: { zoom: 1 } } as unknown as PlaitBoard;

describe('tauri-file save type guard', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue(undefined);
  });

  it('refuses to save whiteboard content when the active file is a table', async () => {
    // 事故场景：活动文件为表格时按 Ctrl+S，缺省推断把表格路径按 drawnix 写盘，
    // 凭空多出同名白板文件——现在必须拒绝写盘
    setCurrentTauriFile('spec/table', 'table');
    await expect(saveToTauriFile(fakeBoard)).rejects.toThrow();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('refuses an explicit non-drawnix target even when the type is passed in', async () => {
    setCurrentTauriFile('spec/board', 'drawnix');
    await expect(saveToTauriFile(fakeBoard, 'spec/table', 'table')).rejects.toThrow();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('refuses doc saving with the drawnix type (runtime whitelist)', async () => {
    setCurrentTauriFile('spec/board', 'drawnix');
    await expect(saveTauriDocFile('spec/doc', 'content', 'drawnix' as never)).rejects.toThrow();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('still saves a drawnix file by explicit type and clears its dirty flag', async () => {
    setCurrentTauriFile('spec/board', 'drawnix');
    forceMarkTauriFileDirty('spec/board', 'drawnix');
    expect(isTauriFileDirty('spec/board', 'drawnix')).toBe(true);
    await expect(saveToTauriFile(fakeBoard, 'spec/board', 'drawnix')).resolves.toBe('spec/board');
    expect(mocks.invoke).toHaveBeenCalledWith('write_drawnix_file', {
      path: 'spec/board',
      content: '{"mocked":true}',
      ext: 'drawnix',
    });
    expect(isTauriFileDirty('spec/board', 'drawnix')).toBe(false);
  });

  it('saves a doc file by its type and clears the draft', async () => {
    setTauriDocDraft('spec/doc', 'table', 'table content');
    await expect(saveTauriDocFile('spec/doc', 'table content', 'table')).resolves.toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledWith('write_drawnix_file', {
      path: 'spec/doc',
      content: 'table content',
      ext: 'table',
    });
    expect(getTauriDocDraft('spec/doc', 'table')).toBeNull();
  });
});

describe('tauri-file same-name tab isolation', () => {
  it('keeps the whiteboard snapshot when closing a same-name doc tab', () => {
    // 同路径的白板与文档各自成页签：收起文档页签不得清掉白板的未保存快照
    setCurrentTauriFile('spec/same', 'drawnix');
    setTauriBoardSnapshot('spec/same', 'BOARD SNAP');
    setCurrentTauriFile('spec/same', 'md');
    const nextTab = closeTauriTab('spec/same', 'md');
    expect(nextTab?.fileType).toBe('drawnix');
    expect(getTauriBoardSnapshot('spec/same')).toBe('BOARD SNAP');
  });

  it('keeps the whiteboard snapshot when renaming a same-name doc tab', () => {
    // 重命名文档不得把同名白板的快照搬走
    setCurrentTauriFile('spec/same', 'drawnix');
    setTauriBoardSnapshot('spec/same', 'BOARD SNAP2');
    setCurrentTauriFile('spec/same', 'table');
    renameTauriTabPath('spec/same', 'spec/renamed', 'table');
    expect(getTauriBoardSnapshot('spec/same')).toBe('BOARD SNAP2');
    expect(getTauriBoardSnapshot('spec/renamed')).toBeNull();
  });

  it('builds distinct tab ids for same-path files of different types', () => {
    // 页签身份复合键：同名不同类型文件互不覆盖（编辑器按类型重挂载的依据）
    expect(getTauriTabId('aaa', 'md')).toBe('aaa:md');
    expect(getTauriTabId('aaa', 'table')).toBe('aaa:table');
    expect(getTauriTabId('aaa', 'md')).not.toBe(getTauriTabId('aaa', 'table'));
  });
});

describe('tauri-file flush before exit', () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue(undefined);
  });

  it('flushes dirty files by tab identity without cross-type mixup', async () => {
    setCurrentTauriFile('spec/board', 'drawnix');
    forceMarkTauriFileDirty('spec/board', 'drawnix');
    setTauriBoardSnapshot('spec/board', 'SNAP-BOARD');
    // 白板保持脏并切到同名文档（页签仍打开），文档也标脏
    setCurrentTauriFile('spec/board', 'table');
    setTauriDocDraft('spec/board', 'table', 'DOC DRAFT');
    forceMarkTauriFileDirty('spec/board', 'table');

    await flushAllTauriDirtyFiles(() => 'LIVE BOARD');

    // 白板页签已非活动文件，用切换前的快照按 drawnix 写盘
    expect(mocks.invoke).toHaveBeenCalledWith('write_drawnix_file', {
      path: 'spec/board',
      content: 'SNAP-BOARD',
      ext: 'drawnix',
    });
    // 文档草稿按 table 写盘
    expect(mocks.invoke).toHaveBeenCalledWith('write_drawnix_file', {
      path: 'spec/board',
      content: 'DOC DRAFT',
      ext: 'table',
    });
    // 写盘成功后各页签脏标记独立清除
    expect(isTauriFileDirty('spec/board', 'drawnix')).toBe(false);
    expect(isTauriFileDirty('spec/board', 'table')).toBe(false);
  });
});
