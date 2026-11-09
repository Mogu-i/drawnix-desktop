import { useEffect, useRef, useState } from 'react';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { isTauriEnvironment } from '../../data/tauri-file';
import {
  minimizeTauriWindow,
  toggleTauriWindowMaximize,
  watchTauriWindowFocus,
  watchTauriWindowMaximized,
} from '../../data/tauri-window';
import { CloseIcon, WinMaxIcon, WinMinIcon, WinRestoreIcon } from '../icons';
import './window-controls.scss';

/**
 * 桌面窗口三钮（最小化 / 最大化或向下还原 / 关闭），
 * 真实调用 Tauri 窗口 IPC；非 Tauri 环境不渲染，不伪装系统窗口行为。
 * 关闭按钮只触发退出确认流程，由确认弹窗决定是否真正关闭
 */
export const WindowControls = ({ onRequestClose }: { onRequestClose: () => void }) => {
  const { t } = useI18n();
  const { showToast } = useDrawnix();
  const [isTauri] = useState(() => isTauriEnvironment());
  const [maximized, setMaximized] = useState(false);
  const minimizedRef = useRef(false);

  useEffect(() => {
    if (!isTauri) {
      return;
    }
    let cancelled = false;
    let cleanupResized: (() => void) | undefined;
    let cleanupFocused: (() => void) | undefined;
    (async () => {
      cleanupResized = await watchTauriWindowMaximized((value) => {
        if (!cancelled) {
          setMaximized(value);
        }
      });
      cleanupFocused = await watchTauriWindowFocus((focused) => {
        // 从最小化恢复时重新获得焦点，按 D4 文案提示「窗口已恢复」
        if (focused && minimizedRef.current && !cancelled) {
          minimizedRef.current = false;
          showToast({ message: t('workbench.window.recoveredToast') });
        }
      });
    })();
    return () => {
      cancelled = true;
      cleanupResized?.();
      cleanupFocused?.();
    };
  }, [isTauri, showToast, t]);

  if (!isTauri) {
    return null;
  }

  return (
    <div className="window-controls" role="group" aria-label={t('workbench.window.group')}>
      <button
        type="button"
        className="window-controls__btn"
        title={t('workbench.window.minimize')}
        aria-label={t('workbench.window.minimize')}
        onClick={() => {
          minimizedRef.current = true;
          minimizeTauriWindow();
        }}
      >
        {WinMinIcon}
      </button>
      <button
        type="button"
        className="window-controls__btn"
        title={
          maximized ? t('workbench.window.restore') : t('workbench.window.maximize')
        }
        aria-label={
          maximized ? t('workbench.window.restore') : t('workbench.window.maximize')
        }
        onClick={() => {
          showToast({
            message: maximized
              ? t('workbench.window.restoredToast')
              : t('workbench.window.maximizedToast'),
          });
          toggleTauriWindowMaximize();
        }}
      >
        {maximized ? WinRestoreIcon : WinMaxIcon}
      </button>
      <button
        type="button"
        className="window-controls__btn window-controls__btn--close"
        title={t('workbench.window.close')}
        aria-label={t('workbench.window.close')}
        onClick={onRequestClose}
      >
        {CloseIcon}
      </button>
    </div>
  );
};
