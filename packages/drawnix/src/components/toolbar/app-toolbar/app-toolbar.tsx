import { useBoard } from '@plait-board/react-board';
import Stack from '../../stack';
import { ToolButton } from '../../tool-button';
import {
  DuplicateIcon,
  MenuIcon,
  RedoIcon,
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
import { useRef, useState } from 'react';
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
import { isTauriEnvironment } from '../../../data/tauri-file';
import { isBoardHistoryEmpty } from '../../../data/board-history';

/** 文档编辑器（.doc-editor 覆盖层）是否打开：与 with-hotkey 的键盘守卫
 *  同判定（未从 react-board 导出，避免跨包依赖）。常规布局下文档打开时
 *  本工具栏已卸载（drawnix.tsx 的 !isDocOpen 分支），此处是布局变化后的
 *  纵深防御（G5） */
const isDocEditorOpen = (): boolean => !!document.querySelector('.doc-editor');

/** 可编辑元素判定（G5）：与 with-hotkey 的 isEditableElement 同判定
 *  （按既有约定不跨文件共享），contentEditable 元素或编辑宿主后代、
 *  input/textarea；isContentEditable 在部分环境未实现，用 closest
 *  按 contenteditable 属性兜底 */
const isEditableElement = (element: HTMLElement): boolean =>
  element.isContentEditable ||
  !!element.closest('[contenteditable="true"], [contenteditable=""]') ||
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement;

/** 编辑器是否正持有焦点或打开（G5）：焦点位于卡片 contentEditable、
 *  input/textarea，或文档编辑器覆盖层打开时，按钮不触发白板撤销/重做。
 *  pressed 是按压起点（pointerdown）的焦点元素：点击按钮会先抢占焦点
 *  （Chrome 在 pointerdown 默认动作里移动焦点），pointerup 时
 *  activeElement 已是按钮本身，仅看它会漏掉「编辑卡片内容时点撤销」
 *  场景；与 with-hotkey 的 shouldLetEditorUndoRedo（KeyboardEvent 版）
 *  同一判定域 */
const isEditorFocused = (pressed?: HTMLElement | null): boolean => {
  if (isDocEditorOpen()) {
    return true;
  }
  const candidates = [pressed, document.activeElement];
  return candidates.some((element) => element instanceof HTMLElement && isEditableElement(element));
};

export const AppToolbar = () => {
  const board = useBoard();
  const { t } = useI18n();
  const container = PlaitBoard.getBoardContainer(board);
  const selectedElements = getSelectedElements(board);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [isTauri] = useState(() => isTauriEnvironment());
  // 按压起点（pointerdown）的焦点元素：pointerdown 先于焦点迁移，按钮
  // 抢占焦点前快照，供 undo/redo 的 pointerup 守卫判定（G5）
  const pressedFocusRef = useRef<HTMLElement | null>(null);
  // 禁用态与清空逻辑（data/board-history.ts）同源，不再各写一套
  const isUndoDisabled = isBoardHistoryEmpty(board);
  const isRedoDisabled = isBoardHistoryEmpty(board, 'redo');

  return (
    <Island padding={1} className={classNames('app-toolbar', ATTACHED_ELEMENT_CLASS_NAME)}>
      <Stack.Row gap={1}>
        {/* 桌面端不放第二枚保存按钮：唯一保存入口在页签栏（E2） */}
        {!isTauri && (
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
          onPointerDown={() => {
            const active = document.activeElement;
            pressedFocusRef.current = active instanceof HTMLElement ? active : null;
          }}
          onPointerUp={() => {
            // 编辑器可编辑区域持焦点或文档编辑器打开时不触发白板撤销（G5）
            const pressed = pressedFocusRef.current;
            pressedFocusRef.current = null;
            if (isEditorFocused(pressed)) {
              return;
            }
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
          onPointerDown={() => {
            const active = document.activeElement;
            pressedFocusRef.current = active instanceof HTMLElement ? active : null;
          }}
          onPointerUp={() => {
            const pressed = pressedFocusRef.current;
            pressedFocusRef.current = null;
            if (isEditorFocused(pressed)) {
              return;
            }
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
