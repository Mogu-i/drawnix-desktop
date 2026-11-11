import { useCallback } from 'react';
import { useBoard, useListRender } from '@plait-board/react-board';
import { BoardTransforms, PlaitBoard, PlaitElement, PlaitTheme, Viewport } from '@plait/core';
import { useDrawnix } from './use-drawnix';
import { useI18n } from '../i18n';
import { formatTemplate } from '../i18n/format';
import {
  clearTauriFileDirty,
  getTauriBoardSnapshot,
  getTauriDocDraft,
  getTauriFileState,
  normalizeTauriFileType,
  parseTauriFileContent,
  readTauriFile,
  saveTauriDocFile,
  saveToTauriFile,
  setCurrentTauriFile,
  setTauriBoardSnapshot,
  suppressTauriDirty,
} from '../data/tauri-file';
import { serializeAsJSON } from '../data/json';

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

/**
 * 白板内容载入画板：先抑制脏标记再整体替换 children，
 * 避免加载过程触发的 board change 把文件误标为有未保存修改。
 * 面板与页签栏共用（新建白板、打开白板文件、删除当前文件后的清空）。
 */
export const useTauriFileActions = () => {
  const board = useBoard();
  const listRender = useListRender();
  const { showToast } = useDrawnix();
  const { t } = useI18n();

  const clearAndLoad = useCallback(
    (elements: PlaitElement[], viewport?: Viewport, theme?: PlaitTheme) => {
      suppressTauriDirty();
      board.children = elements;
      board.viewport = viewport || { zoom: 1 };
      if (theme) {
        board.theme = theme;
      }
      listRender.update(board.children, {
        board: board,
        parent: board,
        parentG: PlaitBoard.getElementHost(board),
      });
      BoardTransforms.fitViewport(board);
    },
    [board, listRender]
  );

  /** 打开文件：切换前把当前白板内容存为快照，白板文件优先用快照恢复未保存内容；
   *  返回是否成功加载（供启动恢复判断，文档类型无加载动作视为成功） */
  const openFile = useCallback(
    async (path: string, ext: string): Promise<boolean> => {
      const fileType = normalizeTauriFileType(ext) ?? 'drawnix';
      const state = getTauriFileState();
      // 同名不同类型的文件共用路径，页签身份不同也要存快照，
      // 否则白板与它的同名文档互切时未保存内容会丢
      const isSameTab =
        state.currentFile === path && state.fileType === fileType;
      if (state.currentFile && !isSameTab && state.fileType === 'drawnix') {
        // 未保存的白板内容暂存快照，切回来时优先恢复
        setTauriBoardSnapshot(state.currentFile, serializeAsJSON(board));
      }
      setCurrentTauriFile(path, fileType);
      if (fileType === 'drawnix') {
        try {
          const snapshot = getTauriBoardSnapshot(path);
          const content = snapshot ?? (await readTauriFile(path, 'drawnix'));
          const { elements, viewport, theme } = parseTauriFileContent(content);
          clearAndLoad(elements as PlaitElement[], viewport, theme);
          return true;
        } catch (error) {
          console.error('Failed to open file:', error);
          showToast({ message: t('toast.tauriFile.loadFailed') });
          return false;
        }
      }
      return true;
    },
    [board, clearAndLoad, showToast, t]
  );

  /**
   * 保存当前活动文件：白板写序列化内容，Markdown/表格写草稿；
   * 写盘成功才清除该文件的脏标记（saveToTauriFile/saveTauriDocFile 内部处理，
   * 失败时脏标记与橙点保留，输入与位置不受影响）。
   * 返回是否保存成功，供快捷键与退出流程判断。
   */
  const saveCurrentFile = useCallback((): Promise<boolean> => {
    const state = getTauriFileState();
    if (!state.currentFile) {
      showToast({ message: t('workbench.save.noFile') });
      return Promise.resolve(false);
    }
    const path = state.currentFile;
    const fileType = state.fileType;
    const promise =
      fileType === 'drawnix'
        ? saveToTauriFile(board, path)
        : Promise.resolve().then(() => {
            const draft = getTauriDocDraft(path, fileType);
            if (draft !== null) {
              return saveTauriDocFile(path, draft, fileType);
            }
            // 无草稿说明该文件没有未保存的修改，无需写盘
          });
    return promise
      .then(() => {
        showToast({
          message: formatTemplate(t('workbench.save.success'), { name: lastSeg(path) }),
        });
        return true;
      })
      .catch((error) => {
        console.error('Failed to save current file:', error);
        showToast({ message: t('toast.tauriFile.saveFailed') });
        return false;
      });
    // board 不进依赖数组：board 实例在 Wrapper 生命周期内稳定，
    // 保存时读取的总是同一份画布的最新内容
  }, [board, showToast, t]);

  /** 清除指定文件的脏标记（保存成功、收起页签等场景） */
  const clearFileDirty = useCallback((path: string) => {
    clearTauriFileDirty(path);
  }, []);

  return { clearAndLoad, openFile, saveCurrentFile, clearFileDirty };
};
