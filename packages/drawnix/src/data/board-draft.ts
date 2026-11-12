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
 * 存储键为「路径:drawnix」复合键（白板身份）：草稿/视口只服务白板文件，而同名
 * 不同类型的文件共用无扩展名路径，纯路径键会让收起/删除/重命名文档（md/table）
 * 页签时误清或误搬同名白板的草稿与视口。路径段不含冒号（Windows 文件名限制），
 * 拼类型后缀无歧义；旧版纯路径键在读取/迁移时升级为复合键。
 *
 * 写入均为「防抖 + pending 内存映射」模式：防抖合并高频编辑/缩放；pending
 * 映射保证 flush 时取最新值、clear 后不会复活旧值。失败仅 console.error，
 * 草稿是尽力而为的兜底，不打断编辑。
 */

const BOARD_DRAFT_DEBOUNCE_MS = 400;
const BOARD_VIEWPORT_DEBOUNCE_MS = 400;
const BOARD_VIEWPORT_STORAGE_PREFIX = 'drawnix_board_viewport:';

/** 白板身份的存储键：路径 + 类型后缀（草稿/视口只属于白板文件） */
const toStorageKey = (path: string): string => `${path}:drawnix`;

const draftStore = localforage.createInstance({
  name: 'Drawnix',
  storeName: 'board_drafts',
  description: 'Unsaved whiteboard drafts keyed by file path',
});

/** 各文件待写入的草稿内容（白板复合存储键 → 最新 serializeAsJSON 内容） */
const pendingDrafts = new Map<string, string>();
const draftTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** 各文件待写入的视口状态（白板复合存储键 → 最新 { zoom, origination }） */
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

/** 读取旧版纯路径键草稿并迁移到复合键（升级前写入的数据，读取时搬移） */
const readLegacyDraft = async (path: string): Promise<string | null> => {
  let value: unknown;
  try {
    value = await draftStore.getItem(path);
  } catch (error) {
    console.error('Failed to read board draft:', path, error);
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  // 迁到复合键后删除旧键，失败仅导致下次重复迁移，不丢失本次读取的内容
  try {
    await draftStore.setItem(toStorageKey(path), value);
    await draftStore.removeItem(path);
  } catch (error) {
    console.error('Failed to migrate legacy board draft:', path, error);
  }
  return value;
};

export const getBoardDraft = async (path: string): Promise<string | null> => {
  try {
    const value = await draftStore.getItem<string>(toStorageKey(path));
    return typeof value === 'string' ? value : await readLegacyDraft(path);
  } catch (error) {
    console.error('Failed to read board draft:', path, error);
    return null;
  }
};

const writeDraftNow = async (key: string): Promise<void> => {
  const content = pendingDrafts.get(key);
  pendingDrafts.delete(key);
  if (content === undefined) {
    return;
  }
  try {
    await draftStore.setItem(key, content);
  } catch (error) {
    console.error('Failed to persist board draft:', key, error);
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
  const key = toStorageKey(path);
  cancelDraftTimer(key);
  pendingDrafts.set(key, content);
  return writeDraftNow(key);
};

/** 清除草稿（取消防抖与 pending），仅保存成功 / 文件删除 / 页签收起时调用；
 *  保存失败必须保留草稿。旧版纯路径键一并清除，防止升级前的残留草稿在保存后复活 */
export const clearBoardDraft = async (path: string): Promise<void> => {
  const key = toStorageKey(path);
  cancelDraftTimer(key);
  pendingDrafts.delete(key);
  try {
    await Promise.all([draftStore.removeItem(key), draftStore.removeItem(path)]);
  } catch (error) {
    console.error('Failed to clear board draft:', path, error);
  }
};

/** 防抖写入草稿：编辑高峰（连续画笔/拖拽）合并为最后一次写入 */
export const scheduleBoardDraft = (path: string, content: string) => {
  const key = toStorageKey(path);
  pendingDrafts.set(key, content);
  if (draftTimers.has(key)) {
    return;
  }
  draftTimers.set(
    key,
    setTimeout(() => {
      draftTimers.delete(key);
      void writeDraftNow(key);
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

/** 批量清除某路径前缀下的草稿（删除分组时组内文件一并清理）；
 *  复合键与旧版纯路径键均以路径开头，同一前缀即可两代键全覆盖 */
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

/** 文件重命名/移动后迁移草稿键（fire-and-forget，调用方无需等待）；
 *  复合键与旧版纯路径键都迁移到同一目标复合键（旧键仅升级前数据存在） */
export const renameBoardDraft = async (from: string, to: string): Promise<void> => {
  const fromKey = toStorageKey(from);
  const toKey = toStorageKey(to);
  const pending = pendingDrafts.get(fromKey);
  cancelDraftTimer(fromKey);
  pendingDrafts.delete(fromKey);
  if (pending !== undefined) {
    pendingDrafts.set(toKey, pending);
  }
  try {
    let value = await draftStore.getItem<string>(fromKey);
    if (typeof value !== 'string') {
      value = await draftStore.getItem<string>(from);
    }
    if (typeof value !== 'string') {
      return;
    }
    await draftStore.setItem(toKey, value);
    await Promise.all([draftStore.removeItem(fromKey), draftStore.removeItem(from)]);
  } catch (error) {
    console.error('Failed to rename board draft:', from, to, error);
  }
};

// ---------------------------------------------------------------------------
// 视口状态（localStorage，轻量；同步读，恢复路径无 IO 等待）
// ---------------------------------------------------------------------------

/** 从 localStorage 读单个存储键的视口（无效数据返回 null） */
const readViewportFromStorage = (storageKey: string): Viewport | null => {
  try {
    const raw = window.localStorage.getItem(BOARD_VIEWPORT_STORAGE_PREFIX + storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    return isUsableViewport(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/** 旧版纯路径键视口：读到即迁移到复合键（localStorage 同步操作，尽力而为） */
const readLegacyViewportAndMigrate = (path: string): Viewport | null => {
  const legacy = readViewportFromStorage(path);
  if (legacy) {
    try {
      window.localStorage.removeItem(BOARD_VIEWPORT_STORAGE_PREFIX + path);
      window.localStorage.setItem(
        BOARD_VIEWPORT_STORAGE_PREFIX + toStorageKey(path),
        JSON.stringify({ zoom: legacy.zoom, origination: legacy.origination ?? null })
      );
    } catch {
      // 迁移失败不影响本次读取
    }
  }
  return legacy;
};

export const getBoardViewport = (path: string): Viewport | null => {
  return readViewportFromStorage(toStorageKey(path)) ?? readLegacyViewportAndMigrate(path);
};

const writeViewportNow = (key: string) => {
  const viewport = pendingViewports.get(key);
  pendingViewports.delete(key);
  if (!viewport) {
    return;
  }
  try {
    window.localStorage.setItem(
      BOARD_VIEWPORT_STORAGE_PREFIX + key,
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
  const key = toStorageKey(path);
  pendingViewports.set(key, viewport);
  if (viewportTimers.has(key)) {
    return;
  }
  viewportTimers.set(
    key,
    setTimeout(() => {
      viewportTimers.delete(key);
      writeViewportNow(key);
    }, BOARD_VIEWPORT_DEBOUNCE_MS)
  );
};

/** 清除视口状态；旧版纯路径键一并清除，防止升级前的残留视口复活 */
export const clearBoardViewport = (path: string) => {
  const key = toStorageKey(path);
  cancelViewportTimer(key);
  pendingViewports.delete(key);
  try {
    window.localStorage.removeItem(BOARD_VIEWPORT_STORAGE_PREFIX + key);
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
  const fromKey = toStorageKey(from);
  const toKey = toStorageKey(to);
  cancelViewportTimer(fromKey);
  const pending = pendingViewports.get(fromKey);
  pendingViewports.delete(fromKey);
  if (pending) {
    pendingViewports.set(toKey, pending);
  }
  try {
    // 复合键与旧版纯路径键都迁到同一目标复合键（复合键已有值时优先）
    const raw =
      window.localStorage.getItem(BOARD_VIEWPORT_STORAGE_PREFIX + fromKey) ??
      window.localStorage.getItem(BOARD_VIEWPORT_STORAGE_PREFIX + from);
    window.localStorage.removeItem(BOARD_VIEWPORT_STORAGE_PREFIX + fromKey);
    window.localStorage.removeItem(BOARD_VIEWPORT_STORAGE_PREFIX + from);
    if (raw !== null) {
      window.localStorage.setItem(BOARD_VIEWPORT_STORAGE_PREFIX + toKey, raw);
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
