// Markdown 编辑器格式化工具：所有操作均为纯文本变换，
// 输入源码与选区，输出新源码与应恢复的光标选区，便于复用与测试
export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inlineCode'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'unorderedList'
  | 'orderedList'
  | 'taskList'
  | 'quote'
  | 'codeBlock'
  | 'link'
  | 'image'
  | 'table'
  | 'horizontalRule';

export type MarkdownEditResult = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

export type MarkdownActionOptions = {
  /** 插入表格时使用的模板 */
  tableTemplate?: string;
  /** 无选中内容插入链接时使用的占位文字 */
  linkPlaceholder?: string;
  /** 无选中内容插入图片时使用的占位 alt */
  imagePlaceholder?: string;
};

const RESULT = (
  text: string,
  selectionStart: number,
  selectionEnd: number
): MarkdownEditResult => ({
  text,
  selectionStart,
  selectionEnd,
});

// ----- 行内格式（加粗/斜体/删除线/行内代码）：包裹选区，已包裹时取消 -----

const INLINE_MARKERS: Partial<Record<MarkdownAction, string>> = {
  bold: '**',
  italic: '*',
  strikethrough: '~~',
  inlineCode: '`',
};

const applyInlineWrap = (text: string, start: number, end: number, marker: string) => {
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);
  // 选区两侧已是同一包裹符时视为取消格式
  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= marker.length * 2
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return RESULT(before + inner + after, start, start + inner.length);
  }
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return RESULT(
      before.slice(0, before.length - marker.length) + selected + after.slice(marker.length),
      start - marker.length,
      end - marker.length
    );
  }
  const next = `${before}${marker}${selected}${marker}${after}`;
  const wrapStart = start + marker.length;
  return RESULT(next, wrapStart, wrapStart + selected.length);
};

// ----- 行级格式（标题/列表/引用）：作用于选区覆盖的整行 -----

/** 行首已有的 Markdown 前缀（标题/列表/任务/引用/有序），用于替换前清理 */
const EXISTING_PREFIX_PATTERN = /^(#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|>\s?|\d+[.)]\s+)/;

const transformSelectedLines = (
  text: string,
  start: number,
  end: number,
  transformLine: (line: string, index: number) => string
): MarkdownEditResult => {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextNewline = text.indexOf('\n', end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const transformed = lines.map(transformLine).join('\n');
  const next = text.slice(0, lineStart) + transformed + text.slice(lineEnd);
  // 应用后选中整个被处理的行块，便于连续调整
  return RESULT(next, lineStart, lineStart + transformed.length);
};

/** 行前缀开关：所有行已带前缀则移除，否则清理旧行首标记后统一添加 */
const toggleLinePrefix = (prefix: string | ((index: number) => string)) => {
  return (line: string, index: number): string => {
    const current = typeof prefix === 'string' ? prefix : prefix(index);
    if (line.startsWith(current)) {
      return line.slice(current.length);
    }
    return current + line.replace(EXISTING_PREFIX_PATTERN, '');
  };
};

const applyHeading = (level: 1 | 2 | 3) => {
  const prefix = `${'#'.repeat(level)} `;
  return (text: string, start: number, end: number) =>
    transformSelectedLines(text, start, end, toggleLinePrefix(prefix));
};

const applyBlockPrefix = (action: 'unorderedList' | 'orderedList' | 'taskList' | 'quote') => {
  return (text: string, start: number, end: number) => {
    const prefixFor =
      action === 'orderedList'
        ? (index: number) => `${index + 1}. `
        : action === 'taskList'
          ? '- [ ] '
          : action === 'quote'
            ? '> '
            : '- ';
    return transformSelectedLines(text, start, end, toggleLinePrefix(prefixFor));
  };
};

// ----- 块级插入（代码块/链接/图片/表格/分割线） -----

const applyCodeBlock = (text: string, start: number, end: number) => {
  const selected = text.slice(start, end);
  // 前一行非空时先补换行，避免围栏与前文粘连
  const leadingNewline = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const trailingNewline = selected.endsWith('\n') ? '' : '\n';
  const fence = '```';
  const content = leadingNewline + fence + '\n' + selected + trailingNewline + fence + '\n';
  const next = text.slice(0, start) + content + text.slice(end);
  if (selected) {
    // 有选区：保留选中内容并选中它
    const innerStart = start + leadingNewline.length + 4;
    return RESULT(next, innerStart, innerStart + selected.length);
  }
  // 无选区：光标定位到围栏内部
  const cursor = start + leadingNewline.length + 4;
  return RESULT(next, cursor, cursor);
};

const applyLink = (text: string, start: number, end: number, placeholder: string) => {
  const selected = text.slice(start, end);
  const label = selected || placeholder;
  const before = `${text.slice(0, start)}[${label}](`;
  const after = `)${text.slice(end)}`;
  const next = before + after;
  if (selected) {
    // 有选区：选中文本作为链接文字，选中 URL 便于直接粘贴
    const urlStart = before.length;
    return RESULT(next, urlStart, urlStart);
  }
  // 无选区：选中占位文字，输入即替换
  const labelStart = start + 1;
  return RESULT(next, labelStart, labelStart + label.length);
};

const applyImage = (text: string, start: number, end: number, placeholder: string) => {
  const selected = text.slice(start, end);
  const alt = selected || placeholder;
  const next = `${text.slice(0, start)}![${alt}](url)${text.slice(end)}`;
  // 无选区时选中 alt 占位，有选区时同样选中 alt 便于确认
  const altStart = start + 2;
  return RESULT(next, altStart, altStart + alt.length);
};

const applyTable = (text: string, start: number, end: number, template: string) => {
  const leadingNewline = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const block = `${leadingNewline}${template}\n`;
  const next = text.slice(0, start) + block + text.slice(end);
  // 光标定位到表格首行内容处，便于直接修改表头
  const cursor = start + leadingNewline.length + template.indexOf('|') + 1;
  return RESULT(next, cursor, cursor);
};

const applyHorizontalRule = (text: string, start: number, end: number) => {
  const leadingNewline = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const block = `${leadingNewline}---\n`;
  const next = text.slice(0, start) + block + text.slice(end);
  const cursor = start + block.length;
  return RESULT(next, cursor, cursor);
};

const DEFAULT_TABLE_TEMPLATE =
  '| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n|  |  |  |';

/**
 * 对源码应用工具栏动作，返回新源码与应恢复的光标选区
 */
export const applyMarkdownAction = (
  action: MarkdownAction,
  text: string,
  start: number,
  end: number,
  options: MarkdownActionOptions = {}
): MarkdownEditResult => {
  const inlineMarker = INLINE_MARKERS[action];
  if (inlineMarker) {
    return applyInlineWrap(text, start, end, inlineMarker);
  }
  switch (action) {
    case 'h1':
      return applyHeading(1)(text, start, end);
    case 'h2':
      return applyHeading(2)(text, start, end);
    case 'h3':
      return applyHeading(3)(text, start, end);
    case 'unorderedList':
    case 'orderedList':
    case 'taskList':
    case 'quote':
      return applyBlockPrefix(action)(text, start, end);
    case 'codeBlock':
      return applyCodeBlock(text, start, end);
    case 'link':
      return applyLink(text, start, end, options.linkPlaceholder ?? 'text');
    case 'image':
      return applyImage(text, start, end, options.imagePlaceholder ?? 'alt');
    case 'table':
      return applyTable(text, start, end, options.tableTemplate ?? DEFAULT_TABLE_TEMPLATE);
    case 'horizontalRule':
      return applyHorizontalRule(text, start, end);
    default:
      return RESULT(text, start, end);
  }
};

/** 行首列表/引用前缀（含缩进）：任务列表优先于普通列表匹配 */
const LIST_PREFIX_PATTERN = /^([ \t]*)([-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+[.)][ \t]+|>[ \t]?)/;

/**
 * 光标位于列表/引用行内按回车时的自动续写：
 * - 普通行返回 null，由浏览器执行默认换行；
 * - 列表项回车后自动补上同样的前缀（有序列表编号递增）；
 * - 空列表项（只有前缀无内容）回车时移除前缀退出列表。
 */
export const continueListOnEnter = (text: string, cursor: number): MarkdownEditResult | null => {
  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
  const nextNewline = text.indexOf('\n', cursor);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const line = text.slice(lineStart, lineEnd);
  const match = line.match(LIST_PREFIX_PATTERN);
  if (!match) {
    return null;
  }
  const [, indent, prefix] = match;
  const contentAfterPrefix = line.slice(indent.length + prefix.length);

  // 空列表项：移除前缀退出列表，光标留在原行（此时已无前缀）
  if (contentAfterPrefix.trim() === '') {
    const next = text.slice(0, lineStart + indent.length) + text.slice(lineEnd);
    const pos = lineStart + indent.length;
    return RESULT(next, pos, pos);
  }

  // 有序列表编号递增，其余前缀（含任务列表）原样延续
  const orderedMatch = prefix.match(/^(\d+)([.)])([ \t]+)/);
  const nextPrefix = orderedMatch
    ? `${Number(orderedMatch[1]) + 1}${orderedMatch[2]}${orderedMatch[3]}`
    : prefix;
  const insert = `\n${indent}${nextPrefix}`;
  const next = text.slice(0, cursor) + insert + text.slice(cursor);
  const pos = cursor + insert.length;
  return RESULT(next, pos, pos);
};

/** 缩进单位：两个空格，配合列表前缀实现嵌套 */
const INDENT_UNIT = '  ';

/** 单行反缩进：移除行首最多两个空格或一个制表符，返回新行与移除长度 */
const outdentLine = (line: string): [string, number] => {
  if (line.startsWith('\t')) {
    return [line.slice(1), 1];
  }
  let spaces = 0;
  while (spaces < INDENT_UNIT.length && line[spaces] === ' ') {
    spaces += 1;
  }
  return [line.slice(spaces), spaces];
};

/**
 * Tab/Shift+Tab 缩进：
 * - 无选区缩进时在光标处插入缩进单位；
 * - 无选区反缩进时移除当前行行首缩进并相应调整光标；
 * - 有选区时作用于选区覆盖的整行，并选中处理后的行块。
 */
export const indentSelection = (
  text: string,
  start: number,
  end: number,
  direction: 'indent' | 'outdent'
): MarkdownEditResult => {
  // 无选区 + 缩进：直接在光标处插入缩进单位
  if (start === end && direction === 'indent') {
    const next = text.slice(0, start) + INDENT_UNIT + text.slice(start);
    const pos = start + INDENT_UNIT.length;
    return RESULT(next, pos, pos);
  }

  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const nextNewline = text.indexOf('\n', end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const lines = text.slice(lineStart, lineEnd).split('\n');

  // 第一行缩进变化量用于无选区反缩进时的光标回退
  let firstLineDelta = 0;
  const transformed = lines
    .map((line, index) => {
      if (direction === 'indent') {
        return INDENT_UNIT + line;
      }
      const [outdented, removed] = outdentLine(line);
      if (index === 0) {
        firstLineDelta = removed;
      }
      return outdented;
    })
    .join('\n');
  const next = text.slice(0, lineStart) + transformed + text.slice(lineEnd);

  if (start === end) {
    // 无选区反缩进：光标在移除范围内时落到行首，否则随文本左移
    const pos = start <= lineStart + firstLineDelta ? lineStart : start - firstLineDelta;
    return RESULT(next, pos, pos);
  }
  // 有选区：选中整个处理后的行块，便于连续调整
  return RESULT(next, lineStart, lineStart + transformed.length);
};

const FENCE_LINE_PATTERN = /^\s*(```|~~~)/;

const TASK_ITEM_PATTERN = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)\[([ xX])\]/;

/**
 * 切换文档中第 index 个任务列表项的勾选状态（按出现顺序，
 * 与预览区渲染出的复选框顺序一致）；代码围栏内的内容不参与计数
 */
export const toggleTaskItem = (text: string, index: number): string => {
  const lines = text.split('\n');
  let taskIndex = 0;
  let inFence = false;
  return lines
    .map((line) => {
      if (FENCE_LINE_PATTERN.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) {
        return line;
      }
      const match = line.match(TASK_ITEM_PATTERN);
      if (!match || taskIndex++ !== index) {
        return line;
      }
      const [, prefix, mark] = match;
      return `${prefix}[${mark === ' ' ? 'x' : ' '}]${line.slice(match[0].length)}`;
    })
    .join('\n');
};
