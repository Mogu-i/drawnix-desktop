import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from './markdown-editor';

const readTauriFileMock = vi.fn();
const resolveDocContentMock = vi.fn();
const isTauriFileDirtyMock = vi.fn(() => false);
const showToastMock = vi.fn();
const markLoadedMock = vi.fn();

vi.mock('../../data/tauri-file', () => ({
  readTauriFile: (...args: unknown[]) => readTauriFileMock(...args),
  writeTauriFile: vi.fn().mockResolvedValue(undefined),
  // 统一加载决策点：编辑器不再自行拼「草稿优先」三元表达式
  resolveDocContent: (...args: unknown[]) => resolveDocContentMock(...args),
  isTauriFileDirty: (...args: unknown[]) => isTauriFileDirtyMock(...args),
  TAURI_FILES_CHANGED_EVENT: 'drawnix:tauri-files-changed',
}));

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

const getAllCheckboxes = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

const waitForEnabledCheckboxes = async () => {
  return waitFor(() => {
    const boxes = getAllCheckboxes();
    expect(boxes).toHaveLength(3);
    boxes.forEach((box) => {
      expect(box.disabled).toBe(false);
      // 复选框必须带有序号，否则点击无法回写源码
      expect(box.dataset.taskIndex).toBeDefined();
    });
    return boxes;
  });
};

describe('MarkdownEditor task checkbox interaction', () => {
  beforeEach(() => {
    window.localStorage.clear();
    readTauriFileMock.mockReset();
    readTauriFileMock.mockResolvedValue('- [ ] 任务一\n- [ ] 任务二\n- [ ] 任务三');
    resolveDocContentMock.mockReset();
    // 默认无草稿：resolveDocContent 返回磁盘内容，content 与 diskContent 一致
    resolveDocContentMock.mockImplementation(async () => {
      const diskContent = await readTauriFileMock();
      return { content: diskContent, diskContent, fromDraft: false, conflict: false };
    });
    isTauriFileDirtyMock.mockReset().mockReturnValue(false);
    showToastMock.mockReset();
    markLoadedMock.mockReset();
  });

  it('keeps all checkboxes clickable while toggling tasks', async () => {
    render(<MarkdownEditor path="demo" />);
    const boxes = await waitForEnabledCheckboxes();

    fireEvent.click(boxes[0]);
    const afterFirst = await waitForEnabledCheckboxes();
    expect(afterFirst[0].checked).toBe(true);

    fireEvent.click(afterFirst[1]);
    const afterSecond = await waitForEnabledCheckboxes();
    expect(afterSecond[0].checked).toBe(true);
    expect(afterSecond[1].checked).toBe(true);
    expect(afterSecond[2].checked).toBe(false);
  });

  it('syncs the source textarea when toggling tasks in the preview', async () => {
    render(<MarkdownEditor path="demo" />);
    const boxes = await waitForEnabledCheckboxes();
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;

    // 勾选第一项后源码必须同步更新（防原生翻转造成的假阳性）
    fireEvent.click(boxes[0]);
    await waitFor(() => {
      expect(textarea.value).toBe('- [x] 任务一\n- [ ] 任务二\n- [ ] 任务三');
    });

    // 再取消勾选
    fireEvent.click(getAllCheckboxes()[0]);
    await waitFor(() => {
      expect(textarea.value).toBe('- [ ] 任务一\n- [ ] 任务二\n- [ ] 任务三');
    });
  });

  it('syncs the source textarea for CRLF file content', async () => {
    readTauriFileMock.mockResolvedValue('- [ ] 任务一\r\n- [ ] 任务二\r\n- [ ] 任务三\r\n');
    render(<MarkdownEditor path="demo" />);
    const boxes = await waitForEnabledCheckboxes();
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.click(boxes[1]);
    // textarea 的 value 会按 HTML 规范把 \r\n 规范化为 \n，仅验证勾选同步
    await waitFor(() => {
      expect(textarea.value).toBe('- [ ] 任务一\n- [x] 任务二\n- [ ] 任务三\n');
    });
  });

  it('renders the disk version when a draft exists but the disk changed outside (G1/G3)', async () => {
    // 磁盘被应用外改动：过期草稿失效，显示磁盘内容而不是旧草稿
    resolveDocContentMock.mockResolvedValue({
      content: '- [x] 磁盘最新内容',
      diskContent: '- [x] 磁盘最新内容',
      fromDraft: false,
      conflict: true,
    });
    render(<MarkdownEditor path="demo" />);
    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('- [x] 磁盘最新内容');
    });
    // 冲突不静默切换：toast 提示用户
    expect(showToastMock).toHaveBeenCalledWith({ message: 'toast.tauriFile.draftConflict' });
    // 基线永远是磁盘原文（而非草稿内容）
    expect(markLoadedMock).toHaveBeenCalledWith('- [x] 磁盘最新内容');
  });

  it('renders the draft when its baseline still matches the disk (G2)', async () => {
    // 磁盘未被改动：未保存草稿仍优先恢复，不提示冲突
    resolveDocContentMock.mockResolvedValue({
      content: '- [x] 未保存的草稿',
      diskContent: '- [ ] 磁盘版本',
      fromDraft: true,
      conflict: false,
    });
    render(<MarkdownEditor path="demo" />);
    await waitFor(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('- [x] 未保存的草稿');
    });
    expect(showToastMock).not.toHaveBeenCalled();
    // 基线仍取磁盘原文，草稿恢复后继续编辑以此判定过期
    expect(markLoadedMock).toHaveBeenCalledWith('- [ ] 磁盘版本');
  });
});
