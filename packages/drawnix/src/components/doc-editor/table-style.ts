import { TableCellData } from '../../data/tauri-file';

/** 单元格边框默认颜色（与表格编辑器一致） */
export const DEFAULT_TABLE_BORDER_COLOR = '#b4b4b4';

/** 默认列宽（px） */
export const DEFAULT_TABLE_COL_WIDTH = 96;

/** 默认行高（px） */
export const DEFAULT_TABLE_ROW_HEIGHT = 32;

/** 取整表生效的列宽，未自定义的列回退到默认宽度 */
export const getTableColWidths = (colWidths: number[] | undefined, cols: number): number[] =>
  Array.from({ length: cols }, (_, i) => colWidths?.[i] ?? DEFAULT_TABLE_COL_WIDTH);

/** 取整表生效的行高，未自定义的行回退到默认高度 */
export const getTableRowHeights = (rowHeights: number[] | undefined, rows: number): number[] =>
  Array.from({ length: rows }, (_, i) => rowHeights?.[i] ?? DEFAULT_TABLE_ROW_HEIGHT);

/** 文字效果（加粗/下划线/删除线）样式；textarea 需显式应用，不能依赖继承 */
export const buildTableTextEffectStyle = (cell: TableCellData): React.CSSProperties => {
  const style: React.CSSProperties = {};
  if (cell.bold) {
    style.fontWeight = 700;
  }
  const decorations = [
    cell.underline ? 'underline' : '',
    cell.strikethrough ? 'line-through' : '',
  ].filter(Boolean);
  if (decorations.length > 0) {
    style.textDecoration = decorations.join(' ');
  }
  return style;
};

/** 单元格完整样式（字号/颜色/背景/边框/对齐/文字效果），表格编辑器与只读预览共用 */
export const buildTableCellStyle = (cell: TableCellData): React.CSSProperties => {
  const style: React.CSSProperties = {};
  if (cell.fontSize) {
    style.fontSize = `${cell.fontSize}px`;
  }
  if (cell.color) {
    style.color = cell.color;
  }
  if (cell.bg) {
    style.backgroundColor = cell.bg;
  }
  const border = cell.border;
  const borderColor = border?.color || DEFAULT_TABLE_BORDER_COLOR;
  // 对齐方式未设置时保持默认的左对齐/顶端对齐
  style.textAlign = cell.align ?? 'left';
  style.verticalAlign = cell.valign ?? 'top';
  Object.assign(style, buildTableTextEffectStyle(cell));
  style.borderTop =
    border?.top === false ? 'none' : border?.top ? `1px solid ${borderColor}` : undefined;
  style.borderRight =
    border?.right === false ? 'none' : border?.right ? `1px solid ${borderColor}` : undefined;
  style.borderBottom =
    border?.bottom === false ? 'none' : border?.bottom ? `1px solid ${borderColor}` : undefined;
  style.borderLeft =
    border?.left === false ? 'none' : border?.left ? `1px solid ${borderColor}` : undefined;
  return style;
};
