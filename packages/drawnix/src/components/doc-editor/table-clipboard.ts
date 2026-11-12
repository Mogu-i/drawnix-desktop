import {
  TableCellStyle,
  TableCellData,
  TableFileData,
  buildEmptyTableCell,
} from '../../data/tauri-file';
import { DEFAULT_TABLE_COL_WIDTH, DEFAULT_TABLE_ROW_HEIGHT } from './table-style';

/**
 * 表格剪贴板纯函数模块：.table 编辑器的复制/粘贴协议与解析逻辑，
 * table-editor.tsx 只负责事件接线与提交，编解码/解析/落盘改写全部在此可测。
 *
 * 三层格式（粘贴解析优先级从高到低）：
 * 1. 自定义 MIME application/x-drawnix-table-cells：应用内无损（文本 + TableCellStyle），
 *    只存在于剪贴板，不写进磁盘文件（.table 的 schema 与 version 不变）。
 * 2. text/html 的 <table>：粘贴到 Excel/Word/网页的通用交换格式。
 * 3. text/plain 的 TSV（Excel/WPS 原生格式，含 CSV 引号转义）。
 */

/** 应用内无损粘贴的自定义 MIME；WebView2/Chromium 的 ClipboardEvent 支持 setData/getData，拿不到时上层自动降级 */
export const TABLE_CLIPBOARD_MIME = 'application/x-drawnix-table-cells';

/** 自定义 MIME 载荷：只含 text 与允许复制的 TableCellStyle 字段，不含 rowSpan/colSpan/hidden */
export type TableClipboardCell = { text: string } & TableCellStyle;

export type TableClipboardPayload = {
  version: 1;
  rows: number;
  cols: number;
  cells: TableClipboardCell[][];
};

export type CellRect = { r1: number; c1: number; r2: number; c2: number };

/** 允许随剪贴板复制的样式字段（TableCellStyle 全集，无合并相关字段） */
const STYLE_FIELD_KEYS = [
  'fontSize',
  'color',
  'bg',
  'border',
  'align',
  'valign',
  'bold',
  'underline',
  'strikethrough',
] as const satisfies readonly (keyof TableCellStyle)[];

/** 找到覆盖 (row, col) 的合并区域主单元格（table-editor 与剪贴板复制共用） */
export const findMasterCell = (
  data: TableFileData,
  row: number,
  col: number
): { row: number; col: number; cell: TableCellData } | null => {
  for (let r = 0; r < data.rows; r++) {
    for (let c = 0; c < data.cols; c++) {
      const cell = data.cells[r]?.[c];
      if (!cell || cell.hidden) {
        continue;
      }
      const rowSpan = cell.rowSpan ?? 1;
      const colSpan = cell.colSpan ?? 1;
      if (rowSpan > 1 || colSpan > 1) {
        if (row >= r && row < r + rowSpan && col >= c && col < c + colSpan) {
          return { row: r, col: c, cell };
        }
      }
    }
  }
  return null;
};

/** 解散以 (masterRow, masterCol) 为主单元格的合并区域（行列删除与合并操作共用） */
export const unmergeRegion = (
  data: TableFileData,
  masterRow: number,
  masterCol: number
) => {
  const master = data.cells[masterRow]?.[masterCol];
  if (!master) {
    return;
  }
  const rowSpan = master.rowSpan ?? 1;
  const colSpan = master.colSpan ?? 1;
  for (let r = masterRow; r < masterRow + rowSpan; r++) {
    for (let c = masterCol; c < masterCol + colSpan; c++) {
      const cell = data.cells[r]?.[c];
      if (!cell) {
        continue;
      }
      delete cell.rowSpan;
      delete cell.colSpan;
      delete cell.hidden;
    }
  }
};

/** 选区矩形内是否含合并单元格（取消合并按钮与粘贴拒绝共用） */
export const hasMergeInRect = (data: TableFileData, rect: CellRect) => {
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) {
      const cell = data.cells[r]?.[c];
      if (cell && (cell.hidden || (cell.rowSpan ?? 1) > 1 || (cell.colSpan ?? 1) > 1)) {
        return true;
      }
    }
  }
  return false;
};

// ---------------------------------------------------------------------------
// 复制侧：TableFileData 选区 -> 剪贴板三层格式
// ---------------------------------------------------------------------------

/** 拷贝单元格的 text 与允许的样式字段；合并相关字段不进入剪贴板 */
const buildClipboardCell = (cell: TableCellData): TableClipboardCell => {
  const out = { text: cell.text } as TableClipboardCell;
  STYLE_FIELD_KEYS.forEach((key) => {
    const value = cell[key];
    if (value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  });
  return out;
};

const isInsideRect = (rect: CellRect, row: number, col: number) =>
  row >= rect.r1 && row <= rect.r2 && col >= rect.c1 && col <= rect.c2;

/**
 * 把选区提取为无损载荷；合并覆盖格映射到主格：
 * 主格在选区内时留空（主格位置自会写出），不在选区内（部分选区）时写出主格文本，
 * 避免同一份内容在粘贴结果里重复出现。
 */
export const buildClipboardPayload = (
  data: TableFileData,
  rect: CellRect
): TableClipboardPayload => {
  const cells: TableClipboardCell[][] = [];
  for (let r = rect.r1; r <= rect.r2; r++) {
    const row: TableClipboardCell[] = [];
    for (let c = rect.c1; c <= rect.c2; c++) {
      const cell = data.cells[r]?.[c];
      if (cell?.hidden) {
        const master = findMasterCell(data, r, c);
        row.push(
          master && !isInsideRect(rect, master.row, master.col)
            ? buildClipboardCell(master.cell)
            : { text: '' }
        );
        continue;
      }
      row.push(buildClipboardCell(cell ?? buildEmptyTableCell()));
    }
    cells.push(row);
  }
  return { version: 1, rows: cells.length, cols: cells[0]?.length ?? 0, cells };
};

/** 取载荷/网格的纯文本矩阵，供 TSV/HTML 序列化 */
export const gridFromPayload = (payload: TableClipboardPayload): string[][] =>
  payload.cells.map((row) => row.map((cell) => cell.text));

/** TSV 单元格转义：含 \t/\n/\r/" 时按 CSV 规则加双引号包裹并把 " 转成 ""（与 Excel 导出行为一致） */
const encodeTsvField = (text: string): string =>
  /[\t\n\r"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

/** 文本矩阵 -> TSV（\t 分列、\n 分行，末尾不补空行） */
export const buildTsvFromGrid = (grid: string[][]): string =>
  grid.map((row) => row.map(encodeTsvField).join('\t')).join('\n');

/** 单元格文本 HTML 转义（& < > " '） */
export const escapeTableCellHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** 文本矩阵 -> <table><tr><td> HTML，供粘贴到 Excel/Word/网页 */
export const buildHtmlFromGrid = (grid: string[][]): string => {
  const rowsHtml = grid
    .map((row) => `<tr>${row.map((text) => `<td>${escapeTableCellHtml(text)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><tbody>${rowsHtml}</tbody></table>`;
};

// ---------------------------------------------------------------------------
// 粘贴侧：剪贴板内容 -> 文本矩阵
// ---------------------------------------------------------------------------

/**
 * 带引号的状态机分隔解析（TSV/CSV 共用）：
 * 引号包裹的字段内分隔符与换行不生效、" 转义为 ""；\r\n/\r 统一按行分隔；
 * 解析后去掉末尾整行为空的多余行。
 */
export const parseDelimitedGrid = (text: string, delimiter: string): string[][] => {
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  while (i < source.length) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i++;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== '' || row.length > 0) {
    pushRow();
  }
  while (rows.length > 1 && rows[rows.length - 1].every((value) => value === '')) {
    rows.pop();
  }
  if (rows.length === 1 && rows[0].length === 1 && rows[0][0] === '') {
    return [];
  }
  return rows;
};

/**
 * text/plain 分流：含 \t 走 TSV；含换行时含逗号走 CSV（避免 Excel 复制的单个
 * 含逗号单元格被误拆成多列），无逗号的多行文本按行拆成单列（Excel/WPS 行为）；
 * 单段（无分隔符无换行）返回 null 交给上层写当前单元格。
 */
export const parseTextGrid = (text: string): string[][] | null => {
  if (!text) {
    return null;
  }
  if (text.includes('\t')) {
    return parseDelimitedGrid(text, '\t');
  }
  if (!/\r|\n/.test(text)) {
    return null;
  }
  if (text.includes(',')) {
    return parseDelimitedGrid(text, ',');
  }
  // 统一 CR/LF/CRLF 为 LF 后按行拆分（charCode 构建，避免源码转义歧义）
  const cr = String.fromCharCode(13);
  const lf = String.fromCharCode(10);
  const normalized = text.split(cr + lf).join(lf).split(cr).join(lf);
  const lines = normalized.split(lf);
  while (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map((line) => [line]);
};

/** 从 HTML 中解析第一个 <table> 为文本矩阵；含 rowspan/colspan 时按占位展开并标记 hasMerge（上层降级为只填文本） */
export const parseHtmlTableGrid = (
  html: string
): { grid: string[][]; hasMerge: boolean } | null => {
  if (!html || !/<table[\s>]/i.test(html)) {
    return null;
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) {
    return null;
  }
  const rows: string[][] = [];
  const occupied = new Set<string>();
  let hasMerge = false;
  // 认领 (row, col)：未被占过时登记占用并返回 true，否则返回 false
  const claim = (row: number, col: number) => {
    rows[row] = rows[row] ?? [];
    const key = `${row}:${col}`;
    if (occupied.has(key)) {
      return false;
    }
    occupied.add(key);
    return true;
  };
  Array.from(table.querySelectorAll('tr')).forEach((tr, r) => {
    let c = 0;
    Array.from(tr.children).forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag !== 'td' && tag !== 'th') {
        return;
      }
      while (!claim(r, c)) {
        c += 1;
      }
      const rowSpan = Number(el.getAttribute('rowspan') ?? 1) || 1;
      const colSpan = Number(el.getAttribute('colspan') ?? 1) || 1;
      const text = (el.textContent ?? '').replace(/\u00a0/g, ' ');
      if (rowSpan > 1 || colSpan > 1) {
        hasMerge = true;
      }
      rows[r][c] = text;
      for (let rr = r; rr < r + rowSpan; rr++) {
        for (let cc = c; cc < c + colSpan; cc++) {
          if (rr === r && cc === c) {
            continue;
          }
          claim(rr, cc);
          rows[rr][cc] = '';
        }
      }
      c += colSpan;
    });
  });
  if (!rows.length) {
    return null;
  }
  const colCount = Math.max(...rows.map((row) => row.length));
  const grid = rows.map((row) => Array.from({ length: colCount }, (_, i) => row[i] ?? ''));
  return { grid, hasMerge };
};

/** 校验并解析自定义 MIME 载荷；形状/版本不符时返回 null（上层降级到 HTML/TSV） */
export const decodeClipboardPayload = (json: string): TableClipboardPayload | null => {
  try {
    const value = JSON.parse(json) as TableClipboardPayload;
    if (!value || value.version !== 1 || typeof value.rows !== 'number') {
      return null;
    }
    if (typeof value.cols !== 'number' || !Array.isArray(value.cells)) {
      return null;
    }
    if (value.cells.length !== value.rows || value.rows < 1 || value.cols < 1) {
      return null;
    }
    for (const row of value.cells) {
      if (!Array.isArray(row) || row.length !== value.cols) {
        return null;
      }
      for (const cell of row) {
        if (!cell || typeof cell.text !== 'string') {
          return null;
        }
      }
    }
    return value;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// 粘贴落盘：一次 structuredClone + 扩行列 + 覆盖（整次粘贴只 commit 一次）
// ---------------------------------------------------------------------------

export type PasteApplyResult = {
  next: TableFileData;
  /** 粘贴区域最后一格（选区扩展用） */
  endRow: number;
  endCol: number;
};

/**
 * 把载荷（无损）或文本矩阵（只写文本）写入目标起点，超出当前行列时自动扩：
 * cells 用 buildEmptyTableCell 补齐，colWidths/rowHeights 用默认尺寸补齐。
 */
export const applyPasteToData = (
  data: TableFileData,
  options: {
    payload?: TableClipboardPayload | null;
    grid?: string[][] | null;
    targetRow: number;
    targetCol: number;
  }
): PasteApplyResult | null => {
  const { payload, grid, targetRow, targetCol } = options;
  const source: (TableClipboardCell | string)[][] | null = payload?.cells ?? grid ?? null;
  if (!source || !source.length) {
    return null;
  }
  const rowCount = source.length;
  const colCount = Math.max(...source.map((row) => row.length));
  if (rowCount < 1 || colCount < 1) {
    return null;
  }
  const next: TableFileData = structuredClone(data);
  while (next.rows < targetRow + rowCount) {
    next.cells.push(Array.from({ length: next.cols }, buildEmptyTableCell));
    next.rowHeights?.push(DEFAULT_TABLE_ROW_HEIGHT);
    next.rows += 1;
  }
  while (next.cols < targetCol + colCount) {
    next.cells.forEach((row) => row.push(buildEmptyTableCell()));
    next.colWidths?.push(DEFAULT_TABLE_COL_WIDTH);
    next.cols += 1;
  }
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const cell = next.cells[targetRow + r]?.[targetCol + c];
      const value = source[r][c];
      if (!cell || value === undefined) {
        continue;
      }
      if (payload) {
        const clipboardCell = value as TableClipboardCell;
        // 内部格式：覆盖 text 与全部允许的样式字段（源无该字段时清除目标旧值）
        delete cell.rowSpan;
        delete cell.colSpan;
        delete cell.hidden;
        STYLE_FIELD_KEYS.forEach((key) => {
          delete (cell as Record<string, unknown>)[key];
        });
        cell.text = clipboardCell.text;
        STYLE_FIELD_KEYS.forEach((key) => {
          const styleValue = clipboardCell[key];
          if (styleValue !== undefined) {
            (cell as Record<string, unknown>)[key] = styleValue;
          }
        });
        continue;
      }
      cell.text = typeof value === 'string' ? value : (value as TableClipboardCell).text;
    }
  }
  return { next, endRow: targetRow + rowCount - 1, endCol: targetCol + colCount - 1 };
};
