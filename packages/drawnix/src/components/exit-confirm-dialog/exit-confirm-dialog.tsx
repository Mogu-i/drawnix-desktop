import { useMemo } from 'react';
import { useBoard } from '@plait-board/react-board';
import { Dialog, DialogContent } from '../dialog/dialog';
import { useI18n } from '../../i18n';
import { formatTemplate } from '../../i18n/format';
import type { Translations } from '../../i18n/types';
import {
  flushAllTauriDirtyFiles,
  useTauriFileState,
  type TauriFileType,
} from '../../data/tauri-file';
import { closeTauriWindow } from '../../data/tauri-window';
import { setExitConfirmOpen, useWorkbenchUi } from '../../data/workbench-ui';
import { serializeAsJSON } from '../../data/json';
import './exit-confirm-dialog.scss';

const fileTypeLabelKey: Record<TauriFileType, keyof Translations> = {
  drawnix: 'filePanel.fileType.drawnix',
  table: 'filePanel.fileType.table',
  md: 'filePanel.fileType.md',
};

/**
 * 退出确认弹窗（D5）：按 dirty 动态列出未保存文件（橙点 + 名称 + 类型），
 * 文案与实际行为一致——退出前尽力保存，内容不会丢失；
 * 确认后 flush 全部脏文件再真实关闭 Tauri 窗口
 */
export const ExitConfirmDialog = ({ container }: { container: HTMLElement | null }) => {
  const { exitConfirmOpen } = useWorkbenchUi();
  const { openTabs, dirty } = useTauriFileState();
  const { t } = useI18n();
  const board = useBoard();

  const dirtyEntries = useMemo(
    () =>
      Object.keys(dirty).map((path) => {
        const tab = openTabs.find((item) => item.path === path);
        return {
          path,
          name: path.slice(path.lastIndexOf('/') + 1),
          fileType: tab?.fileType ?? 'drawnix',
        };
      }),
    [dirty, openTabs]
  );

  const handleConfirmExit = async () => {
    setExitConfirmOpen(false);
    // 尽力保存全部未保存文件（单个失败不阻断，失败者保留脏标记），
    // 随后放行关闭拦截并真实关闭窗口
    await flushAllTauriDirtyFiles(() => serializeAsJSON(board));
    await closeTauriWindow();
  };

  return (
    <Dialog open={exitConfirmOpen} onOpenChange={(open) => setExitConfirmOpen(open)}>
      <DialogContent className="exit-confirm" container={container}>
        <h2 className="exit-confirm__title">{t('workbench.exit.title')}</h2>
        <p className="exit-confirm__description">
          {dirtyEntries.length > 0
            ? formatTemplate(t('workbench.exit.dirtyDescription'), {
                count: dirtyEntries.length,
              })
            : t('workbench.exit.cleanDescription')}
        </p>
        {dirtyEntries.length > 0 && (
          <ul className="exit-confirm__list">
            {dirtyEntries.map((entry) => (
              <li key={entry.path} className="exit-confirm__item">
                <span className="exit-confirm__dot" aria-hidden="true"></span>
                <span className="exit-confirm__name">{entry.name}</span>
                <span className="exit-confirm__type">
                  {t(fileTypeLabelKey[entry.fileType])}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="exit-confirm__actions">
          <button
            type="button"
            className="exit-confirm__button exit-confirm__button--cancel"
            onClick={() => setExitConfirmOpen(false)}
          >
            {t('workbench.exit.cancel')}
          </button>
          <button
            type="button"
            className="exit-confirm__button exit-confirm__button--ok"
            autoFocus
            onClick={handleConfirmExit}
          >
            {t('workbench.exit.confirm')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
