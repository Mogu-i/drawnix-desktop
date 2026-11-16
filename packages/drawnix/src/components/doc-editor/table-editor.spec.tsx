import { act, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// 常量从数据层导入（table-editor 不 re-export；mock 保留真实值）
import { TAURI_FILES_CHANGED_EVENT } from '../../data/tauri-file';
import { TableEditor } from './table-editor';

const resolveDocContentMock = vi.fn();
const isTauriFileDirtyMock = vi.fn(() => false);
const showToastMock = vi.fn();
const markLoadedMock = vi.fn();

// 真实模块保留纯函数（parseTableFileContent 等），仅替换涉及 Tauri IO 的入口；
// importOriginal 加载真实 data 层（顶层只读 localStorage，不触发 invoke）
vi.mock('../../data/tauri-file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/tauri-file')>();
  return {
    ...actual,
    resolveDocContent: (...args: unknown[]) => resolveDocContentMock(...args),
    isTauriFileDirty: (...args: unknown[]) => isTauriFileDirtyMock(...args),
  };
});

vi.mock('./use-doc-auto-save', () => {
  // 回调引用必须稳定，否则编辑器会因依赖变化反复重新加载文件
  const scheduleSave = () => {};
  return { useDocAutoSave: () => ({ scheduleSave, markLoaded: markLoadedMock }) };
});

vi.mock('../../hooks/use-drawnix', () => ({
  useDrawnix: () => ({ showToast: showToastMock }),
}));

// t 引用必须稳定：loadDoc 把 t 放进依赖数组，每次渲染新建函数会反复触发加载
const tMock = (key: string) => key;
vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: tMock }),
}));

vi.mock('../icons', () => ({
  MoreIcon: () => <svg />,
}));

vi.mock('../select/select', () => ({
  Select: {
    Root: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Trigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Content: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Item: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
}));

// 工具岛替身：只保留结构，屏蔽 floating-ui/radix 依赖；下拉内容为渲染函数时不展开
vi.mock('./editor-toolbar-island', () => ({
  AlignIcon: () => <svg />,
  EditorColorSwatches: () => null,
  EditorIsland: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  EditorIslandButton: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  EditorIslandDropdown: ({ children }: { children?: unknown }) => (
    <div>{typeof children === 'function' ? null : children}</div>
  ),
  EditorIslandMenuItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  EditorIslandMenuSeparator: () => null,
  EditorIslandMenuTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  EditorIslandSeparator: () => null,
  IslandBorderIcon: () => <svg />,
  IslandColMinusIcon: () => <svg />,
  IslandColPlusIcon: () => <svg />,
  IslandFillIcon: () => <svg />,
  IslandGridIcon: () => <svg />,
  IslandHelpIcon: () => <svg />,
  IslandMergeIcon: () => <svg />,
  IslandRedoIcon: () => <svg />,
  IslandRowMinusIcon: () => <svg />,
  IslandRowPlusIcon: () => <svg />,
  IslandTextColorIcon: () => <svg />,
  IslandUndoIcon: () => <svg />,
  IslandUnmergeIcon: () => <svg />,
  useDrawnixContainer: () => null,
}));

/** 构造合法的 .table 文件 JSON（parseTableFileContent 走真实实现） */
const buildTableJson = (texts: string[][]) =>
  JSON.stringify({
    type: 'drawnix-table',
    version: 1,
    rows: texts.length,
    cols: texts[0].length,
    cells: texts.map((row) => row.map((text) => ({ text }))),
  });

// 磁盘版本与草稿版本的内容差异即外部改动前后的差异
const TABLE_DISK = buildTableJson([
  ['名称', '端口'],
  ['服务A', '测试'],
]);
const TABLE_DRAFT = buildTableJson([
  ['名称', '端口'],
  ['服务A', '草稿内容'],
]);
const TABLE_DISK_CHANGED = buildTableJson([
  ['名称', '端口'],
  ['服务A', '外部修改'],
]);

describe('TableEditor disk/draft loading', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resolveDocContentMock.mockReset();
    isTauriFileDirtyMock.mockReset().mockReturnValue(false);
    showToastMock.mockReset();
    markLoadedMock.mockReset();
  });

  it('renders the disk version when the disk was changed outside the app (G1)', async () => {
    // 外部改动后磁盘内容优先：过期草稿已在 resolveDocContent 内被清除
    resolveDocContentMock.mockResolvedValue({
      content: TABLE_DISK,
      diskContent: TABLE_DISK,
      fromDraft: false,
      conflict: true,
    });
    render(<TableEditor path="demo" />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('测试');
    });
    // 冲突不静默切换：toast 提示用户
    expect(showToastMock).toHaveBeenCalledWith({ message: 'toast.tauriFile.draftConflict' });
    // 基线永远是本次读到的磁盘原文
    expect(markLoadedMock).toHaveBeenCalledWith(TABLE_DISK);
  });

  it('renders the draft when its baseline still matches the disk (G2)', async () => {
    // 磁盘未被改动：未保存草稿仍优先恢复（切页签/异常重启语义不变）
    resolveDocContentMock.mockResolvedValue({
      content: TABLE_DRAFT,
      diskContent: TABLE_DISK,
      fromDraft: true,
      conflict: false,
    });
    render(<TableEditor path="demo" />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('草稿内容');
    });
    expect(document.body.textContent).not.toContain('测试');
    expect(showToastMock).not.toHaveBeenCalled();
    // 基线仍取磁盘原文（而非草稿内容）
    expect(markLoadedMock).toHaveBeenCalledWith(TABLE_DISK);
  });

  it('renders the disk content without conflict toast on a plain load', async () => {
    resolveDocContentMock.mockResolvedValue({
      content: TABLE_DISK,
      diskContent: TABLE_DISK,
      fromDraft: false,
      conflict: false,
    });
    render(<TableEditor path="demo" />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('测试');
    });
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it('shows the load failed placeholder when reading the file throws', async () => {
    resolveDocContentMock.mockRejectedValue(new Error('read failed'));
    render(<TableEditor path="demo" />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('toast.tauriFile.loadFailed');
    });
  });

  it('reloads from disk on the files-changed event without an unsaved edit', async () => {
    resolveDocContentMock.mockResolvedValue({
      content: TABLE_DISK,
      diskContent: TABLE_DISK,
      fromDraft: false,
      conflict: false,
    });
    render(<TableEditor path="demo" />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('测试');
    });
    // 文件在应用内被其他入口改动（文件引用卡片写回等）
    resolveDocContentMock.mockResolvedValue({
      content: TABLE_DISK_CHANGED,
      diskContent: TABLE_DISK_CHANGED,
      fromDraft: false,
      conflict: false,
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent(TAURI_FILES_CHANGED_EVENT));
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain('外部修改');
    });
    expect(resolveDocContentMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the draft view on the files-changed event with an unsaved edit', async () => {
    resolveDocContentMock.mockResolvedValue({
      content: TABLE_DISK,
      diskContent: TABLE_DISK,
      fromDraft: false,
      conflict: false,
    });
    render(<TableEditor path="demo" />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('测试');
    });
    // 有未保存编辑时不覆盖草稿显示，跳过本次重载
    isTauriFileDirtyMock.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new CustomEvent(TAURI_FILES_CHANGED_EVENT));
    });
    expect(resolveDocContentMock).toHaveBeenCalledTimes(1);
  });
});
