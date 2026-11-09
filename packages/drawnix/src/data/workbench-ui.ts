import { useSyncExternalStore } from 'react';

/**
 * 工作台 UI 状态（跨组件共享）：新建弹窗、文件面板抽屉、退出确认。
 * 沿用 tauri-file.ts 的模块级 store + useSyncExternalStore 模式，
 * 供页签栏（TabBar）、文件面板与欢迎页共用
 */
export type CreateDialogPreset = 'board' | 'table' | 'md' | 'folder' | null;

export type WorkbenchUiState = {
  /** 新建弹窗：null 关闭；presetType 非空时预选该类型并隐藏类型字段 */
  createDialog: { presetType: CreateDialogPreset } | null;
  /** 窄屏文件面板抽屉是否展开（桌面布局恒为 false） */
  sidebarOpen: boolean;
  /** 退出确认弹窗是否打开（窗口关闭按钮 / Alt+F4 触发） */
  exitConfirmOpen: boolean;
};

let state: WorkbenchUiState = {
  createDialog: null,
  sidebarOpen: false,
  exitConfirmOpen: false,
};

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setState = (partial: Partial<WorkbenchUiState>) => {
  state = { ...state, ...partial };
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getWorkbenchUiState = (): WorkbenchUiState => state;

export const useWorkbenchUi = (): WorkbenchUiState => {
  return useSyncExternalStore(subscribe, getWorkbenchUiState);
};

/** 打开新建弹窗；presetType 非空时预选类型（不再要求用户二次选择） */
export const openCreateDialog = (presetType: CreateDialogPreset = null) => {
  setState({ createDialog: { presetType } });
};

export const closeCreateDialog = () => {
  setState({ createDialog: null });
};

export const setSidebarOpen = (open: boolean) => {
  setState({ sidebarOpen: open });
};

export const setExitConfirmOpen = (open: boolean) => {
  setState({ exitConfirmOpen: open });
};
