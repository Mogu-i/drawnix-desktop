import { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { AppWindowIcon, BoardIcon, CloseIcon, MdIcon, TableIcon } from '../icons';
import { Popover, PopoverContent, PopoverTrigger } from '../popover/popover';
import Menu from '../menu/menu';
import MenuItem from '../menu/menu-item';
import MenuSeparator from '../menu/menu-separator';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useI18n } from '../../i18n';
import { useTauriFileActions } from '../../hooks/use-tauri-file-actions';
import {
  setExitConfirmOpen,
} from '../../data/workbench-ui';
import {
  closeTauriTab,
  isTauriEnvironment,
  useTauriFileState,
  type TauriOpenTab,
} from '../../data/tauri-file';
import {
  isTauriWindowMaximized,
  minimizeTauriWindow,
  toggleTauriWindowMaximize,
} from '../../data/tauri-window';
import './tab-bar.scss';

const lastSeg = (rel: string) => rel.slice(rel.lastIndexOf('/') + 1);

/** 页签类型 → 类型名 i18n key（页签内展示彩色类型图标，类型名保留在 title 提示中） */
const tabTypeLabelKey = {
  drawnix: 'filePanel.fileType.drawnix',
  table: 'filePanel.fileType.table',
  md: 'filePanel.fileType.md',
} as const;

/**
 * 文件页签栏（规格 A/B/D/G）：
 * - 活动文件以页签展示（彩色类型图标 + 名称 + 未保存橙点 + 活动收起按钮），位于内容区上方；
 * - 橙点 / 页签 title 均从同一份 dirty 推导，一次渲染内天然同步（B5）；
 * - 右侧动作区：窄屏「窗口」菜单；
 * - 页签溢出横向滚动，左右边缘渐隐，切换 / 新建 / resize 后活动页签滚入可视区（A4/G3）。
 */
export const TabBar = () => {
  const { appState, setAppState } = useDrawnix();
  const { t } = useI18n();
  const { currentFile, openTabs, dirty } = useTauriFileState();
  const { openFile, saveCurrentFile } = useTauriFileActions();
  const [isTauri] = useState(() => isTauriEnvironment());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [windowMenuOpen, setWindowMenuOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLDivElement>());

  // ---- 滚动渐隐与活动页签滚入可视区（A4/G3） ---
  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const ensureActiveVisible = useCallback(() => {
    const scroller = scrollRef.current;
    const active = currentFile ? tabRefs.current.get(currentFile) : null;
    if (!scroller || !active) {
      return;
    }
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < scroller.scrollLeft) {
      scroller.scrollTo({ left: Math.max(0, left - 12), behavior: 'smooth' });
    } else if (right > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({
        left: right - scroller.clientWidth + 12,
        behavior: 'smooth',
      });
    }
  }, [currentFile]);

  useEffect(() => {
    updateScrollIndicators();
    ensureActiveVisible();
  }, [currentFile, openTabs.length, updateScrollIndicators, ensureActiveVisible]);

  useEffect(() => {
    const onResize = () => {
      updateScrollIndicators();
      ensureActiveVisible();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [updateScrollIndicators, ensureActiveVisible]);

  // ---- Ctrl+S / Cmd+S 快捷键保存（B4） ---
  const saveRef = useRef(saveCurrentFile);
  saveRef.current = saveCurrentFile;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // ---- 页签切换（收起文件已保存，白板切换由 openFile 处理快照） ---
  const switchTab = (tab: TauriOpenTab) => {
    if (tab.path === currentFile) {
      return;
    }
    void openFile(tab.path, tab.fileType);
  };

  // ---- 收起活动页签：脏文件先保存，失败不收起；收起后切相邻页签或欢迎页（B7） ---
  const collapseActiveTab = async () => {
    if (!currentFile) {
      return;
    }
    if (dirty[currentFile]) {
      const saved = await saveCurrentFile();
      if (!saved) {
        return;
      }
    }
    const next = closeTauriTab(currentFile);
    if (next) {
      // closeTauriTab 同步更新了 currentFile，openFile 不会再误存被收起文件的快照
      const nextTab = openTabs.find((tab) => tab.path === next);
      if (nextTab) {
        void openFile(next, nextTab.fileType);
      }
    } else if (appState.isContentFullscreen) {
      // 收起唯一页签回到欢迎页时顺带退出专注模式
      setAppState((current) => ({ ...current, isContentFullscreen: false }));
    }
  };

  // ---- 窄屏窗口菜单：打开时查询真实窗口状态决定还原 / 最大化文案（D6） ---
  const handleWindowMenuOpenChange = (open: boolean) => {
    setWindowMenuOpen(open);
    if (open) {
      isTauriWindowMaximized()
        .then(setMaximized)
        .catch(() => setMaximized(false));
    }
  };

  if (!isTauri) {
    return null;
  }

  return (
    // 无边框窗口拖动区：data-tauri-drag-region 只在 mousedown 目标元素自带该属性时生效，
    // 页签 / 按钮为子元素不受影响，点击与滚动行为保持原样
    <header className="tab-bar" data-tauri-drag-region="">
      <div
        className="tab-bar__tabs-wrap"
        data-tauri-drag-region=""
        data-can-left={canScrollLeft || undefined}
        data-can-right={canScrollRight || undefined}
      >
        <div
          ref={scrollRef}
          className="tab-bar__tabs"
          onScroll={updateScrollIndicators}
        >
          {openTabs.map((tab) => {
            const name = lastSeg(tab.path);
            const isActive = tab.path === currentFile;
            const isDirty = Boolean(dirty[tab.path]);
            const label = t(tabTypeLabelKey[tab.fileType]);
            return (
              <div
                key={tab.path}
                ref={(node) => {
                  if (node) {
                    tabRefs.current.set(tab.path, node);
                  } else {
                    tabRefs.current.delete(tab.path);
                  }
                }}
                className={classNames('tab-bar__tab', {
                  'tab-bar__tab--active': isActive,
                })}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                title={
                  isDirty
                    ? `${name} · ${label} · ${t('workbench.tab.dirtySuffix')}`
                    : `${name} · ${label}`
                }
                onClick={() => switchTab(tab)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    switchTab(tab);
                  }
                }}
              >
                {/* 彩色类型图标，配色与侧边栏文件项一致（白板蓝/表格绿/Markdown 橙） */}
                <span
                  className={`tab-bar__tab-icon tab-bar__tab-icon--${tab.fileType}`}
                  aria-hidden="true"
                >
                  {tab.fileType === 'table'
                    ? TableIcon
                    : tab.fileType === 'md'
                      ? MdIcon
                      : BoardIcon}
                </span>
                <span className="tab-bar__tab-name">{name}</span>
                {/* 橙点用 visibility 占位而非条件渲染，避免页签宽度跳动（B2） */}
                <span
                  className="tab-bar__dot"
                  data-visible={isDirty || undefined}
                  aria-hidden="true"
                />
                {isActive && (
                  <button
                    type="button"
                    className="tab-bar__tab-close"
                    title={t('workbench.tab.closeTab')}
                    aria-label={t('workbench.tab.closeTab')}
                    onClick={(event) => {
                      event.stopPropagation();
                      void collapseActiveTab();
                    }}
                  >
                    {CloseIcon}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="tab-bar__actions">
        {/* 窄屏窗口菜单（D6）：三项功能与桌面窗口三钮完全一致 */}
        <Popover
          placement="bottom-end"
          open={windowMenuOpen}
          onOpenChange={handleWindowMenuOpenChange}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="tab-bar__window-menu"
              title={t('workbench.tab.windowMenu')}
              aria-label={t('workbench.tab.windowMenu')}
              aria-haspopup="menu"
              onPointerDown={() => handleWindowMenuOpenChange(!windowMenuOpen)}
            >
              {AppWindowIcon}
              <span className="tab-bar__btn-label">{t('workbench.tab.windowMenu')}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent container={document.querySelector('.drawnix')}>
            <Menu
              onSelect={() => {
                setWindowMenuOpen(false);
              }}
            >
              <MenuItem
                onSelect={() => {
                  void minimizeTauriWindow();
                }}
              >
                {t('workbench.window.minimizeWindow')}
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  void toggleTauriWindowMaximize();
                }}
              >
                {maximized
                  ? t('workbench.window.restoreWindow')
                  : t('workbench.window.maximizeWindow')}
              </MenuItem>
              <MenuSeparator />
              {/* 关闭窗口为危险动作：与原型 r3-final 一致，分隔线 + 红色文字 */}
              <MenuItem
                className="menu-item--danger"
                onSelect={() => setExitConfirmOpen(true)}
              >
                {t('workbench.window.closeWindow')}
              </MenuItem>
            </Menu>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};
