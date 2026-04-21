import { state, dom } from '../state.js';
import { cellDisplayValue, getFrozenColumns, getFrozenRowNumbers, isFrozenColumn, isFrozenRow } from '../utils.js';
import { compareCellValues } from './sorting.js';
import { saveUiStateToConfig } from '../db.js';
import { renderSheet } from '../render/render-sheet.js';

export function sanitizeSheetUiState(sheetName, sheet) {
  if (!sheetName || !sheet) return;
  const frozenCols = new Set(getFrozenColumns(sheet));
  const sortState = state.sheetSortState.get(sheetName);
  if (sortState?.col && frozenCols.has(sortState.col)) state.sheetSortState.delete(sheetName);
  const filters = state.sheetFilterState.get(sheetName);
  if (filters instanceof Map && filters.size) {
    const sanitized = new Map();
    for (const [col, values] of filters.entries()) {
      if (frozenCols.has(col)) continue;
      sanitized.set(col, values);
    }
    if (sanitized.size) state.sheetFilterState.set(sheetName, sanitized);
    else state.sheetFilterState.delete(sheetName);
  }
}

export function sanitizeAllUiState() {
  for (const [sheetName, sheet] of state.workbook.entries()) sanitizeSheetUiState(sheetName, sheet);
}

export function getSheetFilters(sheetName) { return state.sheetFilterState.get(sheetName) || new Map(); }
export function getColumnFilterValues(sheetName, col) { return getSheetFilters(sheetName).get(col) || null; }
export function setColumnFilterValues(sheetName, col, values) {
  if (!sheetName || !col) return;
  const filters = new Map(getSheetFilters(sheetName));
  if (values === null || values === undefined) filters.delete(col); else filters.set(col, [...values]);
  if (filters.size) state.sheetFilterState.set(sheetName, filters); else state.sheetFilterState.delete(sheetName);
  saveUiStateToConfig();
}
export function clearColumnFilter(sheetName, col) { setColumnFilterValues(sheetName, col, null); }
export function getCellFilterValue(cell) {
  const displayValue = cellDisplayValue(cell);
  if (displayValue === true) return '1';
  if (displayValue === false) return '0';
  if (displayValue === null || displayValue === undefined) return '';
  return String(displayValue);
}
export function getFilterValueLabel(value) { return value === '' ? '(Leer)' : value; }

export function getColumnDistinctFilterValues(sheet, col) {
  const rowNums = [...sheet.rows].sort((a, b) => a - b).filter(rowNum => !isFrozenRow(sheet.rowDefs.get(rowNum) || {}));
  const values = new Map();
  for (const rowNum of rowNums) {
    const cell = sheet.cells.get(`${col}|${rowNum}`) || null;
    const rawValue = getCellFilterValue(cell);
    if (!values.has(rawValue)) {
      values.set(rawValue, {
        value: rawValue,
        label: getFilterValueLabel(rawValue),
        sortMeta: { type: typeof rawValue === 'string' && rawValue !== '' && !Number.isNaN(Number(rawValue)) ? 'number' : 'text' }
      });
    }
  }
  return [...values.values()].sort((a, b) => {
    const result = compareCellValues(a.value === '' ? null : { value_type: a.sortMeta.type === 'number' ? 'REAL' : 'TEXT', value: a.value }, b.value === '' ? null : { value_type: b.sortMeta.type === 'number' ? 'REAL' : 'TEXT', value: b.value });
    if (result !== 0) return result;
    return a.label.localeCompare(b.label, 'de-DE', { numeric: true, sensitivity: 'base' });
  });
}

export function rowMatchesFilters(sheet, sheetName, rowNum) {
  if (isFrozenRow(sheet.rowDefs.get(rowNum) || {})) return true;
  const filters = getSheetFilters(sheetName);
  if (!filters.size) return true;
  for (const [col, allowedValues] of filters.entries()) {
    if (isFrozenColumn(sheet.colDefs.get(col) || {})) continue;
    if (!allowedValues) continue;
    if (!allowedValues.length) return false;
    const cell = sheet.cells.get(`${col}|${rowNum}`) || null;
    if (!allowedValues.includes(getCellFilterValue(cell))) return false;
  }
  return true;
}

export function hideFilterMenu() {
  if (!dom.filterMenu) return;
  dom.filterMenu.style.display = 'none';
  dom.filterMenu.innerHTML = '';
  state.currentFilterMenu = null;
}

export function positionFilterMenu(x, y) {
  if (!dom.filterMenu) return;
  const padding = 8;
  dom.filterMenu.style.left = `${x}px`;
  dom.filterMenu.style.top = `${y}px`;
  dom.filterMenu.style.display = 'block';
  const rect = dom.filterMenu.getBoundingClientRect();
  let left = x, top = y;
  if (rect.right > window.innerWidth - padding) left = Math.max(padding, window.innerWidth - rect.width - padding);
  if (rect.bottom > window.innerHeight - padding) top = Math.max(padding, window.innerHeight - rect.height - padding);
  dom.filterMenu.style.left = `${left}px`;
  dom.filterMenu.style.top = `${top}px`;
}

export function openFilterMenu(sheetName, col, anchorX, anchorY) {
  if (!dom.filterMenu) return;
  const sheet = state.workbook.get(sheetName);
  if (!sheet || isFrozenColumn(sheet.colDefs.get(col) || {})) return;
  const distinctValues = getColumnDistinctFilterValues(sheet, col);
  const activeValues = getColumnFilterValues(sheetName, col);
  const selectedValues = new Set(activeValues || distinctValues.map(item => item.value));
  dom.filterMenu.innerHTML = `
    <div class="filter-menu-header">Filter: ${col}</div>
    <div class="filter-menu-actions">
      <button type="button" class="filter-menu-btn" data-filter-action="select-all">Alle</button>
      <button type="button" class="filter-menu-btn" data-filter-action="clear-all">Keine</button>
      <button type="button" class="filter-menu-btn" data-filter-action="reset">Zurücksetzen</button>
    </div>
    <div class="filter-menu-list"></div>
    <div class="filter-menu-footer">
      <button type="button" class="filter-menu-btn" data-filter-action="apply">Anwenden</button>
      <button type="button" class="filter-menu-btn" data-filter-action="cancel">Schließen</button>
    </div>`;
  const listEl = dom.filterMenu.querySelector('.filter-menu-list');
  for (const item of distinctValues) {
    const row = document.createElement('label');
    row.className = 'filter-menu-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.filterValue = item.value;
    checkbox.checked = selectedValues.has(item.value);
    const label = document.createElement('span');
    label.className = 'filter-menu-label';
    label.textContent = item.label;
    row.append(checkbox, label);
    listEl.appendChild(row);
  }
  state.currentFilterMenu = { sheetName, col };
  positionFilterMenu(anchorX, anchorY);
  const getCheckedValues = () => [...dom.filterMenu.querySelectorAll('input[data-filter-value]:checked')].map(el => el.dataset.filterValue || '');
  const setAllChecked = checked => dom.filterMenu.querySelectorAll('input[data-filter-value]').forEach(cb => { cb.checked = checked; });
  for (const button of dom.filterMenu.querySelectorAll('button[data-filter-action]')) {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-filter-action');
      if (action === 'select-all') return setAllChecked(true);
      if (action === 'clear-all') return setAllChecked(false);
      if (action === 'reset') { clearColumnFilter(sheetName, col); hideFilterMenu(); renderSheet(sheetName); return; }
      if (action === 'cancel') { hideFilterMenu(); return; }
      if (action === 'apply') {
        const checkedValues = getCheckedValues();
        const allValues = distinctValues.map(item => item.value);
        if (checkedValues.length === allValues.length) clearColumnFilter(sheetName, col);
        else setColumnFilterValues(sheetName, col, checkedValues);
        hideFilterMenu();
        renderSheet(sheetName);
      }
    });
  }
}
