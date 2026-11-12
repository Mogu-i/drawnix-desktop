import localforage from 'localforage';
import type { Viewport } from '@plait/core';

/**
 * 白板草稿与视口状态持久化（按文件路径隔离）。
 *
 * 草稿（Bug 1）：未保存的白板编辑此前只存在于内存（board.children / 内存快照），
 * 前端上下文重建（刷新、WebView 进程回收、休眠唤醒）后启动恢复会从磁盘读旧版
 * 并清掉脏标记，表现为内容凭空消失。这里把 serializeAsJSON(board) 按路径写入
 * 独立的 IndexedDB store，恢复优先级为 草稿 → 内存快照 → 磁盘。
 * 不塞进 localStorage 的 PersistedWorkbenchState（白板 JSON 可能很大，localStorage
 * 有容量上限），也不复用宿主的全局 MAIN_BOARD_CONTENT_KEY（全局单键无法区分
 * 多个白板文件）。
 *
 * 视口（Bug 2 附带）：手动缩放/平移不标脏不写盘，只缩放不编辑时重启丢 zoom。
 * 这里把 { zoom, origination } 按路径轻量写入 localStorage（视图状态而非内容，
 * 保存文件不清除），恢复时优先于文件自带的 viewport。
 *
 * 写入均为「防抖 + pending 内存映射」模式：防抖合并高频编辑/缩放；pending
 * 映射保证 flush 时取最新值、clear 后不会复活旧值。失败仅 console.error，
 * 草稿是尽力而为的兜底，不打断编辑。
 */

const BOARD_DRAFT_DEBOUNCE_MS = 400;
const BOARD_VIEWPORT_DEBOUNCE_MS = 400;
const BOARD_VIEWPORT_STORAGE_PREFIX = 'drawnix_board_viewport:';

const draftStore = localforage.createInstance({
  name: 'Drawnix',
  storeName: 'board_drafts',
  description: 'Unsaved whiteboard drafts keyed by file path',
});

/** 各文件待写入的草稿内容（路径 → 最新 serializeAsJSON 内容） */
const pendingDrafts = new Map<string, string>();
const draftTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** 各文件待写入的视口状态（路径 → 最新 { zoom, origination }） */
const pendingViewports = new Map<string, Viewport>();
const viewportTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ---------------------------------------------------------------------------
// 视口数据校验
// ---------------------------------------------------------------------------

/** 视口是否可用于恢复：zoom 必须是有限正数（旧数据/损坏数据回退 fit） */
export const isUsableViewport = (viewport?: unknown): viewport is Viewport => {
  if (!viewport || typeof viewport !== 'object') {
    return false;
  }
  const zoom = (viewport as Viewport).zoom;
  return typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0;
};

// ---------------------------------------------------------------------------
// 白板草稿（IndexedDB）
// ---------------------------------------------------------------------------

export const getBoardDraft = (path: string): Promise<string | null> => {
  return draftStore
    .getItem<string>(path)
    .then((value) => (typeof value === 'string' ? value : null))
    .catch((error) => {
      console.error('Failed to read board draft:', path, error);
      return null;
    });
};

const writeDraftNow = async (path: string): Promise<void> => {
  const content = pendingDrafts.get(path);
  pendingDrafts.delete(path);
  if (content === undefined) {
    return;
  }
  try {
    await draftStore.setItem(path, content);
  } catch (error) {
    console.error('Failed to persist board draft:', path, error);
  }
};

const cancelDraftTimer = (path: string) => {
  const timer = draftTimers.get(path);
  if (timer !== undefined) {
    clearTimeout(timer);
    draftTimers.delete(path);
  }
};

/** 立即写入草稿（取消防抖），用于保存成功后的清除前置与切换文件前的落盘 */
export const setBoardDraft = (path: string, content: string): Promise<void> => {
  cancelDraftTimer(path);
  pendingDrafts.set(path, content);
  return writeDraftNow(path);
};

/** 清除草稿（取消防抖与 pending），仅保存成功 / 文件删除 / 页签收起时调用；
 *  保存失败必须保留草稿 */
export const clearBoardDraft = (path: string): Promise<void> => {
  cancelDraftTimer(path);
  pendingDrafts.delete(path);
  return draftStore.removeItem(path).catch((error) => {
    console.error('Failed to clear board draft:', path, error);
  });
};

/** 防抖写入草稿：编辑高峰（连续画笔/拖拽）合并为最后一次写入 */
export const scheduleBoardDraft = (path: string, content: string) => {
  pendingDrafts.set(path, content);
  if (draftTimers.has(path)) {
    return;
  }
  draftTimers.set(
    path,
    setTimeout(() => {
      draftTimers.delete(path);
      void writeDraftNow(path);
    }, BOARD_DRAFT_DEBOUNCE_MS)
  );
};

/** 立即落盘全部防抖中的草稿（失焦 / 隐藏 / 切走页签前调用） */
export const flushBoardDraftNow = async (): Promise<void> => {
  draftTimers.forEach((timer) => clearTimeout(timer));
  draftTimers.clear();
  const paths = [...pendingDrafts.keys()];
  await Promise.all(paths.map((path) => writeDraftNow(path)));
};

/** 批量清除某路径前缀下的草稿（删除分组时组内文件一并清理） */
export const clearBoardDraftsByPrefix = async (prefix: string): Promise<void> => {
  for (const path of pendingDrafts.keys()) {
    if (path.startsWith(prefix)) {
      cancelDraftTimer(path);
      pendingDrafts.delete(path);
    }
  }
  try {
    const keys = await draftStore.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith(prefix)).map((key) => draftStore.removeItem(key))
    );
  } catch (error) {
    console.error('Failed to clear board drafts by prefix:', prefix, error);
  }
};

/** 文件重命名/移动后迁移草稿键（fire-and-forget，调用方无需等待） */
export const renameBoardDraft = (from: string, to: string): Promise<void> => {
  const pending = pendingDrafts.get(from);
  cancelDraftTimer(from);
  pendingDrafts.delete(from);
  if (pending !== undefined) {
    pendingDrafts.set(to, pending);
  }
  return draftStore
    .getItem<string>(from)
    .then((value) => {
      if (typeof value !== 'string') {
        return;
      }
      return draftStore.setItem(to, value).then(() => draftStore.removeItem(from));
    })
    .catch((error) => {
      console.error('Failed to rename board draft:', from, to, error);
    });
};

// ---------------------------------------------------------------------------
// 视口状态（localStorage，轻量；同步读，恢复路径无 IO 等待）
// ---------------------------------------------------------------------------

export const getBoardViewport = (path: string): Viewport | null => {
  try {
    const raw = window.localStorage.getItem(BOARD_VIEWPORT_STORAGE_PREFIX + path);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return isUsableViewport(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeViewportNow = (path: string) => {
  const viewport = pendingViewports.get(path);
  pendingViewports.delete(path);
  if (!viewport) {
    return;
  }
  try {
    window.localStorage.setItem(
      BOARD_VIEWPORT_STORAGE_PREFIX + path,
      JSON.stringify({ zoom: viewport.zoom, origination: viewport.origination ?? null })
    );
  } catch {
    // localStorage 满/禁用时视图状态尽力而为，不影响编辑
  }
};

const cancelViewportTimer = (path: string) => {
  const timer = viewportTimers.get(path);
  if (timer !== undefined) {
    clearTimeout(timer);
    viewportTimers.delete(path);
  }
};

/** 防抖写入视口状态：连续缩放/平移合并为最后一次 */
export const scheduleBoardViewport = (path: string, viewport: Viewport) => {
  if (!isUsableViewport(viewport)) {
    return;
  }
  pendingViewports.set(path, viewport);
  if (viewportTimers.has(path)) {
    return;
  }
  viewportTimers.set(
    path,
    setTimeout(() => {
      viewportTimers.delete(path);
      writeViewportNow(path);
    }, BOARD_VIEWPORT_DEBOUNCE_MS)
  );
};

export const clearBoardViewport = (path: string) => {
  cancelViewportTimer(path);
  pendingViewports.delete(path);
  try {
    window.localStorage.removeItem(BOARD_VIEWPORT_STORAGE_PREFIX + path);
  } catch {
    // 同上，尽力而为
  }
};

/** 批量清除某路径前缀下的视口键（删除分组时组内文件一并清理） */
export const clearBoardViewportsByPrefix = (prefix: string) => {
  for (const path of pendingViewports.keys()) {
    if (path.startsWith(prefix)) {
      cancelViewportTimer(path);
      pendingViewports.delete(path);
    }
  }
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(BOARD_VIEWPORT_STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    keys
      .filter((key) => key.slice(BOARD_VIEWPORT_STORAGE_PREFIX.length).startsWith(prefix))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // 尽力而为
  }
};

export const renameBoardViewport = (from: string, to: string) => {
  cancelViewportTimer(from);
  const pending = pendingViewports.get(from);
  pendingViewports.delete(from);
  if (pending) {
    pendingViewports.set(to, pending);
  }
  try {
    const raw = window.localStorage.getItem(BOARD_VIEWPORT_STORAGE_PREFIX + from);
    if (raw !== null) {
      window.localStorage.removeItem(BOARD_VIEWPORT_STORAGE_PREFIX + from);
      window.localStorage.setItem(BOARD_VIEWPORT_STORAGE_PREFIX + to, raw);
    }
  } catch {
    // 尽力而为
  }
};

/** 立即落盘全部防抖中的视口状态（失焦 / 隐藏前调用） */
export const flushBoardViewportNow = () => {
  viewportTimers.forEach((timer) => clearTimeout(timer));
  viewportTimers.clear();
  for (const path of pendingViewports.keys()) {
    writeViewportNow(path);
  }
};

/** 失焦 / 隐藏 / 切走页签前统一 flush 草稿与视口 */
export const flushBoardSessionStateNow = async (): Promise<void> => {
  flushBoardViewportNow();
  await flushBoardDraftNow();
};
