import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import {
  TableFileData,
  TableCellData,
  buildEmptyTableCell,
  getTauriDocDraft,
  parseTableFileContent,
  readTauriFile,
} from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import type { Translations } from '../../i18n/types';
import { MoreIcon } from '../icons';
import { Select } from '../select/select';
import './table-editor.scss';
import { useDocAutoSave } from './use-doc-auto-save';
import { useDocHistory } from './use-doc-history';
import {
  AlignIcon,
  EditorColorSwatches,
  EditorIsland,
  EditorIslandButton,
  EditorIslandDropdown,
  EditorIslandMenuItem,
  EditorIslandMenuSeparator,
  EditorIslandMenuTitle,
  EditorIslandSeparator,
  IslandBorderIcon,
  IslandColMinusIcon,
  IslandColPlusIcon,
  IslandFillIcon,
  IslandGridIcon,
  IslandHelpIcon,
  IslandMergeIcon,
  IslandRedoIcon,
  IslandRowMinusIcon,
  IslandRowPlusIcon,
  IslandTextColorIcon,
  IslandUndoIcon,
  IslandUnmergeIcon,
  useDrawnixContainer,
} from './editor-toolbar-island';
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

/**
 * 编辑态镜像占位文本：与展示态同样以不换行空格兜底空内容，
 * 并给末尾换行补一个不可见字符，保证该换行产生的空行也计入高度
 */
const buildMirrorText = (draft: string) =>
  draft.endsWith('\n') ? `${draft}\u00A0` : draft || '\u00A0';

// 表格文档编辑器：支持插入/删除行列、合并单元格、边框、
// 字号、文字颜色与单元格背景色，修改防抖后自动保存回对应文件
export const TableEditor = ({ path }: { path: string }) => {
  const { t } = useI18n();
  // 主题变量都定义在 .drawnix 根上，Select 浮层需 portal 进根内（G4）
  const container = useDrawnixContainer();
  const [data, setData] = useState<TableFileData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // 选区：anchor 为起点，focus 为终点；拖动/Shift+点击扩展为矩形
  const [sel, setSel] = useState<{ anchor: CellPos; focus: CellPos } | null>(null);
  const [editing, setEditing] = useState<CellPos | null>(null);
  // 编辑框受控内容：驱动流内镜像占位元素，使单元格在编辑期间
  // 始终保持当前文字换行后的实际高度（与保存后的展示态一致）
  const [draft, setDraft] = useState('');
  const mouseDownRef = useRef(false);
  // 编辑态撤销/重做时主动移焦会触发 blur，此标记让该次 blur 跳过提交，
  // 否则未提交的输入会被写回数据并覆盖恢复结果
  const suppressBlurRef = useRef(false);
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
    // 未保存草稿优先：切换页签/异常重启后重新挂载时磁盘仍是旧内容，
    // 有草稿说明存在未保存修改，直接以草稿恢复（与保存入口写盘的内容同源），
    // 与白板切页签时的快照恢复机制对称
    const draft = getTauriDocDraft(path, 'table');
    (draft !== null ? Promise.resolve(draft) : readTauriFile(path, 'table'))
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

  const history = useDocHistory<TableFileData>();

  // 撤销/重做恢复用裸应用：不走 commit（否则恢复动作又进历史）；
  // 恢复后清空选区并退出编辑，避免选区引用到已失效的行列
  const applyData = useCallback(
    (snapshot: TableFileData) => {
      dataRef.current = snapshot;
      setData(snapshot);
      setSel(null);
      setEditing(null);
      scheduleSave();
    },
    [scheduleSave]
  );

  const handleUndo = useCallback(() => {
    if (dataRef.current) {
      history.undo(dataRef.current, applyData);
    }
  }, [history, applyData]);

  const handleRedo = useCallback(() => {
    if (dataRef.current) {
      history.redo(dataRef.current, applyData);
    }
  }, [history, applyData]);

  /** 撤销/重做快捷键：返回 true 表示已处理（已 preventDefault） */
  const tryUndoRedoKey = (event: React.KeyboardEvent): boolean => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return false;
    }
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
      return true;
    }
    if (key === 'y' && !event.shiftKey) {
      event.preventDefault();
      handleRedo();
      return true;
    }
    return false;
  };

  const commit = useCallback(
    (next: TableFileData) => {
      // 修改前保存旧数据快照：结构化拷贝防止旧值被后续变更牵连；
      // 所有结构/样式/单元格文本修改都汇入 commit，在此一处挂钩全覆盖
      if (dataRef.current) {
        history.pushHistory(structuredClone(dataRef.current));
      }
      dataRef.current = next;
      setData(next);
      scheduleSave();
    },
    [scheduleSave, history]
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
    // 多选时删除选区覆盖的全部行（rect.r1 ~ rect.r2）；单选/未选时保持原有单行删除行为
    const startRow = rect ? rect.r1 : data.rows - 1;
    // 至少保留一行：越界时将删除范围收缩为 data.rows - 1 行
    const endRow = Math.min(rect ? rect.r2 : data.rows - 1, startRow + (data.rows - 1) - 1);
    const deleteCount = endRow - startRow + 1;
    if (deleteCount <= 0) {
      return;
    }
    const next: TableFileData = structuredClone(data);
    // 先解散与被删行相交的合并区域（含跨入被删区的合并），避免跨行合并错位
    for (let r = startRow; r <= endRow; r++) {
      for (let c = 0; c < next.cols; c++) {
        const master = findMasterCell(next, r, c);
        if (master) {
          unmergeRegion(next, master.row, master.col);
        }
      }
    }
    next.cells.splice(startRow, deleteCount);
    next.rowHeights?.splice(startRow, deleteCount);
    next.rows -= deleteCount;
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
    // 多选时删除选区覆盖的全部列（rect.c1 ~ rect.c2）；单选/未选时保持原有单列删除行为
    const startCol = rect ? rect.c1 : data.cols - 1;
    // 至少保留一列：越界时将删除范围收缩为 data.cols - 1 列
    const endCol = Math.min(rect ? rect.c2 : data.cols - 1, startCol + (data.cols - 1) - 1);
    const deleteCount = endCol - startCol + 1;
    if (deleteCount <= 0) {
      return;
    }
    const next: TableFileData = structuredClone(data);
    // 先解散与被删列相交的合并区域（含跨入被删区的合并），避免跨列合并错位
    for (let r = 0; r < next.rows; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const master = findMasterCell(next, r, c);
        if (master) {
          unmergeRegion(next, master.row, master.col);
        }
      }
    }
    next.cells.forEach((row) => {
      row.splice(startCol, deleteCount);
    });
    next.colWidths?.splice(startCol, deleteCount);
    next.cols -= deleteCount;
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

  // 进入编辑态：把单元格现有内容同步为草稿，镜像才能立刻撑出真实高度
  const startEditing = (pos: CellPos, text: string) => {
    setDraft(text);
    setEditing(pos);
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
    // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y（非编辑态）：允许无选区时使用，
    // 须放在选区/修饰键检查之前；编辑态的撤销由单元格 textarea 自行处理
    if (!editing && data && tryUndoRedoKey(event)) {
      return;
    }
    if (editing || !data || !sel || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    switch (event.key) {
      case 'Enter': {
        event.preventDefault();
        const cell = data.cells[sel.anchor.row]?.[sel.anchor.col];
        startEditing(sel.anchor, cell?.text ?? '');
        return;
      }
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

  // 拖选结束（window mouseup）复位拖选标志，单元格 mouseenter 依赖它扩展选区
  useEffect(() => {
    const stopSelecting = () => {
      mouseDownRef.current = false;
    };
    window.addEventListener('mouseup', stopSelecting);
    return () => {
      window.removeEventListener('mouseup', stopSelecting);
    };
  }, []);

  // ----- 选区覆盖层 -----
  // WPS 式选区样式：对选中 td 的并集矩形（相对表格左上角）绘制最外一圈
  // 连续边框 + 内部半透明颜色覆盖，替代逐格描边；与手柄测量同策略，
  // 随数据/预览/选区变化与回流重测，对齐实际网格边界。
  // 注意：必须声明在下方引用它的布局副作用与 ResizeObserver 之前，
  // 否则依赖数组在渲染期触发暂时性死区引用错误
  const [selectionBounds, setSelectionBounds] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const measureSelection = useCallback(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    const base = table.getBoundingClientRect();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    table.querySelectorAll('td.table-editor__cell--selected').forEach((cell) => {
      const box = cell.getBoundingClientRect();
      left = Math.min(left, box.left - base.left);
      top = Math.min(top, box.top - base.top);
      right = Math.max(right, box.right - base.left);
      bottom = Math.max(bottom, box.bottom - base.top);
    });
    // 无选中单元格时移除覆盖层
    if (left === Infinity) {
      setSelectionBounds(null);
      return;
    }
    const next = { left, top, width: right - left, height: bottom - top };
    // 矩形未变化时保持原引用，避免重测引发无谓重渲染（与手柄测量同一策略）
    setSelectionBounds((prev) =>
      prev &&
      Math.abs(prev.left - next.left) < 0.5 &&
      Math.abs(prev.top - next.top) < 0.5 &&
      Math.abs(prev.width - next.width) < 0.5 &&
      Math.abs(prev.height - next.height) < 0.5
        ? prev
        : next
    );
  }, []);

  // 选区变化后同步重测；数据/预览尺寸与回流引发的变化由手柄测量的副作用与 ResizeObserver 一并覆盖
  useLayoutEffect(() => {
    measureSelection();
  }, [rect, measureSelection]);

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
      measured &&
      measured.rows.length === sizes.rowHeights.length &&
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
        // 松开后才提交尺寸并触发保存；尺寸未变化（误触手柄的零位移点击）
        // 不提交，避免产生一个空撤销单元与无意义的保存
        const cur = dataRef.current;
        const curCols = getTableColWidths(cur.colWidths, cur.cols);
        const curRows = getTableRowHeights(cur.rowHeights, cur.rows);
        const changed =
          preview.colWidths.some((w, i) => w !== curCols[i]) ||
          preview.rowHeights.some((h, i) => h !== curRows[i]);
        if (changed) {
          const next = structuredClone(cur);
          next.colWidths = preview.colWidths;
          next.rowHeights = preview.rowHeights;
          commit(next);
        }
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

  // 数据/预览尺寸变化会在布局后同步触发测量，保证手柄与内容撑开后的边界实时对齐；
  // 选区覆盖层随同一时机重测，跟随行高列宽变化
  useLayoutEffect(() => {
    measureBoundaries();
    measureSelection();
  }, [data, resizePreview, measureBoundaries, measureSelection]);

  // 字体加载、窗口缩放等异步回流导致的行高变化由 ResizeObserver 兜底重新测量
  useEffect(() => {
    const table = tableRef.current;
    if (!table || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      measureBoundaries();
      measureSelection();
    });
    observer.observe(table);
    return () => {
      observer.disconnect();
    };
  }, [data, measureBoundaries, measureSelection]);

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
    !!measured &&
    measured.rows.length === rowHeights.length &&
    measured.cols.length === colWidths.length;
  const rowBounds = sameShape ? measured.rows : rowOffsets.slice(1);
  const colBounds = sameShape ? measured.cols : colOffsets.slice(1);
  const tableWidth = colBounds[colBounds.length - 1] ?? colOffsets[colOffsets.length - 1];
  const tableHeight = rowBounds[rowBounds.length - 1] ?? rowOffsets[rowOffsets.length - 1];

  // 当前选区首个单元格的样式，用于工具栏按钮高亮
  const firstCell = data.cells[rect?.r1 ?? 0]?.[rect?.c1 ?? 0];
  const currentAlign = firstCell?.align ?? 'left';
  const currentValign = firstCell?.valign ?? 'top';
  const currentFontSize = firstCell?.fontSize ?? 14;
  const currentEffects = {
    bold: firstCell?.bold ?? false,
    underline: firstCell?.underline ?? false,
    strikethrough: firstCell?.strikethrough ?? false,
  };

  const canUnmerge = !!rect && hasMergeInRect(data, rect);

  // 编辑单格（选区即该格）时隐藏覆盖层：编辑框自带描边，避免两者叠加成双重粗环；
  // 多格选区进入编辑时覆盖层保留，维持选区范围指示
  const overlayHiddenByEditing =
    !!editing && !!rect && rect.r1 === rect.r2 && rect.c1 === rect.c2;

  // 根容器兜底：焦点落在表格容器外的子树元素（如工具岛按钮）时也能用
  // 快捷键撤销/重做；表格容器内的按键已 preventDefault，此处靠
  // defaultPrevented 跳过，避免同一按键触发两次
  const handleRootKeyDown = (event: React.KeyboardEvent) => {
    if (!event.defaultPrevented) {
      tryUndoRedoKey(event);
    }
  };

  // 根容器兜底：点击编辑器内空白（画布留白等不可聚焦区域）后浏览器的
  // mousedown 默认行为会把焦点清到 body，按键事件不再经过本子树，撤销等
  // 快捷键全部失灵（点击其他单元格才会恢复）。preventDefault 拦住默认
  // 焦点转移并把焦点收回表格容器；编辑框与拖拽手柄的 mousedown 已自行
  // 阻止冒泡，工具岛按钮自己也 preventDefault 防夺焦，均不受影响
  const handleRootMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    focusTableWrap();
  };

  return (
    <div
      className="table-editor"
      onKeyDown={handleRootKeyDown}
      onMouseDown={handleRootMouseDown}
    >
      <div className="editor-island-wrap table-editor__island-wrap">
        <EditorIsland role="toolbar" aria-orientation="horizontal">
          {/* 撤销/重做：覆盖结构/样式/单元格文本的文件级历史栈 */}
          <EditorIslandButton
            label={t('general.undo')}
            disabled={!history.canUndo}
            disabledReason={t('editor.undo.disabled')}
            onClick={() => {
              handleUndo();
              focusTableWrap();
            }}
          >
            <IslandUndoIcon />
          </EditorIslandButton>
          <EditorIslandButton
            label={t('general.redo')}
            disabled={!history.canRedo}
            disabledReason={t('editor.redo.disabled')}
            onClick={() => {
              handleRedo();
              focusTableWrap();
            }}
          >
            <IslandRedoIcon />
          </EditorIslandButton>
          <EditorIslandSeparator />
          {/* 结构组：行列 / 合并，禁用条件与原按钮一致 */}
          <EditorIslandDropdown label={t('table.toolbar.rows')} icon={<IslandGridIcon />}>
            {(close) => (
              <>
                <EditorIslandMenuItem
                  icon={<IslandRowPlusIcon />}
                  onClick={() => {
                    handleInsertRow();
                    close();
                  }}
                >
                  {t('table.insertRow')}
                </EditorIslandMenuItem>
                <EditorIslandMenuItem
                  icon={<IslandRowMinusIcon />}
                  disabled={data.rows <= 1}
                  disabledReason={t('table.disabled.row')}
                  onClick={() => {
                    handleDeleteRow();
                    close();
                  }}
                >
                  {t('table.deleteRow')}
                </EditorIslandMenuItem>
                <EditorIslandMenuItem
                  icon={<IslandColPlusIcon />}
                  onClick={() => {
                    handleInsertCol();
                    close();
                  }}
                >
                  {t('table.insertCol')}
                </EditorIslandMenuItem>
                <EditorIslandMenuItem
                  icon={<IslandColMinusIcon />}
                  disabled={data.cols <= 1}
                  disabledReason={t('table.disabled.col')}
                  onClick={() => {
                    handleDeleteCol();
                    close();
                  }}
                >
                  {t('table.deleteCol')}
                </EditorIslandMenuItem>
              </>
            )}
          </EditorIslandDropdown>
          <EditorIslandDropdown label={t('table.toolbar.merge')} icon={<IslandMergeIcon />}>
            {(close) => (
              <>
                <EditorIslandMenuItem
                  icon={<IslandMergeIcon />}
                  disabled={!canMerge}
                  disabledReason={t('table.disabled.merge')}
                  onClick={() => {
                    handleMerge();
                    close();
                  }}
                >
                  {t('table.merge')}
                </EditorIslandMenuItem>
                <EditorIslandMenuItem
                  icon={<IslandUnmergeIcon />}
                  disabled={!canUnmerge}
                  disabledReason={t('table.disabled.unmerge')}
                  onClick={() => {
                    handleUnmerge();
                    close();
                  }}
                >
                  {t('table.unmerge')}
                </EditorIslandMenuItem>
              </>
            )}
          </EditorIslandDropdown>
          <EditorIslandSeparator />
          {/* 边框文字组 */}
          <EditorIslandDropdown
            className="editor-island__desktop-only"
            label={t('table.border')}
            icon={<IslandBorderIcon />}
          >
            {(close) => (
              <>
                <EditorIslandMenuItem
                  onClick={() => {
                    applyBorder('all');
                    close();
                  }}
                >
                  {t('table.borderAll')}
                </EditorIslandMenuItem>
                <EditorIslandMenuItem
                  onClick={() => {
                    applyBorder('none');
                    close();
                  }}
                >
                  {t('table.borderNone')}
                </EditorIslandMenuItem>
                <EditorIslandMenuItem
                  onClick={() => {
                    applyBorder('outer');
                    close();
                  }}
                >
                  {t('table.borderOuter')}
                </EditorIslandMenuItem>
              </>
            )}
          </EditorIslandDropdown>
          <Select.Root
            size="2"
            value={String(currentFontSize)}
            onValueChange={(value) => applyStyle({ fontSize: Number(value) })}
          >
            <Select.Trigger
              className="editor-island__select-trigger editor-island__desktop-only"
              aria-label={t('popupToolbar.fontSize')}
              onMouseDown={(event) => event.preventDefault()}
            >
              {currentFontSize}
            </Select.Trigger>
            <Select.Content container={container}>
              {FONT_SIZES.map((size) => (
                <Select.Item key={size} value={String(size)}>
                  {size}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          {(
            [
              ['bold', 'B', 'bold'],
              ['underline', 'U', 'underline'],
              ['strikethrough', 'S', 'strike'],
            ] as const
          ).map(([effect, label, glyph]) => (
            <EditorIslandButton
              key={effect}
              label={t(EFFECT_LABEL_KEYS[effect])}
              active={currentEffects[effect]}
              onClick={() =>
                applyStyle({ [effect]: !currentEffects[effect] } as Partial<TableCellData>)
              }
            >
              <span className={`editor-island__glyph editor-island__glyph--${glyph}`}>{label}</span>
            </EditorIslandButton>
          ))}
          <EditorIslandSeparator />
          {/* 对齐颜色组：水平/垂直各三项，当前项带勾选 */}
          <EditorIslandDropdown
            className="editor-island__desktop-only"
            label={t('table.toolbar.align')}
            icon={<AlignIcon variant={`h-${currentAlign}`} />}
          >
            {(close) => (
              <>
                {(['left', 'center', 'right'] as const).map((align) => (
                  <EditorIslandMenuItem
                    key={align}
                    icon={<AlignIcon variant={`h-${align}`} />}
                    current={currentAlign === align}
                    onClick={() => {
                      applyStyle({ align });
                      close();
                    }}
                  >
                    {t(ALIGN_LABEL_KEYS[align])}
                  </EditorIslandMenuItem>
                ))}
                <EditorIslandMenuSeparator />
                {(['top', 'middle', 'bottom'] as const).map((valign) => (
                  <EditorIslandMenuItem
                    key={valign}
                    icon={<AlignIcon variant={`v-${valign}`} />}
                    current={currentValign === valign}
                    onClick={() => {
                      applyStyle({ valign });
                      close();
                    }}
                  >
                    {t(ALIGN_LABEL_KEYS[valign])}
                  </EditorIslandMenuItem>
                ))}
              </>
            )}
          </EditorIslandDropdown>
          <EditorIslandDropdown
            label={t('popupToolbar.fontColor')}
            icon={
              <span className="editor-island__color-trigger">
                <IslandTextColorIcon />
                <span
                  className="editor-island__color-chip"
                  style={{ background: firstCell?.color ?? 'transparent' }}
                />
              </span>
            }
          >
            {(close) => (
              <EditorColorSwatches
                value={firstCell?.color}
                ariaLabel={t('popupToolbar.fontColor')}
                onColorChange={(color) => {
                  applyStyle({ color });
                  close();
                }}
              />
            )}
          </EditorIslandDropdown>
          <EditorIslandDropdown
            label={t('popupToolbar.fillColor')}
            icon={
              <span className="editor-island__color-trigger">
                <IslandFillIcon />
                <span
                  className="editor-island__color-chip"
                  style={{ background: firstCell?.bg ?? 'transparent' }}
                />
              </span>
            }
          >
            {(close) => (
              <EditorColorSwatches
                value={firstCell?.bg}
                ariaLabel={t('popupToolbar.fillColor')}
                onColorChange={(color) => {
                  applyStyle({ bg: color });
                  close();
                }}
              />
            )}
          </EditorIslandDropdown>
          <EditorIslandSeparator />
          {/* 帮助：正文沿用 table.selectionHint 全文，不改措辞 */}
          <EditorIslandDropdown
            label={t('table.toolbar.help')}
            icon={<IslandHelpIcon />}
            iconOnly
            placement="bottom-end"
          >
            <div className="editor-island-help">
              <div className="editor-island-help__title">{t('table.help.title')}</div>
              <p>{t('table.selectionHint')}</p>
            </div>
          </EditorIslandDropdown>
          {/* 更多（仅窄屏渲染）：收纳桌面端隐藏的低频组 */}
          <EditorIslandDropdown
            className="editor-island__mobile-only"
            label={t('table.toolbar.more')}
            icon={MoreIcon}
            iconOnly
            placement="bottom-end"
          >
            {(close) => (
              <>
                <EditorIslandMenuTitle>{t('table.border')}</EditorIslandMenuTitle>
                <EditorIslandMenuItem
                  onClick={() => {
                    applyBorder('all');
                    close();
                  }}
                >
                  {t('table.borderAll')}
                </EditorIslandMenuItem>
                <EditorIslandMenuItem
                  onClick={() => {
                    applyBorder('none');
                    close();
                  }}
                >
                  {t('table.borderNone')}
                </EditorIslandMenuItem>
                <EditorIslandMenuItem
                  onClick={() => {
                    applyBorder('outer');
                    close();
                  }}
                >
                  {t('table.borderOuter')}
                </EditorIslandMenuItem>
                <EditorIslandMenuSeparator />
                <EditorIslandMenuTitle>{t('table.toolbar.align')}</EditorIslandMenuTitle>
                {(['left', 'center', 'right'] as const).map((align) => (
                  <EditorIslandMenuItem
                    key={`h-${align}`}
                    icon={<AlignIcon variant={`h-${align}`} />}
                    current={currentAlign === align}
                    onClick={() => {
                      applyStyle({ align });
                      close();
                    }}
                  >
                    {t(ALIGN_LABEL_KEYS[align])}
                  </EditorIslandMenuItem>
                ))}
                {(['top', 'middle', 'bottom'] as const).map((valign) => (
                  <EditorIslandMenuItem
                    key={`v-${valign}`}
                    icon={<AlignIcon variant={`v-${valign}`} />}
                    current={currentValign === valign}
                    onClick={() => {
                      applyStyle({ valign });
                      close();
                    }}
                  >
                    {t(ALIGN_LABEL_KEYS[valign])}
                  </EditorIslandMenuItem>
                ))}
                <EditorIslandMenuSeparator />
                <EditorIslandMenuTitle>{t('popupToolbar.fontSize')}</EditorIslandMenuTitle>
                {FONT_SIZES.map((size) => (
                  <EditorIslandMenuItem
                    key={size}
                    current={currentFontSize === size}
                    onClick={() => {
                      applyStyle({ fontSize: size });
                      close();
                    }}
                  >
                    {size}
                  </EditorIslandMenuItem>
                ))}
              </>
            )}
          </EditorIslandDropdown>
        </EditorIsland>
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
                    const isEditing = !!editing && editing.row === r && editing.col === c;
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
                        onDoubleClick={() => startEditing({ row: r, col: c }, cell.text)}
                      >
                        {isEditing ? (
                          <>
                            {/* 流内镜像：排版规则与展示态一致，撑出当前草稿换行后的真实高度，
                                使绝对定位的编辑框高度前后一致且不再出现滚动条 */}
                            <span aria-hidden className="table-editor__cell-mirror">
                              {buildMirrorText(draft)}
                            </span>
                            <textarea
                              className="table-editor__cell-editor"
                              value={draft}
                              style={buildTableTextEffectStyle(cell)}
                              autoFocus
                              // 输入实时同步草稿，镜像随内容增高的行数继续撑高单元格
                              onChange={(event) => setDraft(event.target.value)}
                              // 阻止冒泡，避免点击文本框重置选区/重新触发进入编辑
                              onMouseDown={(event) => event.stopPropagation()}
                              // 进入编辑时光标定位到内容末尾，方便直接续写
                              onFocus={(event) => {
                                const editor = event.currentTarget;
                                editor.setSelectionRange(editor.value.length, editor.value.length);
                              }}
                              onBlur={(event) => {
                                if (suppressBlurRef.current) {
                                  suppressBlurRef.current = false;
                                  setEditing(null);
                                  return;
                                }
                                setCellText(r, c, event.target.value);
                                setEditing(null);
                              }}
                              onKeyDown={(event) => {
                                // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y：与电子表格的
                                // 单元格编辑行为一致，草稿有未提交修改时先放弃本次
                                // 输入并退出编辑（不消耗历史栈，避免错位回滚上一次
                                // 提交），无未提交修改时才走文件级历史栈；移焦回容器
                                // 会触发 blur，须先挂 suppress 标记跳过本次提交
                                if ((event.ctrlKey || event.metaKey) && !event.altKey) {
                                  const key = event.key.toLowerCase();
                                  const isUndo = key === 'z' && !event.shiftKey;
                                  const isRedo =
                                    (key === 'z' && event.shiftKey) ||
                                    (key === 'y' && !event.shiftKey);
                                  if (isUndo || isRedo) {
                                    event.preventDefault();
                                    suppressBlurRef.current = true;
                                    if (draft !== (data?.cells[r]?.[c]?.text ?? '')) {
                                      setEditing(null);
                                      focusTableWrap();
                                      return;
                                    }
                                    if (isRedo) {
                                      handleRedo();
                                    } else {
                                      handleUndo();
                                    }
                                    focusTableWrap();
                                    return;
                                  }
                                }
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
                          </>
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
          {/* 选区覆盖层：WPS 式选区——选中区域最外一圈连续边框 + 内部半透明颜色覆盖；
              pointer-events:none 不拦截单元格点击，编辑单格时隐藏避免与编辑框描边叠加 */}
          {selectionBounds && !overlayHiddenByEditing && (
            <div
              className="table-editor__selection-overlay"
              style={{
                left: selectionBounds.left,
                top: selectionBounds.top,
                width: selectionBounds.width,
                height: selectionBounds.height,
              }}
            />
          )}
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
