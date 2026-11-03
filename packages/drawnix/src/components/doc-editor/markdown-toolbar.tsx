import { Fragment, ReactElement } from 'react';
import { useI18n } from '../../i18n';
import type { Translations } from '../../i18n/types';
import type { MarkdownAction } from './markdown-format';

// 16x16 线性小图标，风格与表格编辑器工具栏保持一致
const ListIcon = ({ ordered }: { ordered?: boolean }) => (
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
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
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <rect x="1.8" y="3.4" width="3.4" height="3.4" rx="0.5" />
    <path d="M2.6 5.1l1 1 1.4-1.8" />
    <rect x="1.8" y="9.4" width="3.4" height="3.4" rx="0.5" />
    <line x1="7.5" y1="5.1" x2="14.5" y2="5.1" />
    <line x1="7.5" y1="11.1" x2="14.5" y2="11.1" />
  </svg>
);

const QuoteIcon = () => (
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path d="M3 3.5v9" strokeWidth="2" />
    <path d="M6.5 5h7M6.5 8h7M6.5 11h4.5" />
  </svg>
);

const InlineCodeIcon = () => (
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path d="M5 4.5L1.8 8L5 11.5" />
    <path d="M11 4.5L14.2 8L11 11.5" />
    <path d="M9.2 3.5L6.8 12.5" />
  </svg>
);

const CodeBlockIcon = () => (
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path d="M5.5 2.5H3.2a.7.7 0 0 0-.7.7v2.8" />
    <path d="M10.5 2.5h2.3a.7.7 0 0 1 .7.7v2.8" />
    <path d="M5.5 13.5H3.2a.7.7 0 0 1-.7-.7V10" />
    <path d="M10.5 13.5h2.3a.7.7 0 0 0 .7-.7V10" />
    <line x1="5" y1="8" x2="11" y2="8" />
  </svg>
);

const TableIcon = () => (
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="0.8" />
    <line x1="1.8" y1="6.4" x2="14.2" y2="6.4" />
    <line x1="8" y1="6.4" x2="8" y2="13.2" />
  </svg>
);

const LinkIcon = () => (
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path d="M6.5 9.5l3-3" />
    <path d="M7.5 4.9l1.2-1.2a2.4 2.4 0 0 1 3.4 3.4l-1.2 1.2" />
    <path d="M8.5 11.1l-1.2 1.2a2.4 2.4 0 0 1-3.4-3.4l1.2-1.2" />
  </svg>
);

const ImageIcon = () => (
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <rect x="2" y="3" width="12" height="10" rx="1" />
    <circle cx="5.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
    <path d="M3 11.8l3-3 3.5 3.5" />
    <path d="M10 10.8l1.5-1.5 1.8 1.8" />
  </svg>
);

const HorizontalRuleIcon = () => (
  <svg
    className="markdown-editor__tool-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <line x1="2" y1="8" x2="14" y2="8" />
  </svg>
);

/** 工具按钮图标：文字字形 + 线性 SVG，与表格编辑器视觉风格统一 */
const ToolIcon = ({ action }: { action: MarkdownAction }): ReactElement => {
  switch (action) {
    case 'bold':
      return <span className="markdown-editor__glyph markdown-editor__glyph--bold">B</span>;
    case 'italic':
      return <span className="markdown-editor__glyph markdown-editor__glyph--italic">I</span>;
    case 'strikethrough':
      return <span className="markdown-editor__glyph markdown-editor__glyph--strike">S</span>;
    case 'h1':
    case 'h2':
    case 'h3':
      return (
        <span className="markdown-editor__glyph">
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

/** 工具栏按钮按功能分组展示，组间以分隔线隔开 */
const TOOLBAR_GROUPS: ToolbarItem[][] = [
  [
    { action: 'bold', labelKey: 'markdown.toolbar.bold' },
    { action: 'italic', labelKey: 'markdown.toolbar.italic' },
    { action: 'strikethrough', labelKey: 'markdown.toolbar.strikethrough' },
    { action: 'inlineCode', labelKey: 'markdown.toolbar.inlineCode' },
  ],
  [
    { action: 'h1', labelKey: 'markdown.toolbar.heading1' },
    { action: 'h2', labelKey: 'markdown.toolbar.heading2' },
    { action: 'h3', labelKey: 'markdown.toolbar.heading3' },
  ],
  [
    { action: 'unorderedList', labelKey: 'markdown.toolbar.unorderedList' },
    { action: 'orderedList', labelKey: 'markdown.toolbar.orderedList' },
    { action: 'taskList', labelKey: 'markdown.toolbar.taskList' },
    { action: 'quote', labelKey: 'markdown.toolbar.quote' },
  ],
  [
    { action: 'codeBlock', labelKey: 'markdown.toolbar.codeBlock' },
    { action: 'link', labelKey: 'markdown.toolbar.link' },
    { action: 'image', labelKey: 'markdown.toolbar.image' },
    { action: 'table', labelKey: 'markdown.toolbar.table' },
    { action: 'horizontalRule', labelKey: 'markdown.toolbar.horizontalRule' },
  ],
];

// Markdown 编辑区格式化工具栏：点击后由编辑器作用于当前光标/选区
export const MarkdownToolbar = ({
  onAction,
  disabled,
}: {
  onAction: (action: MarkdownAction) => void;
  disabled?: boolean;
}) => {
  const { t } = useI18n();

  return (
    <div className="markdown-editor__toolbar" role="toolbar" aria-orientation="horizontal">
      {TOOLBAR_GROUPS.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 && <span className="markdown-editor__separator" />}
          {group.map((item) => (
            <button
              key={item.action}
              type="button"
              className="markdown-editor__tool-button"
              title={t(item.labelKey)}
              aria-label={t(item.labelKey)}
              disabled={disabled}
              // 阻止按钮夺焦，保证 textarea 中的光标选区不丢失
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onAction(item.action)}
            >
              <ToolIcon action={item.action} />
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
};
