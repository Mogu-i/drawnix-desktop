import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import {
  TableFileData,
  TableCellData,
  buildEmptyTableCell,
  parseTableFileContent,
  readTauriFile,
} from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import type { Translations } from '../../i18n/types';
import './table-editor.scss';
import { useDocAutoSave } from './use-doc-auto-save';
import {
  DEFAULT_TABLE_COL_WIDTH,
  DEFAULT_TABLE_ROW_HEIGHT,
  buildTableCellStyle,
  buildTableTextEffectStyle,
  getTableColWidths,
  getTableRowHeights,
} from './table-style';

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28];

const MIN_COL_WIDTH = 40;

const MIN_ROW_HEIGHT = 24;

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

/** 字体效果的翻译键 */
const EFFECT_LABEL_KEYS = {
  bold: 'table.bold',
  underline: 'table.underline',
  strikethrough: 'table.strikethrough',
} as const;

/** 对齐方式的翻译键，避免动态拼接导致类型不安全 */
const ALIGN_LABEL_KEYS: Record<AlignKind, keyof Translations> = {
  left: 'table.alignLeft',
  center: 'table.alignCenter',
  right: 'table.alignRight',
  top: 'table.alignTop',
  middle: 'table.alignMiddle',
  bottom: 'table.alignBottom',
};

type AlignKind = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

const AlignIcon = ({ variant }: { variant: string }) => {
  const vertical = variant.startsWith('v-');
  const lines = ALIGN_ICON_LINES[variant] ?? [];
  return (
    <svg
      className="table-editor__align-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
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

type CellPos = { row: number; col: number };

type SelectionRect = { r1: number; c1: number; r2: number; c2: number };

type BorderMode = 'all' | 'none' | 'outer';

const normalizeRect = (a: CellPos, b: CellPos): SelectionRect => ({
  r1: Math.min(a.row, b.row),
  c1: Math.min(a.col, b.col),
  r2: Math.max(a.row, b.row),
  c2: Math.max(a.col, b.col),
});

/** 找到覆盖 (row, col) 的合并区域主单元格 */
const findMasterCell = (
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

/** 解散以 (masterRow, masterCol) 为主单元格的合并区域 */
const unmergeRegion = (data: TableFileData, masterRow: number, masterCol: number) => {
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

const hasMergeInRect = (data: TableFileData, rect: SelectionRect) => {
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

// 表格文档编辑器：支持插入/删除行列、合并单元格、边框、
// 字号、文字颜色与单元格背景色，修改防抖后自动保存回对应文件
export const TableEditor = ({ path }: { path: string }) => {
  const { t } = useI18n();
  const [data, setData] = useState<TableFileData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // 选区：anchor 为起点，focus 为终点；拖动/Shift+点击扩展为矩形
  const [sel, setSel] = useState<{ anchor: CellPos; focus: CellPos } | null>(null);
  const [editing, setEditing] = useState<CellPos | null>(null);
  const mouseDownRef = useRef(false);
  const dataRef = useRef<TableFileData | null>(null);
  // 行高列宽拖拽调整：resizeRef 记录拖拽上下文，previewRef 记录最新预览尺寸
  const resizeRef = useRef<{
    type: 'col' | 'row';
    index: number;
    startPos: number;
    startSize: number;
  } | null>(null);
  const previewRef = useRef<{ colWidths: number[]; rowHeights: number[] } | null>(null);
  const [resizing, setResizing] = useState(false);
  const [resizePreview, setResizePreview] = useState<{
    colWidths: number[];
    rowHeights: number[];
  } | null>(null);
  // 表格容器：接收键盘导航事件（tabIndex 聚焦）
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  // 拖拽手柄定位基准：行/列声明尺寸只是最小值，内容（换行/字号/padding）
  // 撑高时浏览器会把行实际渲染得更高，手柄必须按 DOM 实测边界定位才会与边框对齐
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [measured, setMeasured] = useState<{ rows: number[]; cols: number[] } | null>(null);

  const serialize = useCallback(
    () => (dataRef.current ? JSON.stringify(dataRef.current, null, 2) : null),
    []
  );

  const { scheduleSave, markLoaded } = useDocAutoSave(path, 'table', serialize);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    setData(null);
    dataRef.current = null;
    setSel(null);
    setEditing(null);
    readTauriFile(path, 'table')
      .then((content) => {
        if (cancelled) {
          return;
        }
        const parsed = parseTableFileContent(content);
        dataRef.current = parsed;
        setData(parsed);
        markLoaded();
      })
      .catch((error) => {
        console.error('Failed to load table file:', error);
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [path, markLoaded]);

  const commit = useCallback(
    (next: TableFileData) => {
      dataRef.current = next;
      setData(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  const rect = useMemo<SelectionRect | null>(() => {
    if (!sel || !data) {
      return null;
    }
    // 行列被删除后选区可能越界，统一钳到有效范围内
    const value = normalizeRect(sel.anchor, sel.focus);
    return {
      r1: Math.min(value.r1, data.rows - 1),
      c1: Math.min(value.c1, data.cols - 1),
      r2: Math.min(value.r2, data.rows - 1),
      c2: Math.min(value.c2, data.cols - 1),
    };
  }, [sel, data]);

  // ----- 行列操作 -----

  const handleInsertRow = () => {
    if (!data) {
      return;
    }
    const refRow = rect ? rect.r2 : data.rows - 1;
    const refCol = rect ? rect.c1 : 0;
    const next: TableFileData = structuredClone(data);
    // 插入点落在合并区域内部时改插到区域之后，保持合并完整
    let insertAt = refRow + 1;
    const master = findMasterCell(next, refRow, refCol);
    if (master && (master.cell.rowSpan ?? 1) > 1) {
      insertAt = master.row + (master.cell.rowSpan ?? 1);
    }
    next.cells.splice(insertAt, 0, Array.from({ length: next.cols }, buildEmptyTableCell));
    next.rowHeights?.splice(insertAt, 0, DEFAULT_TABLE_ROW_HEIGHT);
    next.rows += 1;
    commit(next);
  };

  const handleDeleteRow = () => {
    if (!data || data.rows <= 1) {
      return;
    }
    const refRow = rect ? rect.r1 : data.rows - 1;
    const next: TableFileData = structuredClone(data);
    // 先解散与该行相交的合并区域，避免跨行合并错位
    for (let c = 0; c < next.cols; c++) {
      const master = findMasterCell(next, refRow, c);
      if (master) {
        unmergeRegion(next, master.row, master.col);
      }
    }
    next.cells.splice(refRow, 1);
    next.rowHeights?.splice(refRow, 1);
    next.rows -= 1;
    setSel(null);
    setEditing(null);
    commit(next);
  };

  const handleInsertCol = () => {
    if (!data) {
      return;
    }
    const refCol = rect ? rect.c2 : data.cols - 1;
    const refRow = rect ? rect.r1 : 0;
    const next: TableFileData = structuredClone(data);
    let insertAt = refCol + 1;
    const master = findMasterCell(next, refRow, refCol);
    if (master && (master.cell.colSpan ?? 1) > 1) {
      insertAt = master.col + (master.cell.colSpan ?? 1);
    }
    next.cells.forEach((row) => {
      row.splice(insertAt, 0, buildEmptyTableCell());
    });
    next.colWidths?.splice(insertAt, 0, DEFAULT_TABLE_COL_WIDTH);
    next.cols += 1;
    commit(next);
  };

  const handleDeleteCol = () => {
    if (!data || data.cols <= 1) {
      return;
    }
    const refCol = rect ? rect.c1 : data.cols - 1;
    const next: TableFileData = structuredClone(data);
    for (let r = 0; r < next.rows; r++) {
      const master = findMasterCell(next, r, refCol);
      if (master) {
        unmergeRegion(next, master.row, master.col);
      }
    }
    next.cells.forEach((row) => {
      row.splice(refCol, 1);
    });
    next.colWidths?.splice(refCol, 1);
    next.cols -= 1;
    setSel(null);
    setEditing(null);
    commit(next);
  };

  // ----- 合并 -----

  const canMerge = !!rect && (rect.r1 !== rect.r2 || rect.c1 !== rect.c2);

  const handleMerge = () => {
    if (!data || !rect || !canMerge) {
      return;
    }
    const next: TableFileData = structuredClone(data);
    // 先解散选区内已有的合并区域
    for (let r = rect.r1; r <= rect.r2; r++) {
      for (let c = rect.c1; c <= rect.c2; c++) {
        const master = findMasterCell(next, r, c);
        if (master) {
          unmergeRegion(next, master.row, master.col);
        }
      }
    }
    for (let r = rect.r1; r <= rect.r2; r++) {
      for (let c = rect.c1; c <= rect.c2; c++) {
        const cell = next.cells[r][c];
        if (r === rect.r1 && c === rect.c1) {
          cell.rowSpan = rect.r2 - rect.r1 + 1;
          cell.colSpan = rect.c2 - rect.c1 + 1;
        } else {
          cell.hidden = true;
        }
      }
    }
    commit(next);
  };

  const handleUnmerge = () => {
    if (!data || !rect || !hasMergeInRect(data, rect)) {
      return;
    }
    const next: TableFileData = structuredClone(data);
    for (let r = rect.r1; r <= rect.r2; r++) {
      for (let c = rect.c1; c <= rect.c2; c++) {
        const master = findMasterCell(next, r, c);
        if (master) {
          unmergeRegion(next, master.row, master.col);
        }
      }
    }
    commit(next);
  };

  // ----- 样式 -----

  /** 对选区应用样式；无选区时应用到整张表 */
  const applyStyle = (patch: Partial<TableCellData>) => {
    if (!data) {
      return;
    }
    const range = rect ?? { r1: 0, c1: 0, r2: data.rows - 1, c2: data.cols - 1 };
    const next: TableFileData = structuredClone(data);
    for (let r = range.r1; r <= range.r2; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        const cell = next.cells[r]?.[c];
        if (!cell || cell.hidden) {
          continue;
        }
        Object.assign(cell, patch);
      }
    }
    commit(next);
  };

  const applyBorder = (mode: BorderMode) => {
    if (!data) {
      return;
    }
    const range = rect ?? { r1: 0, c1: 0, r2: data.rows - 1, c2: data.cols - 1 };
    const next: TableFileData = structuredClone(data);
    for (let r = range.r1; r <= range.r2; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        const cell = next.cells[r]?.[c];
        if (!cell || cell.hidden) {
          continue;
        }
        const color = cell.border?.color;
        if (mode === 'all') {
          cell.border = { top: true, right: true, bottom: true, left: true, color };
        } else if (mode === 'none') {
          cell.border = { top: false, right: false, bottom: false, left: false, color };
        } else {
          cell.border = {
            top: r === range.r1,
            bottom: r === range.r2,
            left: c === range.c1,
            right: c === range.c2,
            color,
          };
        }
      }
    }
    commit(next);
  };

  // ----- 单元格交互 -----

  const setCellText = (row: number, col: number, text: string) => {
    if (!data) {
      return;
    }
    const cell = data.cells[row]?.[col];
    if (!cell || cell.text === text) {
      return;
    }
    const next: TableFileData = structuredClone(data);
    next.cells[row][col].text = text;
    commit(next);
  };

  // 单击仅选中，双击才进入编辑（onDoubleClick），避免误触；
  // 同时聚焦表格容器以接收键盘导航事件
  const handleCellMouseDown = (row: number, col: number, event: React.MouseEvent) => {
    focusTableWrap();
    if (event.shiftKey && sel) {
      setSel({ anchor: sel.anchor, focus: { row, col } });
      return;
    }
    mouseDownRef.current = true;
    setSel({ anchor: { row, col }, focus: { row, col } });
  };

  // ----- 键盘导航 -----

  // 键盘事件由可聚焦的表格容器接收：单击单元格时主动聚焦，
  // 编辑框提交/退出后也把焦点交还容器，保证后续导航按键不丢失
  const focusTableWrap = () => {
    tableWrapRef.current?.focus({ preventScroll: true });
  };

  /** 钳制到有效范围；目标落在合并区域内时落到主单元格 */
  const clampCell = (row: number, col: number): CellPos => {
    if (!data) {
      return { row, col };
    }
    const r = Math.min(data.rows - 1, Math.max(0, row));
    const c = Math.min(data.cols - 1, Math.max(0, col));
    const master = findMasterCell(data, r, c);
    return master ? { row: master.row, col: master.col } : { row: r, col: c };
  };

  // 方向键移动选区到相邻单元格（不回绕）
  const moveSelection = (dRow: number, dCol: number) => {
    if (!sel) {
      return;
    }
    const next = clampCell(sel.anchor.row + dRow, sel.anchor.col + dCol);
    setSel({ anchor: next, focus: next });
  };

  // Tab 横向切换单元格，行尾回绕到下一行行首（Shift+Tab 反向）
  const moveSelectionByTab = (backwards: boolean) => {
    if (!data || !sel) {
      return;
    }
    const col = sel.anchor.col + (backwards ? -1 : 1);
    const row = sel.anchor.row + (col < 0 || col >= data.cols ? (backwards ? -1 : 1) : 0);
    const next = clampCell(row, (col + data.cols) % data.cols);
    setSel({ anchor: next, focus: next });
  };

  // 选中态键盘处理：Enter 进入编辑，Tab/方向键切换单元格；
  // 编辑态按键由单元格内的 textarea 自行处理（此处冒泡时已在编辑中，直接忽略）
  const handleTableKeyDown = (event: React.KeyboardEvent) => {
    if (editing || !sel || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        setEditing(sel.anchor);
        return;
      case 'Tab':
        event.preventDefault();
        moveSelectionByTab(event.shiftKey);
        return;
      case 'ArrowUp':
        event.preventDefault();
        moveSelection(-1, 0);
        return;
      case 'ArrowDown':
        event.preventDefault();
        moveSelection(1, 0);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        moveSelection(0, -1);
        return;
      case 'ArrowRight':
        event.preventDefault();
        moveSelection(0, 1);
        return;
    }
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (!mouseDownRef.current || !sel) {
      return;
    }
    setSel({ anchor: sel.anchor, focus: { row, col } });
  };

  useEffect(() => {
    const stopSelecting = () => {
      mouseDownRef.current = false;
    };
    window.addEventListener('mouseup', stopSelecting);
    return () => {
      window.removeEventListener('mouseup', stopSelecting);
    };
  }, []);

  // ----- 行高列宽调整 -----

  const startResize = (type: 'col' | 'row', index: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!data) {
      return;
    }
    const sizes = resizePreview ?? {
      colWidths: getTableColWidths(data.colWidths, data.cols),
      rowHeights: getTableRowHeights(data.rowHeights, data.rows),
    };
    // 起始尺寸取 DOM 实测值：内容撑高的行渲染高度大于声明值时，
    // 从声明值起拖会让手柄瞬间跳离鼠标位置
    const sameShape =
      measured && measured.rows.length === sizes.rowHeights.length &&
      measured.cols.length === sizes.colWidths.length;
    const startSizes =
      type === 'col'
        ? sameShape
          ? measured!.cols.map((b, i) => b - (i > 0 ? measured!.cols[i - 1] : 0))
          : sizes.colWidths
        : sameShape
          ? measured!.rows.map((b, i) => b - (i > 0 ? measured!.rows[i - 1] : 0))
          : sizes.rowHeights;
    resizeRef.current = {
      type,
      index,
      startPos: type === 'col' ? event.clientX : event.clientY,
      startSize: startSizes[index],
    };
    previewRef.current = sizes;
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) {
      return;
    }
    const handleMove = (event: MouseEvent) => {
      const context = resizeRef.current;
      const base = previewRef.current;
      if (!context || !base) {
        return;
      }
      const delta = (context.type === 'col' ? event.clientX : event.clientY) - context.startPos;
      const min = context.type === 'col' ? MIN_COL_WIDTH : MIN_ROW_HEIGHT;
      const size = Math.max(min, context.startSize + delta);
      // 拖拽过程中只更新预览尺寸，不写入数据
      const next = { colWidths: base.colWidths, rowHeights: base.rowHeights };
      if (context.type === 'col') {
        next.colWidths = [...base.colWidths];
        next.colWidths[context.index] = size;
      } else {
        next.rowHeights = [...base.rowHeights];
        next.rowHeights[context.index] = size;
      }
      previewRef.current = next;
      setResizePreview(next);
    };
    const handleUp = () => {
      const preview = previewRef.current;
      if (preview && dataRef.current) {
        // 松开后才提交尺寸并触发保存
        const next = structuredClone(dataRef.current);
        next.colWidths = preview.colWidths;
        next.rowHeights = preview.rowHeights;
        commit(next);
      }
      resizeRef.current = null;
      previewRef.current = null;
      setResizing(false);
      setResizePreview(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing, commit]);

  // 从 DOM 实测各行下边界/各列右边界（相对表格左上角）；
  // 与上次结果一致时保持原引用，避免 ResizeObserver 回调 setState 引发自激循环
  const measureBoundaries = useCallback(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    const base = table.getBoundingClientRect();
    const rows: number[] = [];
    table.querySelectorAll('tbody > tr').forEach((tr) => {
      rows.push(tr.getBoundingClientRect().bottom - base.top);
    });
    const cols: number[] = [];
    table.querySelectorAll('colgroup > col').forEach((col) => {
      cols.push(col.getBoundingClientRect().right - base.left);
    });
    setMeasured((prev) => {
      if (
        prev &&
        prev.rows.length === rows.length &&
        prev.cols.length === cols.length &&
        prev.rows.every((v, i) => Math.abs(v - rows[i]) < 0.5) &&
        prev.cols.every((v, i) => Math.abs(v - cols[i]) < 0.5)
      ) {
        return prev;
      }
      return { rows, cols };
    });
  }, []);

  // 数据/预览尺寸变化会在布局后同步触发测量，保证手柄与内容撑开后的边界实时对齐
  useLayoutEffect(() => {
    measureBoundaries();
  }, [data, resizePreview, measureBoundaries]);

  // 字体加载、窗口缩放等异步回流导致的行高变化由 ResizeObserver 兜底重新测量
  useEffect(() => {
    const table = tableRef.current;
    if (!table || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => measureBoundaries());
    observer.observe(table);
    return () => {
      observer.disconnect();
    };
  }, [data, measureBoundaries]);

  if (loadFailed) {
    return <div className="doc-editor__placeholder">{t('toast.tauriFile.loadFailed')}</div>;
  }

  if (!data) {
    return null;
  }

  // 拖拽调整过程中使用预览尺寸，否则使用已保存的尺寸
  const colWidths = resizePreview?.colWidths ?? getTableColWidths(data.colWidths, data.cols);
  const rowHeights = resizePreview?.rowHeights ?? getTableRowHeights(data.rowHeights, data.rows);
  const colOffsets = [0];
  colWidths.forEach((width) => colOffsets.push(colOffsets[colOffsets.length - 1] + width));
  const rowOffsets = [0];
  rowHeights.forEach((height) => rowOffsets.push(rowOffsets[rowOffsets.length - 1] + height));
  // 手柄定位优先用 DOM 实测边界（行数/列数与当前数据一致时），声明尺寸累加值仅作首帧兜底，
  // 否则内容把行撑高后手柄仍停留在声明高度处，与表格边框错位
  const sameShape =
    !!measured && measured.rows.length === rowHeights.length &&
    measured.cols.length === colWidths.length;
  const rowBounds = sameShape ? measured.rows : rowOffsets.slice(1);
  const colBounds = sameShape ? measured.cols : colOffsets.slice(1);
  const tableWidth = colBounds[colBounds.length - 1] ?? colOffsets[colOffsets.length - 1];
  const tableHeight = rowBounds[rowBounds.length - 1] ?? rowOffsets[rowOffsets.length - 1];

  // 当前选区首个单元格的样式，用于工具栏按钮高亮
  const firstCell = data.cells[rect?.r1 ?? 0]?.[rect?.c1 ?? 0];
  const currentAlign = firstCell?.align ?? 'left';
  const currentValign = firstCell?.valign ?? 'top';
  const currentEffects = {
    bold: firstCell?.bold ?? false,
    underline: firstCell?.underline ?? false,
    strikethrough: firstCell?.strikethrough ?? false,
  };

  return (
    <div className="table-editor">
      <div className="table-editor__toolbar">
        <button type="button" className="table-editor__tool-button" onClick={handleInsertRow}>
          {t('table.insertRow')}
        </button>
        <button
          type="button"
          className="table-editor__tool-button"
          disabled={data.rows <= 1}
          onClick={handleDeleteRow}
        >
          {t('table.deleteRow')}
        </button>
        <button type="button" className="table-editor__tool-button" onClick={handleInsertCol}>
          {t('table.insertCol')}
        </button>
        <button
          type="button"
          className="table-editor__tool-button"
          disabled={data.cols <= 1}
          onClick={handleDeleteCol}
        >
          {t('table.deleteCol')}
        </button>
        <span className="table-editor__separator" />
        <button
          type="button"
          className="table-editor__tool-button"
          disabled={!canMerge}
          onClick={handleMerge}
        >
          {t('table.merge')}
        </button>
        <button
          type="button"
          className="table-editor__tool-button"
          disabled={!rect || !hasMergeInRect(data, rect)}
          onClick={handleUnmerge}
        >
          {t('table.unmerge')}
        </button>
        <span className="table-editor__separator" />
        <label className="table-editor__tool-item">
          <span>{t('popupToolbar.stroke')}</span>
          <select
            value=""
            onChange={(event) => {
              const mode = event.target.value as BorderMode;
              if (mode) {
                applyBorder(mode);
              }
              event.target.value = '';
            }}
          >
            <option value="" disabled>
              {t('table.border')}
            </option>
            <option value="all">{t('table.borderAll')}</option>
            <option value="none">{t('table.borderNone')}</option>
            <option value="outer">{t('table.borderOuter')}</option>
          </select>
        </label>
        <label className="table-editor__tool-item">
          <span>{t('popupToolbar.fontSize')}</span>
          <select
            value=""
            onChange={(event) => {
              const size = Number(event.target.value);
              applyStyle({ fontSize: size > 0 ? size : undefined });
              event.target.value = '';
            }}
          >
            <option value="" disabled>
              {t('popupToolbar.fontSize')}
            </option>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <label
          className="table-editor__tool-item table-editor__tool-item--color"
          title={t('popupToolbar.fontColor')}
        >
          <span>{t('popupToolbar.fontColor')}</span>
          <input
            type="color"
            defaultValue="#000000"
            onChange={(event) => applyStyle({ color: event.target.value })}
          />
        </label>
        <label
          className="table-editor__tool-item table-editor__tool-item--color"
          title={t('popupToolbar.fillColor')}
        >
          <span>{t('popupToolbar.fillColor')}</span>
          <input
            type="color"
            defaultValue="#ffffff"
            onChange={(event) => applyStyle({ bg: event.target.value })}
          />
        </label>
        <span className="table-editor__separator" />
        {(
          [
            ['bold', 'B'],
            ['underline', 'U'],
            ['strikethrough', 'S'],
          ] as const
        ).map(([effect, label]) => (
          <button
            key={effect}
            type="button"
            title={t(EFFECT_LABEL_KEYS[effect])}
            className={classNames('table-editor__tool-button', 'table-editor__tool-button--icon', {
              'table-editor__tool-button--active': currentEffects[effect],
            })}
            onClick={() =>
              applyStyle({ [effect]: !currentEffects[effect] } as Partial<TableCellData>)
            }
          >
            <span className={`table-editor__effect-icon table-editor__effect-icon--${effect}`}>
              {label}
            </span>
          </button>
        ))}
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            type="button"
            title={t(ALIGN_LABEL_KEYS[align])}
            className={classNames('table-editor__tool-button', 'table-editor__tool-button--icon', {
              'table-editor__tool-button--active': currentAlign === align,
            })}
            onClick={() => applyStyle({ align })}
          >
            <AlignIcon variant={`h-${align}`} />
          </button>
        ))}
        {(['top', 'middle', 'bottom'] as const).map((valign) => (
          <button
            key={valign}
            type="button"
            title={t(ALIGN_LABEL_KEYS[valign])}
            className={classNames('table-editor__tool-button', 'table-editor__tool-button--icon', {
              'table-editor__tool-button--active': currentValign === valign,
            })}
            onClick={() => applyStyle({ valign })}
          >
            <AlignIcon variant={`v-${valign}`} />
          </button>
        ))}
        <span className="table-editor__hint">{t('table.selectionHint')}</span>
      </div>
      <div className="table-editor__canvas">
        <div
          ref={tableWrapRef}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          className={classNames('table-editor__table-wrap', {
            'table-editor__table-wrap--resizing': resizing,
          })}
          style={
            resizing
              ? { cursor: resizeRef.current?.type === 'row' ? 'row-resize' : 'col-resize' }
              : undefined
          }
        >
          <table ref={tableRef} className="table-editor__table" cellPadding={0}>
            <colgroup>
              {colWidths.map((width, c) => (
                <col key={c} style={{ width: `${width}px` }} />
              ))}
            </colgroup>
            <tbody>
              {data.cells.map((row, r) => (
                <tr key={r} style={{ height: `${rowHeights[r]}px` }}>
                  {row.map((cell, c) => {
                    if (cell.hidden) {
                      return null;
                    }
                    const selected =
                      !!rect && r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2;
                    return (
                      <td
                        key={c}
                        rowSpan={cell.rowSpan ?? 1}
                        colSpan={cell.colSpan ?? 1}
                        style={buildTableCellStyle(cell)}
                        className={classNames('table-editor__cell', {
                          'table-editor__cell--selected': selected,
                        })}
                        onMouseDown={(event) => handleCellMouseDown(r, c, event)}
                        onMouseEnter={() => handleCellMouseEnter(r, c)}
                        onDoubleClick={() => setEditing({ row: r, col: c })}
                      >
                        {editing && editing.row === r && editing.col === c ? (
                          <textarea
                            className="table-editor__cell-editor"
                            defaultValue={cell.text}
                            style={buildTableTextEffectStyle(cell)}
                            autoFocus
                            // 阻止冒泡，避免点击文本框重置选区/重新触发进入编辑
                            onMouseDown={(event) => event.stopPropagation()}
                            // 进入编辑时光标定位到内容末尾，方便直接续写
                            onFocus={(event) => {
                              const editor = event.currentTarget;
                              editor.setSelectionRange(editor.value.length, editor.value.length);
                            }}
                            onBlur={(event) => {
                              setCellText(r, c, event.target.value);
                              setEditing(null);
                            }}
                            onKeyDown={(event) => {
                              // 回车提交并退出编辑（Shift+回车换行）；
                              // Escape 同样走 blur 提交，避免误按丢失输入
                              if (
                                (event.key === 'Enter' && !event.shiftKey) ||
                                event.key === 'Escape'
                              ) {
                                event.preventDefault();
                                (event.target as HTMLTextAreaElement).blur();
                                focusTableWrap();
                                return;
                              }
                              // Tab 提交并横向切换单元格（Shift+Tab 反向）
                              if (event.key === 'Tab') {
                                event.preventDefault();
                                setCellText(r, c, event.currentTarget.value);
                                setEditing(null);
                                moveSelectionByTab(event.shiftKey);
                                focusTableWrap();
                              }
                            }}
                          />
                        ) : (
                          <span className="table-editor__cell-text">{cell.text || '\u00A0'}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {/* 列边界拖拽手柄：覆盖在每列右侧边界上，实时预览、松开提交 */}
          {colWidths.map((_, c) => (
            <div
              key={`col-${c}`}
              className="table-editor__resize-handle table-editor__resize-handle--col"
              style={{ left: colBounds[c] - 4, height: tableHeight }}
              onMouseDown={(event) => startResize('col', c, event)}
            />
          ))}
          {/* 行边界拖拽手柄：覆盖在每行下侧边界上 */}
          {rowHeights.map((_, r) => (
            <div
              key={`row-${r}`}
              className="table-editor__resize-handle table-editor__resize-handle--row"
              style={{ top: rowBounds[r] - 4, width: tableWidth }}
              onMouseDown={(event) => startResize('row', r, event)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
