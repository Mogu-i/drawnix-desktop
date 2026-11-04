import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownEditor } from './markdown-editor';

const readTauriFileMock = vi.fn();

vi.mock('../../data/tauri-file', () => ({
  readTauriFile: (...args: unknown[]) => readTauriFileMock(...args),
  writeTauriFile: vi.fn().mockResolvedValue(undefined),
  markTauriFileDirty: vi.fn(),
  clearTauriFileDirty: vi.fn(),
}));

vi.mock('./use-doc-auto-save', () => {
  // 回调引用必须稳定，否则编辑器会因依赖变化反复重新加载文件
  const scheduleSave = () => {};
  const markLoaded = () => {};
  return { useDocAutoSave: () => ({ scheduleSave, markLoaded }) };
});

vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
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
});
