import { useEffect, useRef } from 'react';
import { isTauriEnvironment, useTauriFileState, clearTauriFileDirty } from '../../data/tauri-file';
import { useTauriFileActions } from '../../hooks/use-tauri-file-actions';

/**
 * 启动恢复：Tauri 桌面端上次退出的活动文件是白板时，读取磁盘内容加载画布。
 * 页签与活动文件的恢复由数据层（tauri-file 模块初始化）完成，但白板内容
 * 不会自动进入画布（app 端启动不加载缓存 value），缺失这一步会让用户在
 * 保存成功并重启后看到空白画布，误以为内容丢失。
 * Markdown/表格文件由文档编辑器挂载时自行加载（草稿优先），无需此处处理。
 * 挂载在 Board 之后：Wrapper 初始化时 board/listRender 已就绪，effect 可直接加载。
 */
export const RestoreOpenedFile = () => {
  const { currentFile, fileType } = useTauriFileState();
  const { openFile } = useTauriFileActions();
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
    void openFile(currentFile, fileType).then((restored) => {
      // 加载的是磁盘最新版：异常退出遗留的脏标记已无对应的未保存内容，一并清除，
      // 避免用户面对一个与磁盘一致却带橙点的画布
      if (restored) {
        clearTauriFileDirty(currentFile);
      }
    });
  }, [currentFile, fileType, openFile]);

  return null;
};
