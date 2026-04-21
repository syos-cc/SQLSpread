import { state } from '../state.js';
import { cellDisplayValue, isFrozenColumn } from '../utils.js';
import { saveUiStateToConfig } from '../db.js';

export function getSheetSortState(sheetName) { return state.sheetSortState.get(sheetName) || { col: null, direction: null }; }

export function setSheetSortState(sheetName, col, direction) {
  if (!sheetName) return;
  if (!col || !direction) state.sheetSortState.delete(sheetName);
  else state.sheetSortState.set(sheetName, { col, direction });
  saveUiStateToConfig();
}

export function getSortIndicator(direction) { return direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : ''; }

export function getNextSortDirection(sheetName, col) {
  const sheet = state.workbook.get(sheetName);
  if (isFrozenColumn(sheet?.colDefs.get(col) || {})) return null;
  const current = getSheetSortState(sheetName);
  if (current.col !== col) return 'asc';
  if (current.direction === 'asc') return 'desc';
  if (current.direction === 'desc') return null;
  return 'asc';
}

export function getCellSortMeta(cell) {
  if (!cell) return { type: 'empty', value: '' };
  const valueType = String(cell.value_type || 'TEXT').toUpperCase();
  const displayValue = cellDisplayValue(cell);
  if (valueType === 'BOOLEAN') return { type: 'number', value: displayValue === true ? 1 : 0 };
  if (valueType === 'INTEGER' || valueType === 'REAL') {
    const num = Number(displayValue);
    if (!Number.isNaN(num)) return { type: 'number', value: num };
  }
  return { type: 'text', value: String(displayValue ?? '').trim().toLocaleLowerCase('de-DE') };
}

export function compareCellValues(aCell, bCell) {
  const a = getCellSortMeta(aCell);
  const b = getCellSortMeta(bCell);
  const aEmpty = a.type === 'empty' || a.value === '';
  const bEmpty = b.type === 'empty' || b.value === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (a.type === 'number' && b.type === 'number') return a.value - b.value;
  return String(a.value).localeCompare(String(b.value), 'de-DE', { numeric: true, sensitivity: 'base' });
}
