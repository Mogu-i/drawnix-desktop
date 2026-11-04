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
  /** 文件类型（扩展名）：drawnix / md / table */
  ext: string;
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
  /** 当前文件的类型（扩展名），决定主内容区渲染白板还是文档编辑器 */
  fileType: TauriFileType;
  /** 当前文件是否有未保存的修改 */
  dirty: boolean;
};

/** 受支持的文件类型：白板 / Markdown / 表格 */
export type TauriFileType = 'drawnix' | 'md' | 'table';

const DEFAULT_FILE_TYPE: TauriFileType = 'drawnix';

/** 新建文件对话框选项（表格类型可指定初始行列数） */
export type CreateTauriFileOptions = {
  rows?: number;
  cols?: number;
};

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export const normalizeTauriFileName = (rawName: string) => {
  const name = rawName
    .trim()
    .replace(/[/\\]/g, '-')
    // 用户粘贴带扩展名的文件名时剥掉受支持的扩展名
    .replace(/\.(drawnix|md|table)$/i, '');
  return name;
};

const invokeTauri = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
};

export const listTauriTree = (): Promise<TauriTreeResult> => {
  return invokeTauri<TauriTreeResult>('list_tree');
};

export const readTauriFile = (
  path: string,
  fileType: TauriFileType = DEFAULT_FILE_TYPE
): Promise<string> => {
  return invokeTauri<string>('read_drawnix_file', { path, ext: fileType });
};

export const writeTauriFile = (
  path: string,
  content: string,
  fileType: TauriFileType = DEFAULT_FILE_TYPE
): Promise<void> => {
  return invokeTauri<void>('write_drawnix_file', { path, content, ext: fileType });
};

/** 重命名文件（保持在原目录内） */
export const renameTauriFile = (
  path: string,
  newName: string,
  fileType: TauriFileType = DEFAULT_FILE_TYPE
): Promise<void> => {
  return invokeTauri<void>('rename_drawnix_file', { path, newName, ext: fileType });
};

export const deleteTauriFile = (
  path: string,
  fileType: TauriFileType = DEFAULT_FILE_TYPE
): Promise<void> => {
  return invokeTauri<void>('delete_drawnix_file', { path, ext: fileType });
};

export type TauriTrashEntry = {
  trashFile: string;
  /** 删除前的原始路径 */
  path: string;
  deletedAt: number;
  ext: string;
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
export const createTauriFolder = (parent: string | null, name: string): Promise<void> => {
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
  targetDir: string | null,
  fileType: TauriFileType = DEFAULT_FILE_TYPE
): Promise<void> => {
  return invokeTauri<void>('move_file_to_dir', { path, targetDir, ext: fileType });
};

/** 移动分组到目标目录；targetDir 为 null 表示移到根目录 */
export const moveTauriFolderToDir = (path: string, targetDir: string | null): Promise<void> => {
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
  fileType: DEFAULT_FILE_TYPE,
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

export const setCurrentTauriFile = (
  name: string | null,
  fileType: TauriFileType = DEFAULT_FILE_TYPE
) => {
  // 打开其他文件时丢弃未完成的 DocEditor 会话，避免关闭时恢复过期路径
  if (docEditorSession && name !== docEditorSession.docPath) {
    docEditorSession = null;
  }
  // 打开文件时解除该路径的历史保存屏蔽（如旧路径曾删除/移动后重建同名文件），
  // 避免残留屏蔽静默丢弃新文件的保存
  if (name) {
    resumeTauriFileSave(name);
  }
  suppressDirtyUntil = Date.now() + 500;
  setState({ currentFile: name, fileType, dirty: false });
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

/**
 * 已删除/已改名/已移动文件的保存屏蔽表：文档编辑器卸载时会立即回写文件，
 * 若文件已被删除或挪走，回写会把旧文件重新创建出来，这里按路径屏蔽保存
 */
const saveSuppressedPaths = new Set<string>();

export const suppressTauriFileSave = (path: string) => {
  saveSuppressedPaths.add(path);
};

/** 重新打开同名路径的文件时恢复自动保存 */
export const resumeTauriFileSave = (path: string) => {
  saveSuppressedPaths.delete(path);
};

export const isTauriFileSaveSuppressed = (path: string) =>
  saveSuppressedPaths.has(path);

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

/** Markdown 文件初始内容：一行标题占位 */
export const buildEmptyMarkdownContent = (): string => '';

/** 表格文件数据结构（.table） */
export type TableCellBorder = {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
  color?: string;
};

export type TableCellAlign = 'left' | 'center' | 'right';

export type TableCellVAlign = 'top' | 'middle' | 'bottom';

export type TableCellStyle = {
  fontSize?: number;
  color?: string;
  bg?: string;
  border?: TableCellBorder | null;
  /** 单元格文字水平对齐 */
  align?: TableCellAlign;
  /** 单元格文字垂直对齐 */
  valign?: TableCellVAlign;
  /** 加粗 */
  bold?: boolean;
  /** 下划线 */
  underline?: boolean;
  /** 删除线 */
  strikethrough?: boolean;
};

export type TableCellData = TableCellStyle & {
  text: string;
  /** 合并单元格时主单元格的跨行/跨列数 */
  rowSpan?: number;
  colSpan?: number;
  /** 被合并覆盖的隐藏单元格 */
  hidden?: boolean;
};

export type TableFileData = {
  type: 'drawnix-table';
  version: number;
  rows: number;
  cols: number;
  cells: TableCellData[][];
  colWidths?: number[];
  /** 每行行高（px），未设置的行回退到默认行高 */
  rowHeights?: number[];
};

export const TABLE_FILE_VERSION = 1;

export const buildEmptyTableCell = (): TableCellData => ({ text: '' });

export const buildEmptyTableContent = (rows = 3, cols = 3): string => {
  const data: TableFileData = {
    type: 'drawnix-table',
    version: TABLE_FILE_VERSION,
    rows,
    cols,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, buildEmptyTableCell)),
  };
  return JSON.stringify(data, null, 2);
};

export const parseTableFileContent = (content: string): TableFileData => {
  const data = JSON.parse(content) as TableFileData;
  if (!data || data.type !== 'drawnix-table' || !Array.isArray(data.cells)) {
    throw new Error('invalid table file');
  }
  return data;
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
  // 文件已被删除/移动/重命名（旧路径保存被屏蔽）时跳过回写，
  // 只清脏标记，避免把旧文件在旧位置重新创建出来
  if (isTauriFileSaveSuppressed(filePath)) {
    suppressDirtyUntil = Date.now() + 500;
    setState({ dirty: false });
    return filePath;
  }
  // 当前打开的是 Markdown/表格文件时，画板内容与其无关，
  // 只清除脏标记，避免把画板 JSON 写入文档文件导致内容损坏
  if (state.fileType !== 'drawnix') {
    suppressDirtyUntil = Date.now() + 500;
    setState({ dirty: false });
    return filePath;
  }
  await writeTauriFile(filePath, serializeAsJSON(board));
  suppressDirtyUntil = Date.now() + 500;
  setState({ dirty: false });
  return filePath;
};

/** 文档编辑器（Markdown/表格）保存完成后清除脏标记 */
export const clearTauriFileDirty = () => {
  suppressDirtyUntil = Date.now() + 500;
  setState({ dirty: false });
};

// ---------------------------------------------------------------------------
// DocEditor 会话：从白板（如双击文件引用卡片）进入文档编辑器时，
// 记录进入前的当前白板文件，关闭编辑器后恢复白板上下文
// ---------------------------------------------------------------------------

type DocEditorSession = {
  /** 打开的文档相对路径 */
  docPath: string;
  /** 进入编辑器前的当前文件，null 表示之前未打开任何文件 */
  returnFile: { path: string; fileType: TauriFileType } | null;
};

let docEditorSession: DocEditorSession | null = null;

/** 打开 Markdown/表格文件的文档编辑器，并记录关闭后需要恢复的文件 */
export const openTauriDocEditor = (path: string, fileType: 'md' | 'table') => {
  const current = state.currentFile;
  docEditorSession = {
    docPath: path,
    returnFile:
      current && current !== path
        ? { path: current, fileType: state.fileType }
        : null,
  };
  setCurrentTauriFile(path, fileType);
};

/** 关闭文档编辑器；若是从白板进入则恢复之前的白板文件上下文 */
export const closeTauriDocEditor = () => {
  const session = docEditorSession;
  docEditorSession = null;
  if (session?.returnFile) {
    setCurrentTauriFile(session.returnFile.path, session.returnFile.fileType);
  } else {
    setCurrentTauriFile(null);
  }
};

/**
 * 文档编辑器会话中的文档被移动/重命名后同步会话路径；
 * 否则 setCurrentTauriFile(newPath) 会因路径不匹配丢弃会话，
 * 关闭编辑器后无法恢复白板上下文
 */
export const retargetDocEditorSessionPath = (from: string, to: string) => {
  if (docEditorSession?.docPath === from) {
    docEditorSession = { ...docEditorSession, docPath: to };
  }
};
