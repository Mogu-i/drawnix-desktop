import { Board, BoardChangeData, Wrapper } from '@plait-board/react-board';
import {
  PlaitBoard,
  PlaitBoardOptions,
  PlaitElement,
  PlaitOperation,
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
import { I18nProvider, i18nInsidePlaitHook, setBoardLanguage } from './i18n';
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
import { RestoreOpenedFile } from './components/restore-opened-file/restore-opened-file';
import {
  getTauriFileState,
  isTauriEnvironment,
  markTauriFileDirty,
  saveToTauriFile,
  useTauriFileState,
} from './data/tauri-file';
import {
  flushBoardSessionStateNow,
  scheduleBoardDraft,
  scheduleBoardViewport,
} from './data/board-draft';
import { flushTauriAutoSaveNow, scheduleTauriAutoSave } from './data/tauri-auto-save';
import { serializeAsJSON } from './data/json';

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
      isFullscreenToolbarVisible: true,
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
    // 插件链路的 i18n 文案通道：随语言切换动态解析（WeakMap boardLanguageMap）
    board.t = i18nInsidePlaitHook(board).t;
  }

  useEffect(() => {
    if (!board) {
      return;
    }
    setBoardLanguage(board, lastKnownLanguageRef.current);
  }, [board]);

  // 内容区全屏（铺满窗口）时按 Esc 退出，Ctrl+\ 切换创作工具栏显隐
  useEffect(() => {
    if (!appState.isContentFullscreen) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAppState((current) => ({ ...current, isContentFullscreen: false }));
      }
      // Ctrl+\（沿用 Figma「显示/隐藏 UI」惯例）：全屏时在沉浸画面与可标注工具栏间切换
      if ((event.ctrlKey || event.metaKey) && (event.key === '\\' || event.code === 'Backslash')) {
        event.preventDefault();
        setAppState((current) => ({
          ...current,
          isFullscreenToolbarVisible: !current.isFullscreenToolbarVisible,
        }));
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [appState.isContentFullscreen]);

  // 桌面端：失焦 / 页面隐藏 / 刷新前把防抖中的白板草稿与视口状态立即落盘，
  // 进程被系统回收（休眠唤醒、后台 WebView 回收）后重启仍能恢复未保存内容
  useEffect(() => {
    if (!isTauriEnvironment()) {
      return;
    }
    const flush = () => {
      // 自动保存防抖中的修改立即写盘 + 草稿/视口落盘（进程被回收后可恢复）
      void flushTauriAutoSaveNow();
      void flushBoardSessionStateNow();
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        flush();
      }
    };
    window.addEventListener('blur', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', flush);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

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
            'drawnix--fullscreen-toolbar-hidden': !appState.isFullscreenToolbarVisible,
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
              // 仅元素内容变化才标脏：框选/滚动等也会触发 onChange，不加区分会把
              // 未编辑的文件误标为有未保存修改（假脏橙点、切换文件时无谓写盘）；
              // 主题切换不算在内——theme 会随 serializeAsJSON 写入文件，属于内容变化
              const hasContentChange = data.operations.some(
                (op) =>
                  !PlaitOperation.isSetSelectionOperation(op) &&
                  !PlaitOperation.isSetViewportOperation(op)
              );
              if (hasContentChange) {
                markTauriFileDirty();
                // 未保存白板草稿按路径防抖写入 IndexedDB（Bug 1）：
                // 不挂在 markTauriFileDirty 里——它受 500ms 抑制窗口影响会漏写；
                // web 端无 currentFile，条件不满足自然跳过
                const { currentFile, fileType } = getTauriFileState();
                if (board && isTauriEnvironment() && currentFile && fileType === 'drawnix') {
                  scheduleBoardDraft(currentFile, serializeAsJSON(board));
                  // 自动保存（所有文件）：编辑停止 1s 后自动写盘，无需手动 Ctrl+S；
                  // 写盘成功由 saveToTauriFile 清脏清草稿（橙点消失），失败保留橙点，
                  // 草稿兜底不受影响；任务惰性取 board 最新内容
                  scheduleTauriAutoSave(currentFile, 'drawnix', () =>
                    saveToTauriFile(board, currentFile)
                  );
                }
              }
              // 手动缩放/平移的视口轻量持久化（Bug 2 附带）：不标脏、不写盘，
              // 只缩放不编辑时重启仍能恢复 zoom；set_viewport 不进 hasContentChange，
              // 避免产生假脏橙点
              if (data.operations.some((op) => PlaitOperation.isSetViewportOperation(op))) {
                const fileState = getTauriFileState();
                if (
                  isTauriEnvironment() &&
                  fileState.currentFile &&
                  fileState.fileType === 'drawnix'
                ) {
                  scheduleBoardViewport(fileState.currentFile, data.viewport);
                }
              }
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
                  <RestoreOpenedFile />
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
