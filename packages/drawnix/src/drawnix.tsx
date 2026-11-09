import { Board, BoardChangeData, Wrapper } from '@plait-board/react-board';
import {
  PlaitBoard,
  PlaitBoardOptions,
  PlaitElement,
  PlaitPlugin,
  PlaitPointerType,
  PlaitTheme,
  BoardTransforms,
  Selection,
  ThemeColorMode,
  Viewport,
} from '@plait/core';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { BoardCreationMode, setCreationMode, withGroup } from '@plait/common';
import { withDraw } from '@plait/draw';
import { MindThemeColors, withMind } from '@plait/mind';
import MobileDetect from 'mobile-detect';
import { withMindExtend } from './plugins/with-mind-extend';
import { withCommonPlugin } from './plugins/with-common';
import { CreationToolbar } from './components/toolbar/creation-toolbar';
import { ZoomToolbar } from './components/toolbar/zoom-toolbar';
import { PopupToolbar } from './components/toolbar/popup-toolbar/popup-toolbar';
import { AppToolbar } from './components/toolbar/app-toolbar/app-toolbar';
import classNames from 'classnames';
import './styles/index.scss';
import { buildDrawnixHotkeyPlugin } from './plugins/with-hotkey';
import { buildToolStateSyncPlugin } from './plugins/with-tool-state-sync';
import { withFreehand } from './plugins/freehand/with-freehand';
import { ThemeToolbar } from './components/toolbar/theme-toolbar';
import { buildPencilPlugin } from './plugins/with-pencil';
import {
  DrawnixBoard,
  DrawnixContext,
  DrawnixToolState,
  mergeToolState,
  type DrawnixState,
} from './hooks/use-drawnix';
import { ClosePencilToolbar } from './components/toolbar/pencil-mode-toolbar';
import { TTDDialog } from './components/ttd-dialog/ttd-dialog';
import { CleanConfirm } from './components/clean-confirm/clean-confirm';
import { buildTextLinkPlugin } from './plugins/with-text-link';
import { LinkPopup } from './components/popup/link-popup/link-popup';
import { I18nProvider, setBoardLanguage } from './i18n';
import type { Language } from './i18n/types';
import { Tutorial } from './components/tutorial';
import { LASER_POINTER_CLASS_NAME } from './utils/laser-pointer';
import { Toast, useToast } from './components/toast/toast';
import { withCard, migrateLegacyBoardData } from './plugins/card/with-card';
import { withTextSelection } from './plugins/with-text-selection';
import { TauriFilePanel } from './components/tauri-file-panel/tauri-file-panel';
import { TabBar } from './components/tab-bar/tab-bar';
import { ExitConfirmDialog } from './components/exit-confirm-dialog/exit-confirm-dialog';
import { setExitConfirmOpen } from './data/workbench-ui';
import { interceptTauriWindowClose } from './data/tauri-window';
import { WelcomePage } from './components/welcome-page/welcome-page';
import { DocEditor } from './components/doc-editor/doc-editor';
import {
  isTauriEnvironment,
  markTauriFileDirty,
  useTauriFileState,
} from './data/tauri-file';

export type DrawnixProps = {
  value: PlaitElement[];
  viewport?: Viewport;
  theme?: PlaitTheme;
  initialToolState?: Partial<DrawnixToolState>;
  initialPreference?: {
    copyTransparent?: boolean;
    exportTransparent?: boolean;
  };
  initialLanguage?: Language;
  onChange?: (value: BoardChangeData) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  onValueChange?: (value: PlaitElement[]) => void;
  onViewportChange?: (value: Viewport) => void;
  onThemeChange?: (value: ThemeColorMode) => void;
  onToolStateChange?: (toolState: DrawnixToolState) => void;
  onPreferenceChange?: (preference: {
    copyTransparent: boolean;
    exportTransparent: boolean;
  }) => void;
  onLanguageChange?: (language: Language) => void;
  afterInit?: (board: PlaitBoard) => void;
  tutorial?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export type { DrawnixToolState } from './hooks/use-drawnix';

const applyToolStateToBoard = (board: PlaitBoard, toolState: DrawnixToolState) => {
  BoardTransforms.updatePointerType(board, toolState.pointer);
  if (
    toolState.pointer !== PlaitPointerType.hand &&
    toolState.pointer !== PlaitPointerType.selection
  ) {
    setCreationMode(board, BoardCreationMode.drawing);
  }
};

export const Drawnix: React.FC<DrawnixProps> = ({
  value,
  viewport,
  theme,
  initialToolState,
  initialPreference,
  initialLanguage,
  onChange,
  onSelectionChange,
  onViewportChange,
  onThemeChange,
  onValueChange,
  onToolStateChange,
  onPreferenceChange,
  onLanguageChange,
  afterInit,
  tutorial = false,
}) => {
  const options: PlaitBoardOptions = {
    readonly: false,
    hideScrollbar: true,
    disabledScrollOnNonFocus: false,
    themeColors: MindThemeColors,
  };

  const [appState, setAppState] = useState<DrawnixState>(() => {
    const md = new MobileDetect(window.navigator.userAgent);
    return {
      toolState: mergeToolState(initialToolState),
      isMobile: md.mobile() !== null,
      isPencilMode: false,
      isContentFullscreen: false,
      fileHandle: null,
      openDialogType: null,
      openCleanConfirm: false,
      copyTransparent: initialPreference?.copyTransparent ?? false,
      exportTransparent: initialPreference?.exportTransparent ?? false,
    };
  });

  const [board, setBoard] = useState<DrawnixBoard | null>(null);
  const [themeColorMode, setThemeColorMode] = useState<ThemeColorMode>(
    theme?.themeColorMode || ThemeColorMode.default
  );
  const { toast, showToast } = useToast();
  const lastKnownLanguageRef = useRef<Language>(initialLanguage ?? 'zh');

  if (board) {
    board.appState = appState;
    board.showToast = showToast;
  }

  useEffect(() => {
    if (!board) {
      return;
    }
    setBoardLanguage(board, lastKnownLanguageRef.current);
  }, [board]);

  // 内容区全屏（铺满窗口）时按 Esc 退出
  useEffect(() => {
    if (!appState.isContentFullscreen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAppState((current) => ({ ...current, isContentFullscreen: false }));
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [appState.isContentFullscreen]);

  // Tauri 环境：拦截窗口关闭（系统关闭钮 / Alt+F4），先进入退出确认流程（D5）
  useEffect(() => {
    if (!isTauriEnvironment()) {
      return;
    }
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    interceptTauriWindowClose(() => setExitConfirmOpen(true)).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        cleanup = unlisten;
      }
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const hasMountedToolStateRef = useRef(false);
  const onToolStateChangeRef = useRef(onToolStateChange);
  onToolStateChangeRef.current = onToolStateChange;

  useEffect(() => {
    if (!hasMountedToolStateRef.current) {
      hasMountedToolStateRef.current = true;
      return;
    }
    onToolStateChangeRef.current?.(appState.toolState);
  }, [appState.toolState]);

  const hasMountedPreferenceRef = useRef(false);
  const onPreferenceChangeRef = useRef(onPreferenceChange);
  onPreferenceChangeRef.current = onPreferenceChange;

  useEffect(() => {
    if (!hasMountedPreferenceRef.current) {
      hasMountedPreferenceRef.current = true;
      return;
    }
    onPreferenceChangeRef.current?.({
      copyTransparent: appState.copyTransparent,
      exportTransparent: appState.exportTransparent,
    });
  }, [appState.copyTransparent, appState.exportTransparent]);

  useEffect(() => {
    if (theme?.themeColorMode) {
      setThemeColorMode(theme.themeColorMode);
    }
  }, [theme?.themeColorMode]);

  const updateAppState = (newAppState: Partial<DrawnixState>) => {
    setAppState((currentAppState) => ({
      ...currentAppState,
      ...newAppState,
    }));
  };

  const syncBoardPointerToToolState = (pointer: DrawnixToolState['pointer']) => {
    setAppState((currentAppState) => {
      if (currentAppState.toolState.pointer === pointer) {
        return currentAppState;
      }
      return {
        ...currentAppState,
        toolState: {
          ...currentAppState.toolState,
          pointer,
        },
      };
    });
  };

  const plugins: PlaitPlugin[] = [
    withDraw,
    withGroup,
    withMind,
    withMindExtend,
    withCard,
    withCommonPlugin,
    // 拖拽期间禁止浏览器原生文本选中（拖动卡片/形状/框选时误选中其他内容）
    withTextSelection,
    buildDrawnixHotkeyPlugin(updateAppState),
    withFreehand,
    buildPencilPlugin(updateAppState),
    buildTextLinkPlugin(updateAppState),
    buildToolStateSyncPlugin(syncBoardPointerToToolState),
  ];

  const containerRef = useRef<HTMLDivElement>(null);

  // 当前打开的是 Markdown/表格文件时，用文档编辑器覆盖层替代白板编辑区
  const { currentFile, fileType: currentFileType } = useTauriFileState();
  const isDocOpen = !!currentFile && isTauriEnvironment() && currentFileType !== 'drawnix';

  // Normalize board data coming from any host before it reaches the board:
  // persisted data may still contain card elements saved before the card
  // plugin became geometry-based, which would otherwise crash the plugin
  // chain when the value prop is injected after board initialization.
  const normalizedValue = useMemo(() => migrateLegacyBoardData(value), [value]);

  return (
    <I18nProvider
      initialLanguage={initialLanguage}
      onLanguageChange={(language) => {
        lastKnownLanguageRef.current = language;
        if (board) {
          setBoardLanguage(board, language);
        }
        onLanguageChange?.(language);
      }}
    >
      <DrawnixContext.Provider value={{ appState, setAppState, showToast }}>
        <div
          className={classNames('drawnix', {
            'drawnix--mobile': appState.isMobile,
            'drawnix--content-fullscreen': appState.isContentFullscreen,
            [`theme--${themeColorMode}`]: themeColorMode,
          })}
          ref={containerRef}
        >
          <Wrapper
            value={normalizedValue}
            viewport={viewport}
            theme={theme}
            options={options}
            plugins={plugins}
            onChange={(data: BoardChangeData) => {
              markTauriFileDirty();
              onChange?.(data);
            }}
            onSelectionChange={onSelectionChange}
            onViewportChange={onViewportChange}
            onThemeChange={(value) => {
              setThemeColorMode(value);
              onThemeChange?.(value);
            }}
            onValueChange={onValueChange}
          >
            {/* 工作台骨架：内容列（页签栏 + 白板区）在左，文件面板在右（A1） */}
            <div className="wb-main">
              <div className="wb-content">
                <TabBar />
                <div className="drawnix-main">
                  <Board
                    afterInit={(board) => {
                      const drawnixBoard = board as DrawnixBoard;
                      applyToolStateToBoard(drawnixBoard, appState.toolState);
                      setBoard(drawnixBoard);
                      afterInit?.(board);
                    }}
                  >
                    {tutorial && board && !isTauriEnvironment() && <Tutorial />}
                  </Board>
                  {isDocOpen && currentFile && (
                    <DocEditor
                      key={currentFile}
                      path={currentFile}
                      fileType={currentFileType as 'md' | 'table'}
                    ></DocEditor>
                  )}
                  {!isDocOpen && (
                    <>
                      <AppToolbar></AppToolbar>
                      <CreationToolbar></CreationToolbar>
                      <ZoomToolbar></ZoomToolbar>
                      <ThemeToolbar></ThemeToolbar>
                      <PopupToolbar></PopupToolbar>
                      <LinkPopup></LinkPopup>
                      <ClosePencilToolbar></ClosePencilToolbar>
                      <WelcomePage></WelcomePage>
                    </>
                  )}
                  <TTDDialog container={containerRef.current}></TTDDialog>
                  <CleanConfirm container={containerRef.current}></CleanConfirm>
                </div>
              </div>
              <TauriFilePanel></TauriFilePanel>
            </div>
            <ExitConfirmDialog container={containerRef.current} />
            <Toast toast={toast} container={containerRef.current}></Toast>
          </Wrapper>
          <canvas className={`${LASER_POINTER_CLASS_NAME} mouse-course-hidden`}></canvas>
        </div>
      </DrawnixContext.Provider>
    </I18nProvider>
  );
};
