import { useCallback, useEffect, useRef } from 'react';
import {
  isTauriFileSaveSuppressed,
  markTauriFileDirty,
  resumeTauriFileSave,
  saveTauriDocFile,
  setTauriDocDraft,
} from '../../data/tauri-file';
import { scheduleTauriAutoSave } from '../../data/tauri-auto-save';

/**
 * 文档编辑器（Markdown/表格）的编辑捕获逻辑，由两种编辑器共用：
 * 编辑时标脏并写草稿缓存（localStorage），同时调度自动写盘
 * （编辑停止 1s 后落盘，所有文件自动保存）；落盘也可由页签栏保存入口
 * （保存按钮 / Ctrl+S / 退出前 flush）触发，保存失败时草稿与脏标记保留，
 * 输入与光标不受影响
 */
export const useDocAutoSave = (
  path: string,
  fileType: 'md' | 'table',
  serialize: () => string | null
) => {
  // 内容是否已成功加载；未加载前禁止写草稿，避免用空内容覆盖
  const loadedRef = useRef(false);

  const flushDraft = useCallback(() => {
    if (!loadedRef.current) {
      return;
    }
    // 文件已被删除/改名/移动时禁止回写，避免把旧文件重新创建出来
    if (isTauriFileSaveSuppressed(path, fileType)) {
      return;
    }
    const content = serialize();
    if (content !== null) {
      setTauriDocDraft(path, fileType, content);
    }
  }, [path, fileType, serialize]);

  const scheduleSave = useCallback(() => {
    // 被屏蔽的路径（删除/移动中）不标脏也不写草稿
    if (isTauriFileSaveSuppressed(path, fileType)) {
      return;
    }
    markTauriFileDirty(path, fileType);
    flushDraft();
    // 自动保存（所有文件）：编辑停止 1s 后自动写盘；serialize 惰性执行
    // （写盘时才取最新内容），编辑器未就绪返回 null 时跳过本次写盘
    scheduleTauriAutoSave(path, fileType, () => {
      const content = serialize();
      return content === null ? Promise.resolve() : saveTauriDocFile(path, content, fileType);
    });
  }, [flushDraft, path, fileType, serialize]);

  const markLoaded = useCallback(() => {
    // 重新打开同名路径的文件（如删除后重建）时恢复自动保存
    resumeTauriFileSave(path, fileType);
    loadedRef.current = true;
  }, [path, fileType]);

  // 卸载（关闭/切换文件）时立即写入草稿，保证未保存修改不丢
  useEffect(() => {
    return () => {
      flushDraft();
    };
  }, [flushDraft]);

  return { scheduleSave, markLoaded };
};
