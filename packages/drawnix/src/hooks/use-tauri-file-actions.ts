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
import {
  flushBoardDraftNow,
  getBoardDraft,
  getBoardViewport,
  isUsableViewport,
} from '../data/board-draft';
import { flushTauriAutoSaveNow } from '../data/tauri-auto-save';
import { migrateLegacyBoardData } from '../plugins/card/with-card';

/** openFile 结果：restored 表示画布加载成功；fromDraft 表示内容来自未保存草稿
 *  （供启动恢复决定是否保留脏橙点并提示用户） */
export type OpenFileResult = { restored: boolean; fromDraft: boolean };

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
    (
      elements: PlaitElement[],
      viewport?: Viewport,
      theme?: PlaitTheme,
      options?: { preserveViewport?: boolean }
    ) => {
      suppressTauriDirty();
      // 预迁移旧版卡片/卡片链接元素：宿主 onChange 会把 board.children 回灌成 value，
      // 若迁移在 Drawnix 的 useMemo 里才发生（filter 旧版链接返回新数组），
      // Wrapper 的 [value] effect 会把恢复好的 viewport 再次 fit 覆盖；
      // 这里提前用同一数组，引用恒等后该 effect 自然跳过
      board.children = migrateLegacyBoardData(elements);
      board.viewport = viewport || { zoom: 1 };
      if (theme) {
        board.theme = theme;
      }
      listRender.update(board.children, {
        board: board,
        parent: board,
        parentG: PlaitBoard.getElementHost(board),
      });
      if (
        options?.preserveViewport === true &&
        isUsableViewport(viewport) &&
        // 缺少平移锚点（origination）时只有 zoom 可恢复，滚动位置无法同步，
        // 与“viewport 非法”一样回退 fitViewport，避免画面停在错误位置
        viewport.origination
      ) {
        // 走 set_viewport operation 恢复视口（切页签/草稿恢复）：
        // operation 触发 BOARD_TO_ON_CHANGE 里的 initializeViewBox + updateViewportOffset，
        // viewBox 与滚动位置随 zoom/origination 一起同步；直接赋值 board.viewport
        // 不产生 operation，会出现“zoom 数值对了画面没变”。
        // viewport 缺失/非法时回退 fitViewport，保持首次打开按内容自适应。
        BoardTransforms.updateViewport(board, viewport.origination, viewport.zoom);
      } else {
        BoardTransforms.fitViewport(board);
      }
    },
    [board, listRender]
  );

  /** 打开文件：切换前把当前白板内容存为快照并立即落盘草稿，加载优先级为
   *  草稿 → 内存快照 → 磁盘（草稿/快照损坏时逐级降级并提示）；
   *  切页签回来/草稿恢复保留用户手动视口，磁盘首次打开保持内容自适应。
   *  返回加载结果（供启动恢复判断；文档类型无加载动作视为成功） */
  const openFile = useCallback(
    async (path: string, ext: string): Promise<OpenFileResult> => {
      const fileType = normalizeTauriFileType(ext) ?? 'drawnix';
      const state = getTauriFileState();
      // 同名不同类型的文件共用路径，页签身份不同也要存快照，
      // 否则白板与它的同名文档互切时未保存内容会丢
      const isSameTab = state.currentFile === path && state.fileType === fileType;
      if (state.currentFile && !isSameTab) {
        if (state.fileType === 'drawnix') {
          // 未保存的白板内容暂存快照，切回来时优先恢复；
          // 同时把防抖中的草稿立即落盘，进程被回收后快照消失仍可从草稿恢复
          setTauriBoardSnapshot(state.currentFile, serializeAsJSON(board));
          void flushBoardDraftNow();
        }
        // 自动保存防抖中的修改立即写盘（此刻旧文件仍是活动文件，触发校验通过）；
        // 文档无快照机制，防抖窗口内的修改同样依赖此 flush
        void flushTauriAutoSaveNow();
      }
      setCurrentTauriFile(path, fileType);
      if (fileType !== 'drawnix') {
        return { restored: true, fromDraft: false };
      }
      try {
        const snapshot = getTauriBoardSnapshot(path);
        const draft = await getBoardDraft(path);
        // 恢复优先级：草稿 → 内存快照 → 磁盘；草稿/快照损坏时逐级降级，
        // 磁盘也损坏才向调用方抛错（toast 加载失败）
        const candidates: Array<{ content: string; fromDraft: boolean }> = [];
        if (draft) {
          candidates.push({ content: draft, fromDraft: true });
        }
        if (snapshot) {
          candidates.push({ content: snapshot, fromDraft: false });
        }
        let parsed: { elements: unknown[]; viewport?: unknown; theme?: unknown } | null = null;
        let fromDraft = false;
        let degradedFromDraft = false;
        for (const candidate of candidates) {
          try {
            parsed = parseTauriFileContent(candidate.content);
            fromDraft = candidate.fromDraft;
            break;
          } catch (error) {
            console.warn('Discarding unreadable board content candidate:', error);
          }
        }
        if (!parsed) {
          if (draft) {
            degradedFromDraft = true;
          }
          const diskContent = await readTauriFile(path, 'drawnix');
          parsed = parseTauriFileContent(diskContent);
        }
        if (degradedFromDraft) {
          showToast({ message: t('toast.tauriFile.draftCorrupted') });
        }
        // 视口恢复：localStorage 的手动视口（含只缩放不编辑的场景）优先；
        // 其次草稿/快照自带的视口（编辑后/切换前保存的最后状态）；
        // 磁盘首次打开不带入磁盘视口，保持按内容自适应的现状
        const storedViewport = getBoardViewport(path);
        const sourceViewport = fromDraft ? parsed.viewport : null;
        const viewport =
          storedViewport ?? (isUsableViewport(sourceViewport) ? sourceViewport : null);
        clearAndLoad(
          parsed.elements as PlaitElement[],
          viewport ?? undefined,
          parsed.theme as PlaitTheme | undefined,
          { preserveViewport: viewport != null }
        );
        return { restored: true, fromDraft };
      } catch (error) {
        console.error('Failed to open file:', error);
        showToast({ message: t('toast.tauriFile.loadFailed') });
        return { restored: false, fromDraft: false };
      }
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
