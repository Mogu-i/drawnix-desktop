import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaitBoard } from '@plait/core';
import { hashDocContent } from './doc-draft';

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
  resolveDocContent,
  saveTauriDocFile,
  saveToTauriFile,
  setCurrentTauriFile,
  setTauriBoardSnapshot,
  setTauriDocDraft,
} from './tauri-file';

const WORKBENCH_KEY = 'drawnix_tauri_workbench';

const fakeBoard = { children: [], viewport: { zoom: 1 } } as unknown as PlaitBoard;

/** 按命令分发 invoke：read_drawnix_file 返回指定磁盘内容，其余解析为 undefined */
const mockDisk = (diskContent: string) => {
  mocks.invoke.mockImplementation((command: string) => {
    if (command === 'read_drawnix_file') {
      return Promise.resolve(diskContent);
    }
    return Promise.resolve(undefined);
  });
};

describe('tauri-file save type guard', () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it('refuses resolving doc content with a non-doc type', async () => {
    setCurrentTauriFile('spec/board', 'drawnix');
    await expect(resolveDocContent('spec/board', 'drawnix' as never)).rejects.toThrow();
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
    setTauriDocDraft('spec/doc', 'table', 'table content', hashDocContent('table content'));
    forceMarkTauriFileDirty('spec/doc', 'table');
    await expect(saveTauriDocFile('spec/doc', 'table content', 'table')).resolves.toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledWith('write_drawnix_file', {
      path: 'spec/doc',
      content: 'table content',
      ext: 'table',
    });
    expect(getTauriDocDraft('spec/doc', 'table')).toBeNull();
  });

  it('persists the draft removal immediately after a successful save (G5)', async () => {
    setCurrentTauriFile('spec/persist', 'md');
    setTauriDocDraft('spec/persist', 'md', 'PERSIST DRAFT', hashDocContent('PERSIST DRAFT'));
    forceMarkTauriFileDirty('spec/persist', 'md');
    await saveTauriDocFile('spec/persist', 'PERSIST DRAFT', 'md');
    // 保存成功后 localStorage 立即不含该草稿键，不等 300ms 防抖：
    // 防抖窗口内退出进程时残留草稿会在下次启动被当成未保存修改复活
    const raw = window.localStorage.getItem(WORKBENCH_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).docContents['spec/persist:md']).toBeUndefined();
  });
});

describe('tauri-file doc draft stale guard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.invoke.mockReset();
  });

  it('drops a residual draft without a dirty flag on read', () => {
    setCurrentTauriFile('spec/orphan', 'md');
    setTauriDocDraft('spec/orphan', 'md', 'ORPHAN DRAFT', hashDocContent('ORPHAN DRAFT'));
    // 不标脏：残留草稿（保存后清除失败、迁移残留等）读取时即清除，不生效
    expect(getTauriDocDraft('spec/orphan', 'md')).toBeNull();
    expect(isTauriFileDirty('spec/orphan', 'md')).toBe(false);
  });

  it('returns disk content and clears the stale draft when the disk changed outside (G1/G3)', async () => {
    setCurrentTauriFile('spec/conflict', 'table');
    setTauriDocDraft('spec/conflict', 'table', 'STALE DRAFT', hashDocContent('OLD DISK'));
    forceMarkTauriFileDirty('spec/conflict', 'table');
    // 磁盘已被应用外改动：草稿基线（OLD DISK）与当前磁盘不一致
    mockDisk('CHANGED OUTSIDE THE APP');

    const resolved = await resolveDocContent('spec/conflict', 'table');

    expect(resolved.content).toBe('CHANGED OUTSIDE THE APP');
    expect(resolved.diskContent).toBe('CHANGED OUTSIDE THE APP');
    expect(resolved.fromDraft).toBe(false);
    expect(resolved.conflict).toBe(true);
    // 过期草稿被清除并立即持久化，遗留脏标记一并释放（内容已与磁盘一致）
    expect(getTauriDocDraft('spec/conflict', 'table')).toBeNull();
    expect(isTauriFileDirty('spec/conflict', 'table')).toBe(false);
    const raw = window.localStorage.getItem(WORKBENCH_KEY);
    expect(JSON.parse(raw as string).docContents['spec/conflict:table']).toBeUndefined();
  });

  it('restores the draft when its baseline still matches the disk (G2)', async () => {
    setCurrentTauriFile('spec/fresh', 'table');
    setTauriDocDraft('spec/fresh', 'table', 'FRESH DRAFT', hashDocContent('SAME DISK'));
    forceMarkTauriFileDirty('spec/fresh', 'table');
    mockDisk('SAME DISK');

    const resolved = await resolveDocContent('spec/fresh', 'table');

    // 磁盘未被改动：未保存草稿仍优先恢复，脏标记（橙点）保留
    expect(resolved.content).toBe('FRESH DRAFT');
    expect(resolved.diskContent).toBe('SAME DISK');
    expect(resolved.fromDraft).toBe(true);
    expect(resolved.conflict).toBe(false);
    expect(isTauriFileDirty('spec/fresh', 'table')).toBe(true);
  });

  it('returns disk content when no draft exists', async () => {
    setCurrentTauriFile('spec/plain', 'md');
    mockDisk('PLAIN DISK');

    const resolved = await resolveDocContent('spec/plain', 'md');

    expect(resolved.content).toBe('PLAIN DISK');
    expect(resolved.diskContent).toBe('PLAIN DISK');
    expect(resolved.fromDraft).toBe(false);
    expect(resolved.conflict).toBe(false);
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

  it('keeps the whiteboard snapshot while clearing the doc draft on tab close (G5)', () => {
    // 收起文档页签会清草稿：草稿删除立即持久化，防抖窗口内退出不复活
    setCurrentTauriFile('spec/closed', 'drawnix');
    setTauriBoardSnapshot('spec/closed', 'BOARD SNAP3');
    setCurrentTauriFile('spec/closed', 'table');
    setTauriDocDraft('spec/closed', 'table', 'CLOSED DRAFT', hashDocContent('CLOSED DRAFT'));
    forceMarkTauriFileDirty('spec/closed', 'table');

    closeTauriTab('spec/closed', 'table');

    expect(getTauriDocDraft('spec/closed', 'table')).toBeNull();
    const raw = window.localStorage.getItem(WORKBENCH_KEY);
    expect(JSON.parse(raw as string).docContents['spec/closed:table']).toBeUndefined();
    expect(getTauriBoardSnapshot('spec/closed')).toBe('BOARD SNAP3');
  });
});

describe('tauri-file flush before exit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue(undefined);
  });

  it('flushes dirty files by tab identity without cross-type mixup', async () => {
    setCurrentTauriFile('spec/board', 'drawnix');
    forceMarkTauriFileDirty('spec/board', 'drawnix');
    setTauriBoardSnapshot('spec/board', 'SNAP-BOARD');
    // 白板保持脏并切到同名文档（页签仍打开），文档也标脏
    setCurrentTauriFile('spec/board', 'table');
    setTauriDocDraft('spec/board', 'table', 'DOC DRAFT', hashDocContent('DOC DISK'));
    forceMarkTauriFileDirty('spec/board', 'table');
    // 退出前 flush 对文档草稿先读盘校验基线（磁盘未被改动，草稿仍有效）
    mockDisk('DOC DISK');

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

  it('never writes a stale draft back to disk during exit flush (G3)', async () => {
    setCurrentTauriFile('spec/stale', 'table');
    setTauriDocDraft('spec/stale', 'table', 'STALE DRAFT', hashDocContent('OLD DISK'));
    forceMarkTauriFileDirty('spec/stale', 'table');
    // 磁盘已被应用外改动
    mockDisk('CHANGED OUTSIDE THE APP');

    await flushAllTauriDirtyFiles(() => null);

    // 过期草稿绝不写盘：磁盘版本原样保留
    const writes = mocks.invoke.mock.calls.filter(
      ([command]) => command === 'write_drawnix_file'
    );
    expect(writes).toHaveLength(0);
    // 过期草稿被清除、脏标记释放（内存已无未保存内容）
    expect(getTauriDocDraft('spec/stale', 'table')).toBeNull();
    expect(isTauriFileDirty('spec/stale', 'table')).toBe(false);
    const raw = window.localStorage.getItem(WORKBENCH_KEY);
    expect(JSON.parse(raw as string).docContents['spec/stale:table']).toBeUndefined();
  });
});

describe('tauri-file legacy workbench draft migration', () => {
  it('turns legacy string drafts into always-stale drafts (G1)', async () => {
    window.localStorage.clear();
    // 旧版持久化数据：docContents 值为纯字符串（没有磁盘基线）
    window.localStorage.setItem(
      WORKBENCH_KEY,
      JSON.stringify({
        openTabs: [{ path: 'spec/legacy', fileType: 'table' }],
        activeId: 'spec/legacy:table',
        dirty: { 'spec/legacy:table': true },
        docContents: { 'spec/legacy:table': 'LEGACY DRAFT CONTENT' },
      })
    );
    // 重新加载模块触发 loadPersistedWorkbench 迁移
    vi.resetModules();
    const migrated = await import('./tauri-file');
    mockDisk('DISK VERSION');

    const resolved = await migrated.resolveDocContent('spec/legacy', 'table');

    // 旧草稿无从校验过期：不再无条件生效，磁盘版本优先并提示冲突
    expect(resolved.content).toBe('DISK VERSION');
    expect(resolved.fromDraft).toBe(false);
    expect(resolved.conflict).toBe(true);
    expect(migrated.getTauriDocDraft('spec/legacy', 'table')).toBeNull();
  });

  it('drops invalid draft records instead of crashing', async () => {
    window.localStorage.clear();
    // docContents 含非法值：数字与 null 均跳过，不让整页渲染中断
    window.localStorage.setItem(
      WORKBENCH_KEY,
      JSON.stringify({
        openTabs: [{ path: 'spec/bad', fileType: 'md' }],
        activeId: 'spec/bad:md',
        dirty: { 'spec/bad:md': true },
        docContents: { 'spec/bad:md': 42, 'spec/other': null },
      })
    );
    vi.resetModules();
    const migrated = await import('./tauri-file');

    expect(migrated.getTauriDocDraft('spec/bad', 'md')).toBeNull();
    expect(migrated.getTauriDocDraft('spec/other', 'md')).toBeNull();
  });
});
