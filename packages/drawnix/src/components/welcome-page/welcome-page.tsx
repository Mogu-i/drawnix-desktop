import { useState } from 'react';
import { useBoard, useListRender } from '@plait-board/react-board';
import {
  BoardTransforms,
  PlaitBoard,
  PlaitElement,
  PlaitTheme,
  Viewport,
} from '@plait/core';
import {
  buildEmptyDrawnixContent,
  isTauriEnvironment,
  notifyTauriFilesChanged,
  setCurrentTauriFile,
  suppressTauriDirty,
  useTauriFileState,
  writeTauriFile,
} from '../../data/tauri-file';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { CreateFileDialog } from '../create-file-dialog/create-file-dialog';
import './welcome-page.scss';

// Tauri 桌面端启动欢迎页：未打开任何文件时覆盖在画布区上方，
// 引导用户新建文件或从左侧边栏打开已有文件。
export const WelcomePage = () => {
  const board = useBoard();
  const listRender = useListRender();
  const { showToast } = useDrawnix();
  const { t } = useI18n();
  const { currentFile } = useTauriFileState();
  const [isTauri] = useState(() => isTauriEnvironment());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const container = PlaitBoard.getBoardContainer(board);

  if (!isTauri || currentFile) {
    return null;
  }

  const clearAndLoad = (
    elements: PlaitElement[],
    viewport?: Viewport,
    theme?: PlaitTheme
  ) => {
    suppressTauriDirty();
    board.children = elements;
    board.viewport = viewport || { zoom: 1 };
    if (theme) {
      board.theme = theme;
    }
    listRender.update(board.children, {
      board: board,
      parent: board,
      parentG: PlaitBoard.getElementHost(board),
    });
    BoardTransforms.fitViewport(board);
  };

  const handleCreateFile = async (name: string, dirPath: string | null) => {
    try {
      const path = dirPath ? `${dirPath}/${name}` : name;
      await writeTauriFile(path, buildEmptyDrawnixContent());
      setCurrentTauriFile(path);
      notifyTauriFilesChanged();
      clearAndLoad([]);
    } catch (error) {
      console.error('Failed to create drawnix file:', error);
      showToast({ message: t('toast.tauriFile.saveFailed') });
    }
  };

  return (
    <div className="welcome-page">
      <h1 className="welcome-page__title">{t('welcome.title')}</h1>
      <p className="welcome-page__description">{t('welcome.description')}</p>
      <button
        type="button"
        className="welcome-page__new-button"
        onClick={() => setCreateDialogOpen(true)}
      >
        {t('welcome.newFile')}
      </button>
      <p className="welcome-page__hint">{t('welcome.sidebarHint')}</p>
      <CreateFileDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        container={container}
        onCreate={handleCreateFile}
      ></CreateFileDialog>
    </div>
  );
};
