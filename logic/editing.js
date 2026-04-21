import { state, dom } from '../state.js';
import { cellDisplayValue, getJsonDropdownOptions, getJsonDropdownSelected, isBooleanTrue, isCellEditable, isJsonDropdownCell } from '../utils.js';
import { reloadWorkbookFromDb, setStatus } from '../db.js';
import { I18N } from '../i18n.js';

export function getCellRecord(sheetName, cellRef) {
  const match = /^([A-Z]+)(\d+)$/.exec(String(cellRef || ''));
  if (!match) return null;
  const col = match[1];
  const rowNum = Number(match[2]);
  const sheet = state.workbook.get(sheetName);
  if (!sheet) return null;
  return { sheet, col, rowNum, key: `${col}|${rowNum}`, cell: sheet.cells.get(`${col}|${rowNum}`) || null, rowDef: sheet.rowDefs.get(rowNum) || {}, colDef: sheet.colDefs.get(col) || {} };
}

export function getSelectedCellMeta() {
  if (!state.currentSheet || !state.currentSelectedCellRef) return null;
  return getCellRecord(state.currentSheet, state.currentSelectedCellRef);
}

export function getCellEditorValue(cell) {
  if (!cell) return '';
  const valueType = String(cell.value_type || 'TEXT').toUpperCase();
  if (valueType === 'BOOLEAN') return isBooleanTrue(cell.value);
  if (valueType === 'JSON' && isJsonDropdownCell(cell)) return getJsonDropdownSelected(cell);
  return String(cellDisplayValue(cell) ?? '');
}

export function valuesEqualForHistory(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

export function setCellValueInDb(sheetName, col, rowNum, rawValue) {
  if (!state.db) throw new Error(I18N.NO_DATABASE_LOADED);
  const sheet = state.workbook.get(sheetName);
  const currentCell = sheet?.cells.get(`${col}|${rowNum}`) || null;
  if (!currentCell) throw new Error(I18N.CELL_NOT_FOUND);
  const valueType = String(currentCell.value_type || 'TEXT').toUpperCase();
  if (valueType === 'BLOB') throw new Error(I18N.BLOB_NOT_SUPPORTED);
  if (valueType === 'JSON' && isJsonDropdownCell(currentCell)) {
    const obj = JSON.parse(JSON.stringify(currentCell.value ? (typeof currentCell.value === 'string' ? JSON.parse(currentCell.value) : currentCell.value) : {}));
    const options = Array.isArray(obj.options) ? obj.options.map(v => String(v)) : [''];
    const selectedValue = String(rawValue ?? '');
    if (!options.includes(selectedValue)) throw new Error(I18N.DROPDOWN_VALUE_INVALID);
    const newObj = { ...obj, type: 'dropdown', selected: selectedValue, selectd: selectedValue, options };
    state.db.run(`UPDATE cells SET value = ? WHERE tab = ? AND part = ? AND line = ?`, [JSON.stringify(newObj), sheetName, col, rowNum]);
    return;
  }
  if (valueType === 'BOOLEAN') {
    state.db.run(`UPDATE cells SET value = ? WHERE tab = ? AND part = ? AND line = ?`, [rawValue === true || rawValue === 1 ? '1' : '0', sheetName, col, rowNum]);
    return;
  }
  if (valueType === 'INTEGER') {
    if (rawValue === '') state.db.run(`UPDATE cells SET value = '' WHERE tab = ? AND part = ? AND line = ?`, [sheetName, col, rowNum]);
    else {
      const parsed = Number(rawValue);
      if (!Number.isInteger(parsed)) throw new Error(I18N.INVALID_INTEGER);
      state.db.run(`UPDATE cells SET value = ? WHERE tab = ? AND part = ? AND line = ?`, [String(parsed), sheetName, col, rowNum]);
    }
    return;
  }
  if (valueType === 'REAL') {
    if (rawValue === '') state.db.run(`UPDATE cells SET value = '' WHERE tab = ? AND part = ? AND line = ?`, [sheetName, col, rowNum]);
    else {
      const parsed = Number(String(rawValue).replace(',', '.'));
      if (Number.isNaN(parsed)) throw new Error(I18N.INVALID_NUMBER);
      state.db.run(`UPDATE cells SET value = ? WHERE tab = ? AND part = ? AND line = ?`, [String(parsed), sheetName, col, rowNum]);
    }
    return;
  }
  state.db.run(`UPDATE cells SET value = ? WHERE tab = ? AND part = ? AND line = ?`, [String(rawValue ?? ''), sheetName, col, rowNum]);
}

export async function applyCellValueChange(sheetName, col, rowNum, newValue, options = {}) {
  const { recordHistory = true, statusMessage = I18N.STATUS_CHANGED(state.currentDbName), selectCellRef = true } = options;
  const meta = getCellRecord(sheetName, `${col}${rowNum}`);
  if (!meta || !meta.cell) throw new Error(I18N.CELL_NOT_FOUND);
  const oldValue = getCellEditorValue(meta.cell);
  if (valuesEqualForHistory(oldValue, newValue)) return false;
  setCellValueInDb(sheetName, col, rowNum, newValue);
  if (recordHistory) { state.undoStack.push({ sheetName, col, rowNum, oldValue, newValue }); state.redoStack.length = 0; }
  await reloadWorkbookFromDb(statusMessage);
  if (selectCellRef) {
    const updatedTd = dom.sheetWrapEl.querySelector(`td[data-cell="${col}${rowNum}"]`);
    if (updatedTd) selectCell(updatedTd);
  }
  return true;
}

export async function undoLastChange() {
  const entry = state.undoStack.pop();
  if (!entry) return setStatus(I18N.NOTHING_TO_UNDO);
  try {
    await applyCellValueChange(entry.sheetName, entry.col, entry.rowNum, entry.oldValue, { recordHistory: false, statusMessage: I18N.STATUS_CHANGED_UNDO(state.currentDbName) });
    state.redoStack.push(entry);
  } catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
}

export async function redoLastChange() {
  const entry = state.redoStack.pop();
  if (!entry) return setStatus(I18N.NOTHING_TO_REDO);
  try {
    await applyCellValueChange(entry.sheetName, entry.col, entry.rowNum, entry.newValue, { recordHistory: false, statusMessage: I18N.STATUS_CHANGED_REDO(state.currentDbName) });
    state.undoStack.push(entry);
  } catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
}

export function clearSelectedCell() { dom.sheetWrapEl.querySelectorAll('td.cell-selected').forEach(td => td.classList.remove('cell-selected')); }

export function selectCell(td) {
  clearSelectedCell();
  td.classList.add('cell-selected');
  state.currentSelectedCellRef = td.dataset.cell || null;
  if (dom.nameBox) dom.nameBox.textContent = td.dataset.cell || '-';
  if (dom.formulaBox) { dom.formulaBox.value = td.dataset.value || ''; dom.formulaBox.disabled = td.dataset.editable !== 'true'; }
}

export async function toggleBooleanCell(td) {
  if (!td || td.dataset.editable !== 'true') return;
  const meta = getCellRecord(state.currentSheet, td.dataset.cell || '');
  if (!meta || !meta.cell || String(meta.cell.value_type || 'TEXT').toUpperCase() !== 'BOOLEAN') return;
  try { await applyCellValueChange(state.currentSheet, meta.col, meta.rowNum, !isBooleanTrue(meta.cell.value), { statusMessage: I18N.STATUS_CHANGED(state.currentDbName) }); }
  catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
}

export async function updateJsonDropdownCell(td, selectedValue) {
  if (!td || td.dataset.editable !== 'true') return;
  const meta = getCellRecord(state.currentSheet, td.dataset.cell || '');
  if (!meta || !meta.cell) return;
  try { await applyCellValueChange(state.currentSheet, meta.col, meta.rowNum, selectedValue, { statusMessage: I18N.STATUS_CHANGED(state.currentDbName) }); }
  catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
}

export function focusCellByRef(cellRef) {
  if (!cellRef) return;
  const td = dom.sheetWrapEl.querySelector(`td[data-cell="${cellRef}"]`);
  if (!td) return;
  selectCell(td);
  td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

export async function clearSelectedCellValue() {
  const meta = getSelectedCellMeta();
  if (!meta || !meta.cell) return;
  if (!isCellEditable(meta.cell, meta.rowDef, meta.colDef)) return setStatus(I18N.CELL_NOT_EDITABLE, true);
  const valueType = String(meta.cell.value_type || 'TEXT').toUpperCase();
  let clearedValue = '';
  if (valueType === 'BOOLEAN') clearedValue = false;
  else if (valueType === 'JSON' && isJsonDropdownCell(meta.cell)) {
    const options = getJsonDropdownOptions(meta.cell);
    if (options.includes('')) clearedValue = ''; else throw new Error(I18N.DROPDOWN_CANNOT_CLEAR);
  }
  try { await applyCellValueChange(state.currentSheet, meta.col, meta.rowNum, clearedValue, { statusMessage: I18N.STATUS_CHANGED(state.currentDbName) }); }
  catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
}

export function moveSelectionRelative(rowDelta, colDelta) {
  if (!state.currentSheet) return;
  import('../render/render-sheet.js').then(({ getVisibleRowNumbersForCurrentSheet }) => {
    const sheet = state.workbook.get(state.currentSheet); if (!sheet) return;
    import('../utils.js').then(({ getOrderedColumns }) => {
      const cols = getOrderedColumns(sheet);
      const rowNums = getVisibleRowNumbersForCurrentSheet(sheet, state.currentSheet);
      if (!cols.length || !rowNums.length) return;
      let startRowIndex = 0, startColIndex = 0;
      if (state.currentSelectedCellRef) {
        const match = /^([A-Z]+)(\d+)$/.exec(state.currentSelectedCellRef);
        if (match) {
          const foundColIndex = cols.indexOf(match[1]);
          const foundRowIndex = rowNums.indexOf(Number(match[2]));
          if (foundColIndex >= 0) startColIndex = foundColIndex;
          if (foundRowIndex >= 0) startRowIndex = foundRowIndex;
        }
      }
      const nextRowIndex = Math.max(0, Math.min(rowNums.length - 1, startRowIndex + rowDelta));
      const nextColIndex = Math.max(0, Math.min(cols.length - 1, startColIndex + colDelta));
      focusCellByRef(`${cols[nextColIndex]}${rowNums[nextRowIndex]}`);
    });
  });
}

export function activateCellEditor(td) {
  if (!td || td.dataset.editable !== 'true' || td.dataset.editing === 'true') return;
  const meta = getCellRecord(state.currentSheet, td.dataset.cell || '');
  if (!meta || !meta.cell) return;
  const valueType = String(meta.cell.value_type || 'TEXT').toUpperCase();
  if (valueType === 'BOOLEAN') return toggleBooleanCell(td);
  if (valueType === 'JSON' && isJsonDropdownCell(meta.cell)) {
    const select = td.querySelector('select.cell-dropdown');
    if (select && !select.disabled) select.focus();
    return;
  }
  if (valueType === 'BLOB') return;
  td.dataset.editing = 'true'; td.classList.add('cell-editing');
  const oldValue = td.dataset.value || ''; td.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'cell-editor'; input.value = oldValue;
  let finished = false;
  const finish = async save => {
    if (finished) return; finished = true;
    const newValue = input.value; td.dataset.editing = 'false'; td.classList.remove('cell-editing');
    if (!save || newValue === oldValue) {
      await reloadWorkbookFromDb();
      const updatedTd = dom.sheetWrapEl.querySelector(`td[data-cell="${td.dataset.cell}"]`);
      if (updatedTd) selectCell(updatedTd);
      return;
    }
    try { await applyCellValueChange(state.currentSheet, meta.col, meta.rowNum, newValue, { statusMessage: I18N.STATUS_CHANGED(state.currentDbName) }); }
    catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
  };
  input.addEventListener('keydown', async event => {
    if (event.key === 'Enter') { event.preventDefault(); await finish(true); }
    else if (event.key === 'Escape') { event.preventDefault(); await finish(false); }
  });
  input.addEventListener('blur', async () => { await finish(true); });
  td.appendChild(input); input.focus(); input.select();
}

export async function saveFormulaBoxToSelectedCell() {
  const meta = getSelectedCellMeta();
  if (!meta || !meta.cell || !dom.formulaBox) return;
  if (!isCellEditable(meta.cell, meta.rowDef, meta.colDef)) { setStatus(I18N.CELL_NOT_EDITABLE, true); dom.formulaBox.disabled = true; return; }
  const valueType = String(meta.cell.value_type || 'TEXT').toUpperCase();
  try {
    if (valueType === 'BOOLEAN') {
      const raw = String(dom.formulaBox.value || '').trim().toLowerCase();
      const boolValue = raw === 'true' || raw === '1' || raw === 'ja' || raw === 'yes' || raw === 'on';
      await applyCellValueChange(state.currentSheet, meta.col, meta.rowNum, boolValue, { statusMessage: I18N.STATUS_CHANGED(state.currentDbName) });
    } else {
      await applyCellValueChange(state.currentSheet, meta.col, meta.rowNum, dom.formulaBox.value, { statusMessage: I18N.STATUS_CHANGED(state.currentDbName) });
    }
  } catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
}
