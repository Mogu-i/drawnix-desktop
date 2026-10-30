import { useState } from 'react';
import { useBoard } from '@plait-board/react-board';
import { PlaitBoard } from '@plait/core';
import classNames from 'classnames';
import { ArchiveIcon, SettingsIcon } from '../icons';
import { SettingsDialog } from '../settings-dialog/settings-dialog';
import { useI18n } from '../../i18n';
import './sidebar-footer.scss';

export const SidebarFooter = ({
  trashActive,
  onTrashToggle,
}: {
  trashActive: boolean;
  onTrashToggle: () => void;
}) => {
  const board = useBoard();
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const container = PlaitBoard.getBoardContainer(board);

  return (
    <>
      <div className="sidebar-footer">
        <button
          type="button"
          className={classNames('sidebar-footer__button', {
            'sidebar-footer__button--active': trashActive,
          })}
          title={t('filePanel.trash')}
          aria-label={t('filePanel.trash')}
          onClick={onTrashToggle}
        >
          {ArchiveIcon}
        </button>
        <div className="sidebar-footer__spacer"></div>
        <button
          type="button"
          className="sidebar-footer__button"
          title={t('settings.title')}
          aria-label={t('settings.title')}
          onClick={() => setSettingsOpen(true)}
        >
          {SettingsIcon}
        </button>
      </div>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        container={container}
      ></SettingsDialog>
    </>
  );
};
