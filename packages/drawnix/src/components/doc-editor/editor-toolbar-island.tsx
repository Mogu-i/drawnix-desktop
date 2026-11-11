import * as React from 'react';
import classNames from 'classnames';
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  Placement,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { Island } from '../island';
import { ChevronDownIcon, ThickCheckIcon } from '../icons';
import { useI18n } from '../../i18n';
import type { Translations } from '../../i18n/types';
import { CLASSIC_COLORS, NO_COLOR } from '../../constants/color';
import './editor-toolbar-island.scss';

// ============================================================
// 16px 线性小图标：与 Markdown/表格工具栏既有图标同一风格
// （fill: none / stroke: currentColor / 1.5 线宽，由 SCSS 统一提供）
// ============================================================

/** 小加号（「插入」下拉触发器） */
export const IslandPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <line x1="8" y1="3" x2="8" y2="13" />
    <line x1="3" y1="8" x2="13" y2="8" />
  </svg>
);

/** 表格网格（「行列」下拉触发器） */
export const IslandGridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2" y="3" width="12" height="10" rx="1" />
    <line x1="2" y1="6.5" x2="14" y2="6.5" />
    <line x1="6.5" y1="6.5" x2="6.5" y2="13" />
  </svg>
);

/** 插入行 */
export const IslandRowPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <line x1="2" y1="4.5" x2="10" y2="4.5" />
    <line x1="2" y1="8" x2="10" y2="8" />
    <line x1="2" y1="11.5" x2="10" y2="11.5" />
    <line x1="13" y1="5.5" x2="13" y2="10.5" />
    <line x1="10.5" y1="8" x2="15.5" y2="8" />
  </svg>
);

/** 删除行 */
export const IslandRowMinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <line x1="2" y1="4.5" x2="10" y2="4.5" />
    <line x1="2" y1="8" x2="10" y2="8" />
    <line x1="2" y1="11.5" x2="10" y2="11.5" />
    <line x1="10.5" y1="8" x2="15.5" y2="8" />
  </svg>
);

/** 插入列（行加号转置 90°） */
export const IslandColPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <line x1="4.5" y1="2" x2="4.5" y2="10" />
    <line x1="8" y1="2" x2="8" y2="10" />
    <line x1="11.5" y1="2" x2="11.5" y2="10" />
    <line x1="8" y1="10.5" x2="8" y2="15.5" />
    <line x1="5.5" y1="13" x2="10.5" y2="13" />
  </svg>
);

/** 删除列 */
export const IslandColMinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <line x1="4.5" y1="2" x2="4.5" y2="10" />
    <line x1="8" y1="2" x2="8" y2="10" />
    <line x1="11.5" y1="2" x2="11.5" y2="10" />
    <line x1="8" y1="10.5" x2="8" y2="15.5" />
  </svg>
);

/** 合并单元格：合并后的整格 + 内部虚线表示界线已取消 */
export const IslandMergeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2" y="5" width="12" height="6" rx="1" />
    <line x1="8" y1="5" x2="8" y2="11" strokeDasharray="2 2" />
  </svg>
);

/** 取消合并：整格 + 重新出现的界线 */
export const IslandUnmergeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2" y="2.5" width="12" height="11" rx="1" />
    <line x1="8" y1="2.5" x2="8" y2="13.5" />
  </svg>
);

/** 边框 */
export const IslandBorderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
    <line x1="8" y1="2.5" x2="8" y2="13.5" strokeDasharray="2 2" />
    <line x1="2.5" y1="8" x2="13.5" y2="8" strokeDasharray="2 2" />
  </svg>
);

/** 文字颜色：A 字形 */
export const IslandTextColorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 13 L8 3 L13 13" />
    <line x1="5.2" y1="9.5" x2="10.8" y2="9.5" />
  </svg>
);

/** 填充颜色：提桶 */
export const IslandFillIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 6 H12.5 L11.5 13.5 H4.5 Z" />
    <path d="M5.5 6 a2.5 2.5 0 0 1 5 0" />
  </svg>
);

/** 帮助 */
export const IslandHelpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6.2" />
    <path d="M6.3 6.2a1.8 1.8 0 1 1 2.6 1.7c-.6.3-.9.6-.9 1.2" />
    <circle cx="8" cy="11.4" r="0.7" fill="currentColor" stroke="none" />
  </svg>
);

/** 对齐图标线段坐标（16x16 视图框），h 为水平三横线，v 为垂直三竖线 */
const ALIGN_ICON_LINES: Record<string, [number, number][]> = {
  'h-left': [
    [2, 10],
    [2, 14],
    [2, 8],
  ],
  'h-center': [
    [3, 13],
    [5, 11],
    [2, 14],
  ],
  'h-right': [
    [6, 14],
    [2, 14],
    [8, 14],
  ],
  'v-top': [
    [2, 10],
    [2, 14],
    [2, 8],
  ],
  'v-middle': [
    [3, 13],
    [5, 11],
    [2, 14],
  ],
  'v-bottom': [
    [6, 14],
    [2, 14],
    [8, 14],
  ],
};

/** 水平/垂直对齐图标（原 table-editor AlignIcon 迁入共用） */
export const AlignIcon = ({ variant }: { variant: string }) => {
  const vertical = variant.startsWith('v-');
  const lines = ALIGN_ICON_LINES[variant] ?? [];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {lines.map(([a, b], i) =>
        vertical ? (
          <line key={i} x1={4 + i * 4} y1={a} x2={4 + i * 4} y2={b} />
        ) : (
          <line key={i} x1={a} y1={4 + i * 4} x2={b} y2={4 + i * 4} />
        )
      )}
    </svg>
  );
};

// ============================================================
// 壳与基础控件
// ============================================================

// 主题变量与 Island 样式都定义在 .drawnix 根节点上，浮层必须 portal
// 进根节点内部才能继承变量与暗色主题（应用为单实例，查询一次即可）。
// 不能在渲染期同步查询：会话恢复的编辑器与根节点同帧渲染，
// 那一刻 .drawnix 还未提交进 DOM，拿到 null 会让 FloatingPortal(root=null)
// 静默跳过挂载且不再重试（root === null 直接 return），浮层永不出现。
// 因此放到挂载后解析，点击打开浮层时容器必然就绪。
export const useDrawnixContainer = () => {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setContainer(document.querySelector<HTMLElement>('.drawnix'));
  }, []);
  return container;
};

type EditorIslandProps = React.HTMLAttributes<HTMLDivElement>;

// 工具岛外壳：Island padding 1.25 × 0.25rem = 5px
export const EditorIsland = ({ children, className, ...rest }: EditorIslandProps) => (
  <Island padding={1.25} className={classNames('editor-island', className)} {...rest}>
    {children}
  </Island>
);

type EditorIslandButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  /** 禁用时的恢复条件说明（写入 title，替代不可用的默认提示） */
  disabledReason?: string;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'disabled'>;

export const EditorIslandButton = ({
  label,
  active,
  disabled,
  disabledReason,
  className,
  children,
  onClick,
  ...rest
}: EditorIslandButtonProps) => (
  <button
    type="button"
    className={classNames('editor-island__btn', { 'editor-island__btn--active': active }, className)}
    title={disabled && disabledReason ? disabledReason : label}
    aria-label={label}
    disabled={disabled}
    // 阻止按钮夺焦，编辑区（textarea/单元格）光标选区不丢失
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    {...rest}
  >
    {children}
  </button>
);

type EditorIslandDropdownProps = {
  label: string;
  icon?: React.ReactNode;
  /** 纯图标触发器（帮助/更多），不渲染文字与 chevron */
  iconOnly?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  placement?: Placement;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
};

// 岛内下拉触发器 + 浮层菜单：浮层 portal 到 .drawnix 内，
// modal={false} + initialFocus={-1} 不抢编辑区焦点（与 Select.Content 一致）
export const EditorIslandDropdown = ({
  label,
  icon,
  iconOnly,
  disabled,
  disabledReason,
  className,
  placement = 'bottom-start',
  children,
}: EditorIslandDropdownProps) => {
  const [open, setOpen] = React.useState(false);
  const container = useDrawnixContainer();

  const { refs, floatingStyles, context } = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [offset(10), flip({ padding: 5 }), shift({ padding: 5 })],
  });
  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'menu' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const close = React.useCallback(() => setOpen(false), []);
  const content = typeof children === 'function' ? children(close) : children;

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        className={classNames('editor-island__btn', 'editor-island__btn--drop', className)}
        data-state={open ? 'open' : 'closed'}
        title={disabled && disabledReason ? disabledReason : label}
        aria-label={label}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        {...getReferenceProps()}
      >
        {icon}
        {!iconOnly && <span>{label}</span>}
        {!iconOnly && <span className="editor-island__chev">{ChevronDownIcon}</span>}
      </button>
      {open && (
        <FloatingPortal root={container}>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              className="editor-island-pop"
              // 与 PopoverContent 同层：弹窗附属浮层层级（G4）
              style={{ zIndex: 71, ...floatingStyles }}
              {...getFloatingProps()}
            >
              <div className="editor-island-pop__inner">{content}</div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
};

type EditorIslandMenuItemProps = {
  icon?: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
};

export const EditorIslandMenuItem = ({
  icon,
  current,
  disabled,
  disabledReason,
  onClick,
  className,
  children,
}: EditorIslandMenuItemProps) => (
  <button
    type="button"
    role="menuitem"
    className={classNames('editor-island-pop__item', className)}
    title={disabled && disabledReason ? disabledReason : undefined}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
  >
    {icon && <span className="editor-island-pop__item-icon">{icon}</span>}
    <span className="editor-island-pop__item-label">{children}</span>
    <span className="editor-island-pop__item-check">{current ? ThickCheckIcon : null}</span>
  </button>
);

type EditorIslandMenuTitleProps = {
  className?: string;
  children?: React.ReactNode;
};

export const EditorIslandMenuTitle = ({ className, children }: EditorIslandMenuTitleProps) => (
  <div className={classNames('editor-island-pop__title', className)}>{children}</div>
);

export const EditorIslandMenuSeparator = ({ className }: { className?: string }) => (
  <div className={classNames('editor-island-pop__sep', className)} />
);

// 岛内组间分隔线
export const EditorIslandSeparator = () => <span className="editor-island__sep" />;

// ============================================================
// 轻量色板
// ============================================================

// CLASSIC_COLORS 中的 NO_COLOR 不是合法 CSS 颜色（仅作「无颜色」语义），
// 表格色板过滤掉；DEFAULT_COLOR 为 Plait 默认描边色，可正常渲染
const SWATCH_COLORS = CLASSIC_COLORS.filter((color) => color.value !== NO_COLOR);

type EditorColorSwatchesProps = {
  /** 当前生效颜色（无则不高亮任何色块） */
  value?: string;
  /** 色板 aria 标签（由调用方按用途传「字体颜色/填充颜色」） */
  ariaLabel: string;
  onColorChange: (color: string) => void;
};

export const EditorColorSwatches = ({ value, ariaLabel, onColorChange }: EditorColorSwatchesProps) => {
  const { t } = useI18n();
  return (
    <div className="editor-island-pop__swatches" role="listbox" aria-label={ariaLabel}>
      {SWATCH_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          role="option"
          aria-selected={value === color.value}
          title={t(color.name as keyof Translations)}
          className={classNames('editor-island-pop__swatch', {
            'editor-island-pop__swatch--picked': value === color.value,
          })}
          style={{ background: color.value }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onColorChange(color.value)}
        />
      ))}
    </div>
  );
};
