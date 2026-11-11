/**
 * Tauri 窗口控制封装：真实调用系统窗口的最小化/最大化/关闭。
 * 非 Tauri 环境下这些函数为空操作，调用方需用 isTauriEnvironment() 门控；
 * 浏览器开发/预览模式下不伪装成系统窗口行为
 */
import { isTauriEnvironment } from './tauri-file';

type TauriWindow = import('@tauri-apps/api/window').Window;

let windowPromise: Promise<TauriWindow> | null = null;

const getTauriWindow = async (): Promise<TauriWindow | null> => {
  if (!isTauriEnvironment()) {
    return null;
  }
  if (!windowPromise) {
    windowPromise = import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
      getCurrentWindow()
    );
  }
  return windowPromise;
};

export const minimizeTauriWindow = async (): Promise<void> => {
  const win = await getTauriWindow();
  await win?.minimize();
};

export const toggleTauriWindowMaximize = async (): Promise<void> => {
  const win = await getTauriWindow();
  await win?.toggleMaximize();
};

/** 确认退出后的真实关闭：跳过关闭拦截直接销毁窗口 */
export const closeTauriWindow = async (): Promise<void> => {
  const win = await getTauriWindow();
  if (!win) {
    return;
  }
  allowNextClose = true;
  await win.close();
};

export const isTauriWindowMaximized = async (): Promise<boolean> => {
  const win = await getTauriWindow();
  return (await win?.isMaximized()) ?? false;
};

/** close() 前置放行标记：跳过一次 close-requested 拦截，避免确认后无法真正关闭 */
let allowNextClose = false;

/**
 * 监听窗口尺寸变化，把最大化状态同步到 <html> 的 data 属性，
 * 供 CSS 切换窗口外框（圆角 + 外留白）。返回取消监听函数
 */
export const watchTauriWindowMaximized = async (
  onChanged?: (maximized: boolean) => void
): Promise<() => void> => {
  const win = await getTauriWindow();
  if (!win) {
    return () => {};
  }
  const apply = async () => {
    try {
      const maximized = await win.isMaximized();
      document.documentElement.dataset.wbMaximized = maximized ? 'true' : 'false';
      onChanged?.(maximized);
    } catch {
      // 窗口销毁过程中的读取失败可以忽略
    }
  };
  const unlistenResized = await win.onResized(apply);
  await apply();
  return () => {
    unlistenResized();
  };
};

/**
 * 监听窗口焦点变化；窗口从最小化恢复时会重新获得焦点，
 * 供「窗口已恢复」反馈使用。返回取消监听函数
 */
export const watchTauriWindowFocus = async (
  onFocused: (focused: boolean) => void
): Promise<() => void> => {
  const win = await getTauriWindow();
  if (!win) {
    return () => {};
  }
  // Tauri v2 的 Window 类不提供 onFocused 方法，改用窗口焦点事件名监听
  const unlistenFocus = await win.listen('tauri://focus', () => onFocused(true));
  const unlistenBlur = await win.listen('tauri://blur', () => onFocused(false));
  return () => {
    unlistenFocus();
    unlistenBlur();
  };
};

/**
 * 拦截窗口关闭请求（关闭按钮 / Alt+F4 / 系统关机），转交应用内退出确认流程。
 * 返回取消监听函数
 */
export const interceptTauriWindowClose = async (
  onRequestClose: () => void
): Promise<() => void> => {
  const win = await getTauriWindow();
  if (!win) {
    return () => {};
  }
  const unlisten = await win.onCloseRequested((event) => {
    if (allowNextClose) {
      allowNextClose = false;
      return;
    }
    event.preventDefault();
    onRequestClose();
  });
  return unlisten;
};
