import { useState } from 'react';
import { openCreateDialog } from '../../data/workbench-ui';
import { isTauriEnvironment, useTauriFileState } from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import './welcome-page.scss';

// Tauri 桌面端启动欢迎页（E6）：未打开任何文件时覆盖在画布区上方，
// 新建入口统一走 workbench-ui 的新建弹窗（与页签栏、文件面板共用同一实例）。
export const WelcomePage = () => {
  const { t } = useI18n();
  const { currentFile } = useTauriFileState();
  const [isTauri] = useState(() => isTauriEnvironment());

  if (!isTauri || currentFile) {
    return null;
  }

  return (
    <div className="welcome-page">
      <h1 className="welcome-page__title">{t('welcome.emptyTitle')}</h1>
      <p className="welcome-page__description">{t('welcome.emptyDescription')}</p>
      <button
        type="button"
        className="welcome-page__new-button"
        onClick={() => openCreateDialog()}
      >
        {t('welcome.newFile')}
      </button>
    </div>
  );
};
