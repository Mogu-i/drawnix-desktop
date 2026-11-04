import { useCallback, useEffect, useRef } from 'react';
import {
  clearTauriFileDirty,
  isTauriFileSaveSuppressed,
  markTauriFileDirty,
  notifyTauriFilesChanged,
  resumeTauriFileSave,
  writeTauriFile,
} from '../../data/tauri-file';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';

const SAVE_DELAY_MS = 600;

/** 文档编辑器（Markdown/表格）的防抖保存逻辑，由两种编辑器共用 */
export const useDocAutoSave = (
  path: string,
  fileType: 'md' | 'table',
  serialize: () => string | null
) => {
  const { showToast } = useDrawnix();
  const { t } = useI18n();
  // 内容是否已成功加载；未加载前禁止保存，避免用空内容覆盖原文件
  const loadedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const flushSave = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!loadedRef.current) {
      return;
    }
    // 文件已被删除/改名/移动时禁止回写，避免把旧文件重新创建出来
    if (isTauriFileSaveSuppressed(path)) {
      return;
    }
    const content = serialize();
    if (content === null) {
      return;
    }
    writeTauriFile(path, content, fileType)
      .then(() => {
        clearTauriFileDirty();
        // 文件内容已落盘，广播变更让文件面板与白板中的文件引用卡片同步刷新
        notifyTauriFilesChanged();
      })
      .catch((error) => {
        console.error(`Failed to save ${fileType} file:`, error);
        showToast({ message: t('toast.tauriFile.saveFailed') });
      });
  }, [path, fileType, serialize, showToast, t]);

  const scheduleSave = useCallback(() => {
    markTauriFileDirty();
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(flushSave, SAVE_DELAY_MS);
  }, [flushSave]);

  const markLoaded = useCallback(() => {
    // 重新打开同名路径的文件（如删除后重建）时恢复自动保存
    resumeTauriFileSave(path);
    loadedRef.current = true;
  }, [path]);

  // 卸载（关闭/切换文件）时立即保存未落盘的修改
  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  return { scheduleSave, markLoaded };
};
