import { useCallback, useEffect, useRef } from 'react';
import { hashDocContent } from '../../data/doc-draft';
import {
  DOC_DISK_SYNCED_EVENT,
  type DocDiskSyncedDetail,
  forceMarkTauriFileDirty,
  isTauriFileDirty,
  isTauriFileSaveSuppressed,
  markTauriFileDirty,
  resumeTauriFileSave,
  saveTauriDocFile,
  setTauriDocDraft,
} from '../../data/tauri-file';
import { scheduleTauriAutoSave } from '../../data/tauri-auto-save';

/**
 * 文档编辑器（Markdown/表格）的编辑捕获逻辑，由两种编辑器共用：
 * 编辑时标脏并写草稿缓存（localStorage，带磁盘内容哈希基线），
 * 同时调度自动写盘（编辑停止 1s 后落盘，所有文件自动保存）；
 * 落盘也可由页签栏保存入口（保存按钮 / Ctrl+S / 退出前 flush）触发，
 * 保存失败时草稿与脏标记保留，输入与光标不受影响。
 *
 * 基线同步：任意一条写盘成功（自动保存 / 手动保存 / 退出 flush）都会广播
 * DOC_DISK_SYNCED_EVENT，此处订阅后把基线哈希更新为「本次写入磁盘内容」，
 * 保证保存成功后继续编辑产生的新草稿不会因基线陈旧被误判为过期。
 */
export const useDocAutoSave = (
  path: string,
  fileType: 'md' | 'table',
  serialize: () => string | null
) => {
  // 内容是否已成功加载；未加载前禁止写草稿，避免用空内容覆盖
  const loadedRef = useRef(false);
  // 本次会话是否有过编辑：无编辑不得写草稿，否则仅为浏览过的文件留下残留快照
  const hasEditedRef = useRef(false);
  // 本次加载时磁盘内容的哈希基线：草稿只有基线与当前磁盘一致才视为有效
  const baseHashRef = useRef('');

  const flushDraft = useCallback(() => {
    if (!loadedRef.current || !hasEditedRef.current) {
      return;
    }
    // 文件已被删除/改名/移动时禁止回写，避免把旧文件重新创建出来
    if (isTauriFileSaveSuppressed(path, fileType)) {
      return;
    }
    const content = serialize();
    if (content === null) {
      return;
    }
    // 确有编辑（hasEditedRef）但脏标记被加载期抑制窗口吞掉时用 force 补标：
    // 草稿与脏标记必须原子一致，否则无脏草稿会被数据层第二道防线清除
    if (!isTauriFileDirty(path, fileType)) {
      forceMarkTauriFileDirty(path, fileType);
    }
    setTauriDocDraft(path, fileType, content, baseHashRef.current);
  }, [path, fileType, serialize]);

  const scheduleSave = useCallback(() => {
    // 被屏蔽的路径（删除/移动中）不标脏也不写草稿
    if (isTauriFileSaveSuppressed(path, fileType)) {
      return;
    }
    hasEditedRef.current = true;
    markTauriFileDirty(path, fileType);
    flushDraft();
    // 自动保存（所有文件）：编辑停止 1s 后自动写盘；serialize 惰性执行
    // （写盘时才取最新内容），编辑器未就绪返回 null 时跳过本次写盘
    scheduleTauriAutoSave(path, fileType, () => {
      const content = serialize();
      return content === null ? Promise.resolve() : saveTauriDocFile(path, content, fileType);
    });
  }, [flushDraft, path, fileType, serialize]);

  const markLoaded = useCallback(
    (diskContent: string) => {
      // 基线永远是本次加载读到的磁盘原文（而非草稿内容）：草稿恢复后继续
      // 编辑产生的草稿也要以磁盘版本为基准，下次加载才能正确判定过期
      baseHashRef.current = hashDocContent(diskContent);
      // 重新打开同名路径的文件（如删除后重建）时恢复自动保存
      resumeTauriFileSave(path, fileType);
      loadedRef.current = true;
    },
    [path, fileType]
  );

  // 基线同步：写盘成功（自动保存/手动保存/退出 flush，均经 saveTauriDocFile
  // 或 flushAllTauriDirtyFiles 广播）后基线更新为本次写入内容
  useEffect(() => {
    const handleDiskSynced = (event: Event) => {
      const detail = (event as CustomEvent<DocDiskSyncedDetail>).detail;
      if (
        detail &&
        detail.path === path &&
        detail.fileType === fileType &&
        loadedRef.current
      ) {
        baseHashRef.current = hashDocContent(detail.content);
      }
    };
    window.addEventListener(DOC_DISK_SYNCED_EVENT, handleDiskSynced);
    return () => {
      window.removeEventListener(DOC_DISK_SYNCED_EVENT, handleDiskSynced);
    };
  }, [path, fileType]);

  // 卸载时不再无条件写草稿：编辑路径（scheduleSave）已同步写过草稿，
  // 无编辑时写草稿反而会为「仅浏览过的文件」留下残留快照
  return { scheduleSave, markLoaded };
};
