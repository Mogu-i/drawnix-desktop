import { useEffect, useRef } from 'react';
import {
  isTauriEnvironment,
  useTauriFileState,
  clearTauriFileDirty,
  forceMarkTauriFileDirty,
} from '../../data/tauri-file';
import { useTauriFileActions } from '../../hooks/use-tauri-file-actions';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';

/**
 * 启动恢复：Tauri 桌面端上次退出的活动文件是白板时，按 草稿 → 内存快照 → 磁盘
 * 的优先级加载画布。页签与活动文件的恢复由数据层（tauri-file 模块初始化）完成，
 * 但白板内容不会自动进入画布（app 端启动不加载缓存 value），缺失这一步会让用户
 * 在保存成功并重启后看到空白画布，误以为内容丢失。
 * 命中未保存草稿时保留脏橙点（force 标脏绕过加载期的抑制窗口）并 toast 告知；
 * 仅当确实从磁盘加载（无草稿）时按原逻辑清除遗留脏标记。
 * Markdown/表格文件由文档编辑器挂载时自行加载（草稿优先），无需此处处理。
 * 挂载在 Board 之后：Wrapper 初始化时 board/listRender 已就绪，effect 可直接加载。
 */
export const RestoreOpenedFile = () => {
  const { currentFile, fileType } = useTauriFileState();
  const { openFile } = useTauriFileActions();
  const { showToast } = useDrawnix();
  const { t } = useI18n();
  const restoredRef = useRef(false);

  useEffect(() => {
    // 仅首次挂载后恢复一次；后续页签切换由各自的交互路径负责加载
    if (!isTauriEnvironment() || restoredRef.current) {
      return;
    }
    if (!currentFile || fileType !== 'drawnix') {
      return;
    }
    restoredRef.current = true;
    void openFile(currentFile, fileType).then(({ restored, fromDraft }) => {
      if (!restored) {
        return;
      }
      if (fromDraft) {
        // 恢复的是未保存草稿：内容与磁盘不一致，保留未保存状态（橙点），
        // 让用户知道这份内容还没保存
        forceMarkTauriFileDirty(currentFile, 'drawnix');
        showToast({ message: t('toast.tauriFile.draftRestored') });
      } else {
        // 加载的是磁盘最新版：异常退出遗留的脏标记已无对应的未保存内容，一并清除，
        // 避免用户面对一个与磁盘一致却带橙点的画布
        clearTauriFileDirty(currentFile, fileType);
      }
    });
  }, [currentFile, fileType, openFile, showToast, t]);

  return null;
};
