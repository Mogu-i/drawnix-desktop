import { ReactElement } from 'react';
import { useI18n } from '../../i18n';
import type { Translations } from '../../i18n/types';
import type { MarkdownAction } from './markdown-format';
import { MoreIcon } from '../icons';
import {
  EditorIsland,
  EditorIslandButton,
  EditorIslandDropdown,
  EditorIslandMenuItem,
  EditorIslandMenuSeparator,
  EditorIslandMenuTitle,
  EditorIslandSeparator,
  IslandPlusIcon,
  IslandRedoIcon,
  IslandUndoIcon,
} from './editor-toolbar-island';

/** 视图模式：源码 / 分屏 / 预览（视图岛与窄屏「更多」菜单共用） */
export type MarkdownViewMode = 'code' | 'split' | 'preview';

// 记住用户上一次选择的视图模式，下次打开时作为默认值
const VIEW_MODE_STORAGE_KEY = 'markdown_editor_view_mode';
export const DEFAULT_VIEW_MODE: MarkdownViewMode = 'split';

export const VIEW_MODES: { value: MarkdownViewMode; labelKey: keyof Translations }[] = [
  { value: 'code', labelKey: 'markdown.mode.code' },
  { value: 'split', labelKey: 'markdown.mode.split' },
  { value: 'preview', labelKey: 'markdown.mode.preview' },
];

const isViewMode = (value: string | null): value is MarkdownViewMode =>
  value === 'code' || value === 'split' || value === 'preview';

export const loadViewMode = (): MarkdownViewMode => {
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (isViewMode(stored)) {
      return stored;
    }
  } catch {
    // localStorage 不可用（如隐私模式）时忽略，走默认模式
  }
  return DEFAULT_VIEW_MODE;
};

// 16x16 线性小图标，风格与表格编辑器工具栏保持一致
const ListIcon = ({ ordered }: { ordered?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    {ordered ? (
      <text x="1.4" y="12.6" fontSize="7" fill="currentColor" stroke="none">
        1
      </text>
    ) : (
      <circle cx="2.6" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
    )}
    {ordered ? (
      <text x="1.4" y="6.6" fontSize="7" fill="currentColor" stroke="none">
        2
      </text>
    ) : (
      <circle cx="2.6" cy="4.2" r="1.1" fill="currentColor" stroke="none" />
    )}
    <line x1="6" y1="4.2" x2="14.5" y2="4.2" />
    <line x1="6" y1="10.2" x2="14.5" y2="10.2" />
  </svg>
);

const TaskListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1.8" y="3.4" width="3.4" height="3.4" rx="0.5" />
    <path d="M2.6 5.1l1 1 1.4-1.8" />
    <rect x="1.8" y="9.4" width="3.4" height="3.4" rx="0.5" />
    <line x1="7.5" y1="5.1" x2="14.5" y2="5.1" />
    <line x1="7.5" y1="11.1" x2="14.5" y2="11.1" />
  </svg>
);

const QuoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 3.5v9" strokeWidth="2" />
    <path d="M6.5 5h7M6.5 8h7M6.5 11h4.5" />
  </svg>
);

const InlineCodeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5 4.5L1.8 8L5 11.5" />
    <path d="M11 4.5L14.2 8L11 11.5" />
    <path d="M9.2 3.5L6.8 12.5" />
  </svg>
);

const CodeBlockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M5.5 2.5H3.2a.7.7 0 0 0-.7.7v2.8" />
    <path d="M10.5 2.5h2.3a.7.7 0 0 1 .7.7v2.8" />
    <path d="M5.5 13.5H3.2a.7.7 0 0 1-.7-.7V10" />
    <path d="M10.5 13.5h2.3a.7.7 0 0 0 .7-.7V10" />
    <line x1="5" y1="8" x2="11" y2="8" />
  </svg>
);

const TableIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="0.8" />
    <line x1="1.8" y1="6.4" x2="14.2" y2="6.4" />
    <line x1="8" y1="6.4" x2="8" y2="13.2" />
  </svg>
);

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6.5 9.5l3-3" />
    <path d="M7.5 4.9l1.2-1.2a2.4 2.4 0 0 1 3.4 3.4l-1.2 1.2" />
    <path d="M8.5 11.1l-1.2 1.2a2.4 2.4 0 0 1-3.4-3.4l1.2-1.2" />
  </svg>
);

const ImageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2" y="3" width="12" height="10" rx="1" />
    <circle cx="5.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
    <path d="M3 11.8l3-3 3.5 3.5" />
    <path d="M10 10.8l1.5-1.5 1.8 1.8" />
  </svg>
);

const HorizontalRuleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <line x1="2" y1="8" x2="14" y2="8" />
  </svg>
);

/** 工具按钮图标：文字字形 + 线性 SVG，与表格编辑器视觉风格统一 */
const ToolIcon = ({ action }: { action: MarkdownAction }): ReactElement => {
  switch (action) {
    case 'bold':
      return <span className="editor-island__glyph editor-island__glyph--bold">B</span>;
    case 'italic':
      return <span className="editor-island__glyph editor-island__glyph--italic">I</span>;
    case 'strikethrough':
      return <span className="editor-island__glyph editor-island__glyph--strike">S</span>;
    case 'h1':
    case 'h2':
    case 'h3':
      return (
        <span className="editor-island__glyph">
          {action === 'h1' ? 'H1' : action === 'h2' ? 'H2' : 'H3'}
        </span>
      );
    case 'unorderedList':
      return <ListIcon />;
    case 'orderedList':
      return <ListIcon ordered />;
    case 'taskList':
      return <TaskListIcon />;
    case 'quote':
      return <QuoteIcon />;
    case 'inlineCode':
      return <InlineCodeIcon />;
    case 'codeBlock':
      return <CodeBlockIcon />;
    case 'link':
      return <LinkIcon />;
    case 'image':
      return <ImageIcon />;
    case 'table':
      return <TableIcon />;
    case 'horizontalRule':
      return <HorizontalRuleIcon />;
    default:
      return <></>;
  }
};

type ToolbarItem = { action: MarkdownAction; labelKey: keyof Translations };

// 常驻组：行内格式 / 标题 / 列表与引用
const INLINE_GROUP: ToolbarItem[] = [
  { action: 'bold', labelKey: 'markdown.toolbar.bold' },
  { action: 'italic', labelKey: 'markdown.toolbar.italic' },
  { action: 'strikethrough', labelKey: 'markdown.toolbar.strikethrough' },
  { action: 'inlineCode', labelKey: 'markdown.toolbar.inlineCode' },
];

const HEADING_GROUP: ToolbarItem[] = [
  { action: 'h1', labelKey: 'markdown.toolbar.heading1' },
  { action: 'h2', labelKey: 'markdown.toolbar.heading2' },
  { action: 'h3', labelKey: 'markdown.toolbar.heading3' },
];

const LIST_GROUP: ToolbarItem[] = [
  { action: 'unorderedList', labelKey: 'markdown.toolbar.unorderedList' },
  { action: 'orderedList', labelKey: 'markdown.toolbar.orderedList' },
  { action: 'taskList', labelKey: 'markdown.toolbar.taskList' },
  { action: 'quote', labelKey: 'markdown.toolbar.quote' },
];

// 插入组：收进「插入」下拉，窄屏时并入「更多」菜单
const INSERT_GROUP: ToolbarItem[] = [
  { action: 'codeBlock', labelKey: 'markdown.toolbar.codeBlock' },
  { action: 'link', labelKey: 'markdown.toolbar.link' },
  { action: 'image', labelKey: 'markdown.toolbar.image' },
  { action: 'table', labelKey: 'markdown.toolbar.table' },
  { action: 'horizontalRule', labelKey: 'markdown.toolbar.horizontalRule' },
];

type MarkdownToolbarProps = {
  onAction: (action: MarkdownAction) => void;
  disabled?: boolean;
  /** 撤销/重做：历史栈由编辑器管理，工具岛只透传状态与回调 */
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** 当前视图模式：窄屏「更多」菜单中的视图切换用 */
  mode?: MarkdownViewMode;
  onViewModeChange?: (mode: MarkdownViewMode) => void;
};

// Markdown 编辑区格式化工具岛：常驻高频动作，「插入」类收进下拉，
// 「更多」桌面端放操作提示，窄屏把插入动作与视图模式收纳进来
export const MarkdownToolbar = ({
  onAction,
  disabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  mode,
  onViewModeChange,
}: MarkdownToolbarProps) => {
  const { t } = useI18n();
  const disabledReason = t('markdown.toolbar.disabled');

  const renderGroup = (group: ToolbarItem[]) =>
    group.map((item) => (
      <EditorIslandButton
        key={item.action}
        label={t(item.labelKey)}
        disabled={disabled}
        disabledReason={disabledReason}
        onClick={() => onAction(item.action)}
      >
        <ToolIcon action={item.action} />
      </EditorIslandButton>
    ));

  const renderInsertItems = (close: () => void) =>
    INSERT_GROUP.map((item) => (
      <EditorIslandMenuItem
        key={item.action}
        icon={<ToolIcon action={item.action} />}
        disabled={disabled}
        disabledReason={disabledReason}
        onClick={() => {
          close();
          onAction(item.action);
        }}
      >
        {t(item.labelKey)}
      </EditorIslandMenuItem>
    ));

  return (
    <EditorIsland role="toolbar" aria-orientation="horizontal">
      {/* 撤销/重做：覆盖键盘输入与工具栏动作的文本历史栈 */}
      <EditorIslandButton
        label={t('general.undo')}
        disabled={disabled || !canUndo}
        disabledReason={t('editor.undo.disabled')}
        onClick={() => onUndo?.()}
      >
        <IslandUndoIcon />
      </EditorIslandButton>
      <EditorIslandButton
        label={t('general.redo')}
        disabled={disabled || !canRedo}
        disabledReason={t('editor.redo.disabled')}
        onClick={() => onRedo?.()}
      >
        <IslandRedoIcon />
      </EditorIslandButton>
      <EditorIslandSeparator />
      {renderGroup(INLINE_GROUP)}
      <EditorIslandSeparator />
      {renderGroup(HEADING_GROUP)}
      <EditorIslandSeparator />
      {renderGroup(LIST_GROUP)}
      <EditorIslandSeparator />
      {/* 「插入」下拉：桌面端常驻，窄屏收纳进「更多」 */}
      <EditorIslandDropdown
        className="editor-island__desktop-only"
        label={t('markdown.toolbar.insert')}
        disabled={disabled}
        disabledReason={disabledReason}
        icon={<IslandPlusIcon />}
      >
        {(close) => (
          <>
            <EditorIslandMenuTitle>{t('markdown.toolbar.insert')}</EditorIslandMenuTitle>
            {renderInsertItems(close)}
          </>
        )}
      </EditorIslandDropdown>
      {/* 「更多」：桌面端放操作提示，窄屏收纳插入动作与视图模式 */}
      <EditorIslandDropdown label={t('markdown.toolbar.more')} iconOnly icon={MoreIcon}>
        {(close) => (
          <>
            <div className="editor-island__mobile-block">
              <EditorIslandMenuTitle>{t('markdown.toolbar.insert')}</EditorIslandMenuTitle>
              {renderInsertItems(close)}
              <EditorIslandMenuSeparator />
              <EditorIslandMenuTitle>{t('markdown.mode.label')}</EditorIslandMenuTitle>
              {VIEW_MODES.map((viewMode) => (
                <EditorIslandMenuItem
                  key={viewMode.value}
                  current={mode === viewMode.value}
                  onClick={() => {
                    close();
                    onViewModeChange?.(viewMode.value);
                  }}
                >
                  {t(viewMode.labelKey)}
                </EditorIslandMenuItem>
              ))}
              <EditorIslandMenuSeparator />
            </div>
            <div className="editor-island-help">
              <div className="editor-island-help__title">{t('markdown.help.title')}</div>
              <p>{t('markdown.help.indent')}</p>
              <p>{t('markdown.help.list')}</p>
            </div>
          </>
        )}
      </EditorIslandDropdown>
    </EditorIsland>
  );
};
