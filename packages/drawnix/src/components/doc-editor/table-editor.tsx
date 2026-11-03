import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import {
  TableFileData,
  TableCellData,
  buildEmptyTableCell,
  parseTableFileContent,
  readTauriFile,
} from '../../data/tauri-file';
import { useI18n } from '../../i18n';
import './table-editor.scss';
import { useDocAutoSave } from './use-doc-auto-save';

const DEFAULT_BORDER_COLOR = '#b4b4b4';

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28];

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

  const handleCellMouseDown = (row: number, col: number, event: React.MouseEvent) => {
    if (event.shiftKey && sel) {
      setSel({ anchor: sel.anchor, focus: { row, col } });
      return;
    }
    mouseDownRef.current = true;
    setSel({ anchor: { row, col }, focus: { row, col } });
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

  const buildCellStyle = (cell: TableCellData): React.CSSProperties => {
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
    const borderColor = border?.color || DEFAULT_BORDER_COLOR;
    style.borderTop = border?.top === false ? 'none' : border?.top ? `1px solid ${borderColor}` : undefined;
    style.borderRight = border?.right === false ? 'none' : border?.right ? `1px solid ${borderColor}` : undefined;
    style.borderBottom = border?.bottom === false ? 'none' : border?.bottom ? `1px solid ${borderColor}` : undefined;
    style.borderLeft = border?.left === false ? 'none' : border?.left ? `1px solid ${borderColor}` : undefined;
    return style;
  };

  if (loadFailed) {
    return <div className="doc-editor__placeholder">{t('toast.tauriFile.loadFailed')}</div>;
  }

  if (!data) {
    return null;
  }

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
        <span className="table-editor__hint">{t('table.selectionHint')}</span>
      </div>
      <div className="table-editor__canvas">
        <table className="table-editor__table" cellPadding={0}>
          <tbody>
            {data.cells.map((row, r) => (
              <tr key={r}>
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
                      style={buildCellStyle(cell)}
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
                          autoFocus
                          onFocus={(event) => event.target.select()}
                          onBlur={(event) => {
                            setCellText(r, c, event.target.value);
                            setEditing(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              (event.target as HTMLTextAreaElement).blur();
                            } else if (event.key === 'Escape') {
                              setEditing(null);
                            }
                          }}
                        />
                      ) : (
                        <span className="table-editor__cell-text">
                          {cell.text || '\u00A0'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
