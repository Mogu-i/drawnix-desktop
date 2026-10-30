import { useSyncExternalStore } from 'react';
import { PlaitBoard } from '@plait/core';
import { VERSIONS } from '../constants';
import { DrawnixExportedType } from './types';
import { isValidDrawnixData, serializeAsJSON } from './json';

export type TauriTreeFileEntry = {
  /** 相对路径（不含扩展名），如 `分组A/未命名` */
  path: string;
  modifiedAt: number;
  createdAt: number;
};

export type TauriTreeDirEntry = {
  /** 子文件夹的相对路径，如 `分组A`、`分组A/子分组` */
  path: string;
  createdAt: number;
};

export type TauriTreeResult = {
  dirs: TauriTreeDirEntry[];
  files: TauriTreeFileEntry[];
  /** 各目录下条目的自定义显示顺序 */
  order: TauriOrderMap;
};

export type TauriFileState = {
  /** 当前打开的 Tauri 文件相对路径（不含扩展名），null 表示未打开任何文件 */
  currentFile: string | null;
  /** 当前文件是否有未保存的修改 */
  dirty: boolean;
};

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

const DRAWNIX_FILE_EXTENSION = '.drawnix';

export const normalizeTauriFileName = (rawName: string) => {
  const name = rawName
    .trim()
    .replace(/[/\\]/g, '-')
    .replace(new RegExp(`\\${DRAWNIX_FILE_EXTENSION}$`, 'i'), '');
  return name;
};

const invokeTauri = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
};

export const listTauriTree = (): Promise<TauriTreeResult> => {
  return invokeTauri<TauriTreeResult>('list_tree');
};

export const readTauriFile = (path: string): Promise<string> => {
  return invokeTauri<string>('read_drawnix_file', { path });
};

export const writeTauriFile = (path: string, content: string): Promise<void> => {
  return invokeTauri<void>('write_drawnix_file', { path, content });
};

/** 重命名文件（保持在原目录内） */
export const renameTauriFile = (path: string, newName: string): Promise<void> => {
  return invokeTauri<void>('rename_drawnix_file', { path, newName });
};

export const deleteTauriFile = (path: string): Promise<void> => {
  return invokeTauri<void>('delete_drawnix_file', { path });
};

export type TauriTrashEntry = {
  trashFile: string;
  /** 删除前的原始路径 */
  path: string;
  deletedAt: number;
};
export const listTauriTrashFiles = (): Promise<TauriTrashEntry[]> => {
  return invokeTauri<TauriTrashEntry[]>('list_trash_files');
};

export const restoreTauriFile = (trashFile: string): Promise<void> => {
  return invokeTauri<void>('restore_drawnix_file', { trashFile });
};

/** 清空回收站，物理删除所有回收站文件，返回删除数量 */
export const emptyTauriTrash = (): Promise<number> => {
  return invokeTauri<number>('empty_trash');
};

// ---------------------------------------------------------------------------
// 分组（物理子文件夹）与条目顺序
// ---------------------------------------------------------------------------

/** 某个目录下条目的自定义显示顺序；键为目录相对路径，'' 表示根目录 */
export type TauriDirOrder = {
  dirs: string[];
  files: string[];
};

export type TauriOrderMap = Record<string, TauriDirOrder>;
export const createTauriFolder = (
  parent: string | null,
  name: string
): Promise<void> => {
  return invokeTauri<void>('create_folder', { parent, name });
};

export const renameTauriFolder = (path: string, newName: string): Promise<void> => {
  return invokeTauri<void>('rename_folder', { path, newName });
};

/** 删除分组：组内文件移入回收站，目录被移除 */
export const deleteTauriFolder = (path: string): Promise<void> => {
  return invokeTauri<void>('delete_folder', { path });
};

/** 移动文件到目标目录；targetDir 为 null 表示移到根目录 */
export const moveTauriFileToDir = (
  path: string,
  targetDir: string | null
): Promise<void> => {
  return invokeTauri<void>('move_file_to_dir', { path, targetDir });
};

/** 移动分组到目标目录；targetDir 为 null 表示移到根目录 */
export const moveTauriFolderToDir = (
  path: string,
  targetDir: string | null
): Promise<void> => {
  return invokeTauri<void>('move_folder_to_dir', { path, targetDir });
};

/** 拖动排序后持久化各目录的条目顺序 */
export const reorderTauriItems = (order: TauriOrderMap): Promise<void> => {
  return invokeTauri<void>('reorder_items', { order });
};

export const getTrashRetentionDays = (): Promise<number> => {
  return invokeTauri<number>('get_trash_retention_days');
};

export const setTrashRetentionDays = (days: number): Promise<void> => {
  return invokeTauri<void>('set_trash_retention_days', { days });
};

export type SetDataDirResult = {
  dataDir: string;
  migratedFiles: number;
};

export const getDataDir = (): Promise<string> => {
  return invokeTauri<string>('get_data_dir');
};

export const getDefaultDataDir = (): Promise<string> => {
  return invokeTauri<string>('get_default_data_dir');
};

/** 打开系统文件夹选择器，返回选中的路径，取消时返回 null */
export const pickDataDir = (): Promise<string | null> => {
  return invokeTauri<string | null>('pick_folder');
};

/** 切换数据存储路径，并将现有 .drawnix 文件迁移到新路径 */
export const setDataDir = (path: string): Promise<SetDataDirResult> => {
  return invokeTauri<SetDataDirResult>('set_data_dir', { path });
};

/** 数据存储路径变更后广播，文件面板监听后刷新文件列表 */
export const DATA_DIR_CHANGED_EVENT = 'drawnix:data-dir-changed';

export const notifyDataDirChanged = () => {
  window.dispatchEvent(new CustomEvent(DATA_DIR_CHANGED_EVENT));
};

/** 文件列表发生变化（新建等）后广播，文件面板监听后刷新文件列表 */
export const TAURI_FILES_CHANGED_EVENT = 'drawnix:tauri-files-changed';

export const notifyTauriFilesChanged = () => {
  window.dispatchEvent(new CustomEvent(TAURI_FILES_CHANGED_EVENT));
};

// ---------------------------------------------------------------------------
// 当前文件状态（模块级 store，供菜单保存项与文件面板共享）
// ---------------------------------------------------------------------------

let state: TauriFileState = {
  currentFile: null,
  dirty: false,
};

const listeners = new Set<() => void>();

// 加载文件内容到画布时会触发若干次 board change，为避免误标脏，
// 在加载前后的一小段时间内跳过脏标记。
let suppressDirtyUntil = 0;

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setState = (partial: Partial<TauriFileState>) => {
  state = { ...state, ...partial };
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getTauriFileState = (): TauriFileState => state;

export const useTauriFileState = (): TauriFileState => {
  return useSyncExternalStore(subscribe, getTauriFileState);
};

export const getTauriCurrentFile = (): string | null => state.currentFile;

export const setCurrentTauriFile = (name: string | null) => {
  suppressDirtyUntil = Date.now() + 500;
  setState({ currentFile: name, dirty: false });
};

export const markTauriFileDirty = () => {
  if (!state.currentFile || state.dirty || Date.now() < suppressDirtyUntil) {
    return;
  }
  setState({ dirty: true });
};

export const suppressTauriDirty = (durationMs = 500) => {
  suppressDirtyUntil = Date.now() + durationMs;
};

export const buildEmptyDrawnixContent = (): string => {
  return JSON.stringify(
    {
      type: DrawnixExportedType.drawnix,
      version: VERSIONS.drawnix,
      source: 'web',
      elements: [],
      viewport: { zoom: 1 },
    },
    null,
    2
  );
};

export const parseTauriFileContent = (
  content: string
): { elements: unknown[]; viewport?: any; theme?: any } => {
  const data = JSON.parse(content);
  if (!isValidDrawnixData(data)) {
    throw new Error('invalid drawnix file');
  }
  return { elements: data.elements, viewport: data.viewport, theme: data.theme };
};

export const saveToTauriFile = async (board: PlaitBoard, path?: string): Promise<string> => {
  const filePath = path ?? state.currentFile;
  if (!filePath) {
    throw new Error('no tauri file opened');
  }
  await writeTauriFile(filePath, serializeAsJSON(board));
  suppressDirtyUntil = Date.now() + 500;
  setState({ dirty: false });
  return filePath;
};
