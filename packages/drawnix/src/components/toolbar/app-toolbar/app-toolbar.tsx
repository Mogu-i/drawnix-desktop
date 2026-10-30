import { useBoard } from '@plait-board/react-board';
import Stack from '../../stack';
import { ToolButton } from '../../tool-button';
import {
  DuplicateIcon,
  MenuIcon,
  RedoIcon,
  SaveIcon,
  TrashIcon,
  UndoIcon,
} from '../../icons';
import classNames from 'classnames';
import {
  ATTACHED_ELEMENT_CLASS_NAME,
  deleteFragment,
  duplicateElements,
  getSelectedElements,
  PlaitBoard,
} from '@plait/core';
import { Island } from '../../island';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover/popover';
import { useState } from 'react';
import {
  CleanBoard,
  OpenFile,
  SaveAsFile,
  SaveAsImage,
  SaveTauriFile,
  SaveToFile,
  Socials,
} from './app-menu-items';
import { LanguageSwitcherMenu } from './language-switcher-menu';
import Menu from '../../menu/menu';
import MenuSeparator from '../../menu/menu-separator';
import { useI18n } from '../../../i18n';
import { useDrawnix } from '../../../hooks/use-drawnix';
import {
  isTauriEnvironment,
  saveToTauriFile,
  useTauriFileState,
} from '../../../data/tauri-file';

export const AppToolbar = () => {
  const board = useBoard();
  const { t } = useI18n();
  const { showToast } = useDrawnix();
  const container = PlaitBoard.getBoardContainer(board);
  const selectedElements = getSelectedElements(board);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [isTauri] = useState(() => isTauriEnvironment());
  const { currentFile, dirty } = useTauriFileState();
  const isUndoDisabled = board.history.undos.length <= 0;
  const isRedoDisabled = board.history.redos.length <= 0;
  // 无打开文件或无未保存修改时保存按钮禁用
  const isSaveDisabled = !currentFile || !dirty;

  // 桌面端顶部菜单按钮替换为保存按钮：另存为、导出图片等操作移至文件右键菜单
  const handleSaveTauriFile = async () => {
    if (!currentFile) {
      return;
    }
    try {
      await saveToTauriFile(board);
      showToast({ message: t('toast.tauriFile.saved') });
    } catch (error) {
      console.error('Failed to save drawnix file:', error);
      showToast({ message: t('toast.tauriFile.saveFailed') });
    }
  };

  return (
    <Island padding={1} className={classNames('app-toolbar', ATTACHED_ELEMENT_CLASS_NAME)}>
      <Stack.Row gap={1}>
        {isTauri ? (
          <ToolButton
            key={0}
            type="icon"
            visible={true}
            icon={SaveIcon}
            title={t('menu.saveTauriFile')}
            aria-label={t('menu.saveTauriFile')}
            disabled={isSaveDisabled}
            onPointerUp={handleSaveTauriFile}
          />
        ) : (
          <Popover
            key={0}
            sideOffset={12}
            open={appMenuOpen}
            onOpenChange={(open) => {
              setAppMenuOpen(open);
            }}
            placement="bottom-start"
          >
            <PopoverTrigger asChild>
              <ToolButton
                type="icon"
                visible={true}
                selected={appMenuOpen}
                icon={MenuIcon}
                title={t('general.menu')}
                aria-label={t('general.menu')}
                onPointerDown={() => {
                  setAppMenuOpen(!appMenuOpen);
                }}
              />
            </PopoverTrigger>
            <PopoverContent container={container}>
              <Menu
                onSelect={() => {
                  setAppMenuOpen(false);
                }}
              >
                <OpenFile></OpenFile>
                <SaveTauriFile></SaveTauriFile>
                <SaveToFile></SaveToFile>
                <SaveAsFile></SaveAsFile>
                <SaveAsImage></SaveAsImage>
                <CleanBoard></CleanBoard>
                <MenuSeparator />
                <LanguageSwitcherMenu />
                <Socials />
              </Menu>
            </PopoverContent>
          </Popover>
        )}
        <ToolButton
          key={1}
          type="icon"
          icon={UndoIcon}
          visible={true}
          title={t('general.undo')}
          aria-label={t('general.undo')}
          onPointerUp={() => {
            board.undo();
          }}
          disabled={isUndoDisabled}
        />
        <ToolButton
          key={2}
          type="icon"
          icon={RedoIcon}
          visible={true}
          title={t('general.redo')}
          aria-label={t('general.redo')}
          onPointerUp={() => {
            board.redo();
          }}
          disabled={isRedoDisabled}
        />
        {selectedElements.length > 0 && (
          <ToolButton
            className="duplicate"
            key={3}
            type="icon"
            icon={DuplicateIcon}
            visible={true}
            title={t('general.duplicate')}
            aria-label={t('general.duplicate')}
            onPointerUp={() => {
              duplicateElements(board);
            }}
          />
        )}
        {selectedElements.length > 0 && (
          <ToolButton
            className="trash"
            key={4}
            type="icon"
            icon={TrashIcon}
            visible={true}
            title={t('general.delete')}
            aria-label={t('general.delete')}
            onPointerUp={() => {
              deleteFragment(board);
            }}
          />
        )}
      </Stack.Row>
    </Island>
  );
};
