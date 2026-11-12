import type { TauriFileType } from './tauri-file';
import {
  getTauriFileState,
  getTauriTabId,
  isTauriFileDirty,
  isTauriFileSaveSuppressed,
} from './tauri-file';

/**
 * 全文件自动保存调度（Tauri 桌面端）：
 * 编辑停止 AUTO_SAVE_DEBOUNCE_MS 后自动写盘，不依赖手动 Ctrl+S。
 * - 白板：drawnix.tsx 的 onChange 内容变化时调度，任务为 saveToTauriFile(board, path)
 * - 文档（Markdown/表格）：use-doc-auto-save 编辑时调度，任务为 saveTauriDocFile(path, serialize(), type)
 *
 * 写盘复用 saveToTauriFile / saveTauriDocFile，其内部语义不变：
 * 写盘成功清脏标记/草稿/快照（橙点消失），失败时保留（橙点持续亮起即为失败信号，
 * 不额外弹 toast 避免磁盘异常态下反复打扰），保存屏蔽（删除/移动中）的文件一律跳过。
 *
 * 防错写保护：任务触发前校验该页签仍是活动文件——白板任务捕获的 board 是同一个
 * 实例，若已切换文件再写盘会把当前画布内容写进旧路径；文档任务捕获的编辑器
 * serialize 闭包同理。因此切走/新建文件前调用方必须先 flushTauriAutoSaveNow 把
 * 未写盘的修改立即落盘（此时旧文件仍是活动文件，校验通过），被跳过的任务内容不丢。
 */

const AUTO_SAVE_DEBOUNCE_MS = 1000;

/** 单个待写盘任务：页签身份 + 惰性执行的保存回调（写盘时才取最新内容） */
type PendingAutoSaveTask = {
  path: string;
  fileType: TauriFileType;
  run: () => Promise<unknown>;
};

/** 各页签待写盘任务（键为「路径:类型」复合键） */
const autoSaveTasks = new Map<string, PendingAutoSaveTask>();
const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

const runAutoSaveTask = (task: PendingAutoSaveTask) => {
  void Promise.resolve()
    .then(task.run)
    .catch((error) => {
      // 失败静默：saveToTauriFile/saveTauriDocFile 已保留脏标记与草稿/快照，
      // 橙点持续亮起作为失败信号；下一次编辑会重新调度重试
      console.error('Auto save failed:', task.path, error);
    });
};

/** 触发前校验：已被手动保存（不脏）、保存屏蔽中（删除/移动）、已切换活动文件的任务一律跳过 */
const isAutoSaveRunnable = (path: string, fileType: TauriFileType): boolean => {
  const state = getTauriFileState();
  return (
    isTauriFileDirty(path, fileType) &&
    !isTauriFileSaveSuppressed(path, fileType) &&
    state.currentFile === path &&
    state.fileType === fileType
  );
};

/**
 * 调度一次自动保存：编辑停止 1s 后写盘；防抖窗口内的多次编辑合并为最后一次内容
 * （任务闭包惰性取内容），且只会安排一个定时器
 */
export const scheduleTauriAutoSave = (
  path: string,
  fileType: TauriFileType,
  run: () => Promise<unknown>
) => {
  const key = getTauriTabId(path, fileType);
  autoSaveTasks.set(key, { path, fileType, run });
  if (autoSaveTimers.has(key)) {
    return;
  }
  autoSaveTimers.set(
    key,
    setTimeout(() => {
      autoSaveTimers.delete(key);
      const task = autoSaveTasks.get(key);
      autoSaveTasks.delete(key);
      if (task && isAutoSaveRunnable(task.path, task.fileType)) {
        runAutoSaveTask(task);
      }
    }, AUTO_SAVE_DEBOUNCE_MS)
  );
};

/**
 * 立即写盘全部防抖中的任务（失焦 / 页面隐藏 / 刷新前 / 切走或新建文件前调用）。
 * 逐任务校验后并行执行，失败的任务静默保留脏标记。
 */
export const flushTauriAutoSaveNow = async (): Promise<void> => {
  autoSaveTimers.forEach((timer) => clearTimeout(timer));
  autoSaveTimers.clear();
  const tasks = [...autoSaveTasks.values()];
  autoSaveTasks.clear();
  await Promise.all(
    tasks.map((task) => {
      if (!isAutoSaveRunnable(task.path, task.fileType)) {
        return Promise.resolve();
      }
      return Promise.resolve()
        .then(task.run)
        .catch((error) => {
          console.error('Auto save (flush) failed:', task.path, error);
        });
    })
  );
};

/** 取消某页签的防抖任务与定时器（收起页签 / 删除 / 重命名移动前调用） */
export const cancelTauriAutoSave = (path: string, fileType: TauriFileType) => {
  const key = getTauriTabId(path, fileType);
  const timer = autoSaveTimers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    autoSaveTimers.delete(key);
  }
  autoSaveTasks.delete(key);
};
