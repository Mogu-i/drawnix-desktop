import { describe, expect, it } from 'vitest';
import {
  applyPasteToData,
  buildClipboardPayload,
  buildHtmlFromGrid,
  buildTsvFromGrid,
  decodeClipboardPayload,
  findMasterCell,
  hasMergeInRect,
  parseDelimitedGrid,
  parseHtmlTableGrid,
  parseTextGrid,
} from './table-clipboard';
import { DEFAULT_TABLE_COL_WIDTH, DEFAULT_TABLE_ROW_HEIGHT } from './table-style';
import { buildEmptyTableCell, type TableFileData } from '../../data/tauri-file';

const buildData = (
  rows: number,
  cols: number,
  fill?: (r: number, c: number) => string
): TableFileData => ({
  type: 'drawnix-table',
  version: 1,
  rows,
  cols,
  cells: Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ text: fill?.(r, c) ?? `r${r}c${c}` }))
  ),
});

describe('TSV / HTML 序列化', () => {
  it('buildTsvFromGrid 用制表符分列、换行分行，末尾不补空行', () => {
    expect(buildTsvFromGrid([['a', 'b'], ['c', 'd']])).toBe('a\tb\nc\td');
  });

  it('含制表符/换行/引号的字段按 CSV 规则加引号并把 " 转成 ""', () => {
    expect(buildTsvFromGrid([['x\ty'], ['line1\nline2'], ['say "hi"']])).toBe(
      '"x\ty"\n"line1\nline2"\n"say ""hi"""'
    );
  });

  it('buildHtmlFromGrid 转义 HTML 特殊字符', () => {
    expect(buildHtmlFromGrid([['<b>&"</b>']])).toBe(
      '<table><tbody><tr><td>&lt;b&gt;&amp;&quot;&lt;/b&gt;</td></tr></tbody></table>'
    );
  });
});

describe('parseDelimitedGrid（TSV/CSV 共用状态机）', () => {
  it('TSV 基本解析', () => {
    expect(parseDelimitedGrid('a\tb\nc\td', '\t')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('CSV 引号包裹内的分隔符与换行不生效，"" 转义为 "', () => {
    expect(parseDelimitedGrid('"x,1",y\n"line1\nline2",z', ',')).toEqual([
      ['x,1', 'y'],
      ['line1\nline2', 'z'],
    ]);
    expect(parseDelimitedGrid('"say ""hi""",ok', ',')).toEqual([['say "hi"', 'ok']]);
  });

  it('去掉末尾整行为空的多余行', () => {
    expect(parseDelimitedGrid('a\tb\n\n\n', '\t')).toEqual([['a', 'b']]);
    expect(parseDelimitedGrid('a\n', '\t')).toEqual([['a']]);
  });

  it('全空内容返回空矩阵', () => {
    expect(parseDelimitedGrid('', '\t')).toEqual([]);
  });
});

describe('parseTextGrid 分流', () => {
  it('含制表符走 TSV', () => {
    expect(parseTextGrid('a\tb\nc\td')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('多行且含逗号走 CSV', () => {
    expect(parseTextGrid('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('无分隔符的多行文本按行拆成单列（Excel/WPS 行为）', () => {
    expect(parseTextGrid('l1\nl2\nl3')).toEqual([['l1'], ['l2'], ['l3']]);
  });

  it('单段文本返回 null（上层写当前单元格）', () => {
    expect(parseTextGrid('plain')).toBeNull();
    // 含逗号但无换行：避免 Excel 复制的单个含逗号单元格被误拆成多列
    expect(parseTextGrid('a,b')).toBeNull();
    expect(parseTextGrid('')).toBeNull();
  });
});

describe('parseHtmlTableGrid', () => {
  it('解析 table/tr/td/th 的 textContent', () => {
    const result = parseHtmlTableGrid(
      '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>'
    );
    expect(result?.grid).toEqual([['A', 'B'], ['1', '2']]);
    expect(result?.hasMerge).toBe(false);
  });

  it('rowspan/colspan 按占位展开并标记 hasMerge（上层降级为只填文本）', () => {
    const result = parseHtmlTableGrid(
      '<table><tr><td rowspan="2">M</td><td>a</td></tr><tr><td>b</td></tr></table>'
    );
    expect(result?.grid).toEqual([['M', 'a'], ['', 'b']]);
    expect(result?.hasMerge).toBe(true);
  });

  it('HTML 实体解码，&nbsp; 归一为空格', () => {
    const result = parseHtmlTableGrid('<table><tr><td>&lt;b&gt;&nbsp;x</td></tr></table>');
    expect(result?.grid).toEqual([['<b> x']]);
  });

  it('非表格 HTML 返回 null', () => {
    expect(parseHtmlTableGrid('<p>hello</p>')).toBeNull();
    expect(parseHtmlTableGrid('')).toBeNull();
  });
});

describe('buildClipboardPayload（合并映射）', () => {
  it('普通选区提取 text 与允许的样式字段，合并相关字段不进入载荷', () => {
    const data = buildData(2, 2);
    data.cells[0][0] = { text: 'A', bold: true };
    data.cells[0][1] = { text: 'X', rowSpan: 1 };
    const payload = buildClipboardPayload(data, { r1: 0, c1: 0, r2: 1, c2: 1 });
    expect(payload).toEqual({
      version: 1,
      rows: 2,
      cols: 2,
      cells: [[{ text: 'A', bold: true }, { text: 'X' }], [{ text: 'r1c0' }, { text: 'r1c1' }]],
    });
  });

  it('主格在选区内时覆盖格留空，避免内容重复', () => {
    const data = buildData(3, 3);
    data.cells[0][0] = { text: 'M', rowSpan: 2, colSpan: 2 };
    data.cells[0][1] = { text: '', hidden: true };
    data.cells[1][0] = { text: '', hidden: true };
    data.cells[1][1] = { text: '', hidden: true };
    data.cells[1][2] = { text: 'B' };
    const payload = buildClipboardPayload(data, { r1: 0, c1: 0, r2: 2, c2: 2 });
    expect(payload.cells[0]).toEqual([{ text: 'M' }, { text: '' }, { text: 'r0c2' }]);
    expect(payload.cells[1]).toEqual([{ text: '' }, { text: '' }, { text: 'B' }]);
    expect(payload.cells[2]).toEqual([
      { text: 'r2c0' },
      { text: 'r2c1' },
      { text: 'r2c2' },
    ]);
  });

  it('主格不在选区内（部分选区）时写出主格文本', () => {
    const data = buildData(3, 3);
    data.cells[0][0] = { text: 'M', rowSpan: 2, colSpan: 2 };
    data.cells[0][1] = { text: '', hidden: true };
    data.cells[1][0] = { text: '', hidden: true };
    data.cells[1][1] = { text: '', hidden: true };
    data.cells[1][2] = { text: 'B' };
    const payload = buildClipboardPayload(data, { r1: 0, c1: 1, r2: 1, c2: 2 });
    expect(payload.cells).toEqual([
      [{ text: 'M' }, { text: 'r0c2' }],
      [{ text: 'M' }, { text: 'B' }],
    ]);
  });
});

describe('decodeClipboardPayload', () => {
  it('接受合法载荷', () => {
    const json = JSON.stringify({
      version: 1,
      rows: 1,
      cols: 2,
      cells: [[{ text: 'a' }, { text: 'b', bold: true }]],
    });
    expect(decodeClipboardPayload(json)?.cells).toEqual([[{ text: 'a' }, { text: 'b', bold: true }]]);
  });

  it('损坏 JSON / 版本不符 / 形状不符返回 null', () => {
    expect(decodeClipboardPayload('not json')).toBeNull();
    expect(
      decodeClipboardPayload(JSON.stringify({ version: 2, rows: 1, cols: 1, cells: [[{ text: 'a' }]] }))
    ).toBeNull();
    expect(
      decodeClipboardPayload(JSON.stringify({ version: 1, rows: 2, cols: 1, cells: [[{ text: 'a' }]] }))
    ).toBeNull();
  });
});

describe('applyPasteToData', () => {
  it('网格路径只覆盖 text，保留目标格现有样式', () => {
    const data = buildData(2, 2);
    data.cells[0][0] = { text: 'old', bold: true };
    const result = applyPasteToData(data, { grid: [['x']], targetRow: 0, targetCol: 0 });
    expect(result?.next.cells[0][0]).toEqual({ text: 'x', bold: true });
  });

  it('载荷路径覆盖 text 与样式字段并清除合并相关字段', () => {
    const data = buildData(2, 2);
    data.cells[0][0] = { text: 'old', bold: true, color: 'red', rowSpan: 2 };
    const payload = decodeClipboardPayload(
      JSON.stringify({ version: 1, rows: 1, cols: 1, cells: [[{ text: 'n', bold: false }]] })
    );
    const result = applyPasteToData(data, { payload, targetRow: 0, targetCol: 0 });
    expect(result?.next.cells[0][0]).toEqual({ text: 'n', bold: false });
  });

  it('超出当前行列时自动扩行列并用空格补齐，返回粘贴区域末格', () => {
    const data = buildData(2, 2);
    const grid = [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']];
    const result = applyPasteToData(data, { grid, targetRow: 1, targetCol: 1 });
    expect(result?.next.rows).toBe(4);
    expect(result?.next.cols).toBe(4);
    expect(result?.next.cells.length).toBe(4);
    expect(result?.next.cells.every((row) => row.length === 4)).toBe(true);
    expect(result?.next.cells[3][0]).toEqual(buildEmptyTableCell());
    expect(result?.next.cells[1][1].text).toBe('a');
    expect(result?.next.cells[3][3].text).toBe('i');
    expect(result?.endRow).toBe(3);
    expect(result?.endCol).toBe(3);
  });

  it('colWidths/rowHeights 已存在时扩列/行同步补默认尺寸', () => {
    const data = buildData(2, 2);
    data.colWidths = [10, 20];
    data.rowHeights = [30, 40];
    const result = applyPasteToData(data, { grid: [['x']], targetRow: 2, targetCol: 2 });
    expect(result?.next.colWidths).toEqual([10, 20, DEFAULT_TABLE_COL_WIDTH]);
    expect(result?.next.rowHeights).toEqual([30, 40, DEFAULT_TABLE_ROW_HEIGHT]);
  });

  it('空内容返回 null', () => {
    const data = buildData(2, 2);
    expect(applyPasteToData(data, { grid: [], targetRow: 0, targetCol: 0 })).toBeNull();
    expect(applyPasteToData(data, { grid: null, targetRow: 0, targetCol: 0 })).toBeNull();
  });
});

describe('合并工具（table-editor 与剪贴板共用）', () => {
  it('findMasterCell 命中合并覆盖格', () => {
    const data = buildData(3, 3);
    data.cells[0][0] = { text: 'M', rowSpan: 2, colSpan: 2 };
    data.cells[1][1] = { text: '', hidden: true };
    expect(findMasterCell(data, 1, 1)?.cell.text).toBe('M');
    expect(findMasterCell(data, 2, 2)).toBeNull();
  });

  it('hasMergeInRect 识别 hidden 与跨行/跨列', () => {
    const data = buildData(3, 3);
    data.cells[0][0] = { text: 'M', rowSpan: 2 };
    expect(hasMergeInRect(data, { r1: 0, c1: 0, r2: 1, c2: 1 })).toBe(true);
    expect(hasMergeInRect(data, { r1: 2, c1: 0, r2: 2, c2: 2 })).toBe(false);
  });
});
