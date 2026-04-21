import { CONFIG_UI_STATE_KEY, state, dom, resetWorkbookState } from './state.js';
import { escapeHtml, isElectron, normalizeColName } from './utils.js';
import { renderTabs } from './render/render-tabs.js';
import { renderSheet } from './render/render-sheet.js';
import { I18N } from './i18n.js';

export function setStatus(message, isError = false) {
  if (!dom.statusEl) return;
  dom.statusEl.textContent = message;
  dom.statusEl.className = isError ? 'status error' : 'status';
}

export function hasTable(database, tableName) {
  const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name=${JSON.stringify(tableName)}`;
  return database.exec(sql).length > 0;
}

export function requireSchema(database) {
  const required = ['cells', 'tabs', 'lines', 'parts'];
  const missing = required.filter(name => !hasTable(database, name));
  if (missing.length) throw new Error(I18N.REQUIRED_TABLES_MISSING(missing));
}

export function queryTable(database, sql) {
  const result = database.exec(sql);
  if (!result.length) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => Object.fromEntries(row.map((value, i) => [columns[i], value])));
}

export function queryWorkbook(database) {
  return {
    tabs: queryTable(database, `SELECT name AS z, sort_order, visibility, user_select FROM tabs ORDER BY sort_order, name`),
    rows: queryTable(database, `SELECT line AS y, tab AS z, height, background_color, visibility, user_select, freeze FROM lines ORDER BY tab, line`),
    columns: queryTable(database, `SELECT part AS x, tab AS z, width, background_color, visibility, user_select, freeze FROM parts ORDER BY tab, part`),
    cells: queryTable(database, `SELECT part AS x, line AS y, tab AS z, value_type, value, padding, border, border_top, border_right, border_bottom, border_left, background_color, box_shadow, text_align, vertical_align, font, font_weight, color, white_space, overflow, text_overflow, display, visibility, opacity, cursor, user_select, notice FROM cells ORDER BY tab, line, part`)
  };
}

export function ensureSheet(book, name) {
  if (!book.has(name)) {
    book.set(name, { tabDef: {}, rowDefs: new Map(), colDefs: new Map(), cells: new Map(), rows: new Set(), cols: new Set() });
  }
  return book.get(name);
}

export function buildWorkbook(data) {
  const book = new Map();
  for (const tab of data.tabs) {
    const sheetName = tab.z || I18N.DEFAULT_SHEET_NAME;
    ensureSheet(book, sheetName).tabDef = tab;
  }
  for (const row of data.rows) {
    const sheetName = row.z || I18N.DEFAULT_SHEET_NAME;
    const rowNum = Number(row.y);
    if (!Number.isFinite(rowNum)) continue;
    const sheet = ensureSheet(book, sheetName);
    sheet.rowDefs.set(rowNum, row);
    sheet.rows.add(rowNum);
  }
  for (const col of data.columns) {
    const sheetName = col.z || I18N.DEFAULT_SHEET_NAME;
    const colName = normalizeColName(col.x);
    if (!colName) continue;
    const sheet = ensureSheet(book, sheetName);
    sheet.colDefs.set(colName, { ...col, x: colName });
    sheet.cols.add(colName);
  }
  for (const cell of data.cells) {
    const sheetName = cell.z || I18N.DEFAULT_SHEET_NAME;
    const colName = normalizeColName(cell.x);
    const rowNum = Number(cell.y);
    if (!colName || !Number.isFinite(rowNum)) continue;
    const sheet = ensureSheet(book, sheetName);
    sheet.cells.set(`${colName}|${rowNum}`, { ...cell, x: colName, y: rowNum });
    sheet.cols.add(colName);
    sheet.rows.add(rowNum);
  }
  return book;
}

export function hasConfigTable(database) {
  return hasTable(database, 'config');
}

export function saveUiStateToConfig() {
  if (!state.db || !hasConfigTable(state.db)) return;
  const payload = JSON.stringify({
    version: 1,
    sort: Object.fromEntries(state.sheetSortState.entries()),
    filter: Object.fromEntries([...state.sheetFilterState.entries()].map(([sheetName, filters]) => [sheetName, Object.fromEntries(filters.entries())]))
  });
  const existing = queryTable(state.db, `SELECT key FROM config WHERE key = ${JSON.stringify(CONFIG_UI_STATE_KEY)} LIMIT 1`);
  if (existing.length) {
    state.db.run(`UPDATE config SET value = ? WHERE key = ?`, [payload, CONFIG_UI_STATE_KEY]);
  } else {
    state.db.run(`INSERT INTO config (key, value) VALUES (?, ?)`, [CONFIG_UI_STATE_KEY, payload]);
  }
}

export function loadUiStateFromConfig() {
  state.sheetSortState.clear();
  state.sheetFilterState.clear();
  if (!state.db || !hasConfigTable(state.db)) return;
  const rows = queryTable(state.db, `SELECT value FROM config WHERE key = ${JSON.stringify(CONFIG_UI_STATE_KEY)} LIMIT 1`);
  if (!rows.length || rows[0].value == null || rows[0].value === '') return;
  try {
    const parsed = JSON.parse(String(rows[0].value));
    if (parsed?.sort && typeof parsed.sort === 'object') {
      for (const [sheetName, sortState] of Object.entries(parsed.sort)) {
        if (!sortState?.col || !sortState?.direction) continue;
        state.sheetSortState.set(sheetName, { col: String(sortState.col), direction: sortState.direction === 'desc' ? 'desc' : 'asc' });
      }
    }
    if (parsed?.filter && typeof parsed.filter === 'object') {
      for (const [sheetName, filterState] of Object.entries(parsed.filter)) {
        if (!filterState || typeof filterState !== 'object') continue;
        const filters = new Map();
        for (const [col, values] of Object.entries(filterState)) {
          if (!Array.isArray(values)) continue;
          filters.set(String(col), values.map(value => String(value ?? '')));
        }
        if (filters.size) state.sheetFilterState.set(sheetName, filters);
      }
    }
  } catch (error) {
    console.error(I18N.CONFIG_PARSE_ERROR, error);
  }
}

export async function ensureSqlJs() {
  if (!state.SQL) state.SQL = await initSqlJs({ locateFile: file => `${file}` });
}

export async function reloadWorkbookFromDb(statusMessage = null) {
  if (!state.db) return;
  const data = queryWorkbook(state.db);
  state.workbook = buildWorkbook(data);
  loadUiStateFromConfig();
  const { sanitizeAllUiState } = await import('./logic/filtering.js');
  sanitizeAllUiState();
  if (!state.currentSheet || !state.workbook.has(state.currentSheet)) state.currentSheet = [...state.workbook.keys()][0] || null;
  renderTabs();
  if (state.currentSheet) renderSheet(state.currentSheet);
  else if (dom.sheetWrapEl) dom.sheetWrapEl.innerHTML = `<div class="empty">${I18N.EMPTY_NO_DISPLAYABLE_SHEETS}</div>`;
  if (statusMessage) setStatus(statusMessage);
}

export async function loadDatabaseFromArrayBuffer(buffer, label, options = {}) {
  try {
    await ensureSqlJs();
    state.db = new state.SQL.Database(new Uint8Array(buffer));
    requireSchema(state.db);
    const data = queryWorkbook(state.db);
    state.workbook = buildWorkbook(data);
    loadUiStateFromConfig();
    state.currentSheet = [...state.workbook.keys()][0] || null;
    state.currentDbPath = options.path || null;
    state.currentDbName = options.name || label || 'database.sqlite';
    state.currentSelectedCellRef = null;
    state.undoStack.length = 0;
    state.redoStack.length = 0;
    renderTabs();
    if (state.currentSheet) renderSheet(state.currentSheet);
    else if (dom.sheetWrapEl) dom.sheetWrapEl.innerHTML = `<div class="empty">${I18N.EMPTY_NO_DISPLAYABLE_SHEETS}</div>`;
    if (dom.nameBox) dom.nameBox.textContent = '-';
    if (dom.formulaBox) { dom.formulaBox.value = '-'; dom.formulaBox.disabled = true; }
    setStatus(I18N.LOAD_SUCCESS({ label, cells: data.cells.length, sheets: state.workbook.size }));
  } catch (error) {
    console.error(error);
    resetWorkbookState();
    renderTabs();
    if (dom.sheetWrapEl) dom.sheetWrapEl.innerHTML = `<div class="empty">${I18N.LOAD_ERROR_PREFIX} ${escapeHtml(error.message || String(error))}</div>`;
    if (dom.formulaBox) { dom.formulaBox.value = '-'; dom.formulaBox.disabled = true; }
    setStatus(error.message || String(error), true);
  }
}

export async function saveDatabaseToFile() {
  try {
    if (!state.db) throw new Error(I18N.NO_DATABASE_LOADED);
    const bytes = Array.from(state.db.export());
    if (isElectron()) {
      const result = await window.sqlspreadFS.saveDatabase({ path: state.currentDbPath, filename: state.currentDbName || 'database.sqlite', data: bytes });
      if (!result || result.canceled) { setStatus(I18N.SAVE_CANCELED); return; }
      state.currentDbPath = result.path || state.currentDbPath;
      state.currentDbName = result.name || state.currentDbName;
      setStatus(I18N.SAVE_SUCCESS(state.currentDbName));
      return;
    }
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = state.currentDbName || 'database.sqlite';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(I18N.SAVE_SUCCESS(state.currentDbName || 'database.sqlite'));
  } catch (error) {
    console.error(error);
    setStatus(error.message || String(error), true);
  }
}
