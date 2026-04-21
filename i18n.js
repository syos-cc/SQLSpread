export const I18N = {
  APP_TITLE: 'SQLSpread',
  OPEN_DB_LABEL: 'Select SQLite file',
  SAVE_DB_BUTTON: 'Save database',
  STATUS_NO_FILE: 'No file loaded',
  INITIAL_EMPTY_HTML: 'Load a SQLite file. Expected tables: <code>tabs</code>, <code>lines</code>, <code>parts</code>, and <code>cells</code>.<div class="muted">Tabs = <code>name</code>, columns = <code>part</code>, rows = <code>line</code>.</div>',
  REQUIRED_TABLES_MISSING: missing => `The SQLite file is missing required tables: ${missing.join(', ')}`,
  DEFAULT_SHEET_NAME: 'Sheet',
  CONFIG_PARSE_ERROR: 'UI state in config could not be parsed:',
  EMPTY_NO_DISPLAYABLE_SHEETS: 'The database contains no displayable sheets.',
  LOAD_SUCCESS: ({ label, cells, sheets }) => `${label} loaded · ${cells} cells · ${sheets} sheet(s)`,
  LOAD_ERROR_PREFIX: 'Error loading:',
  NO_DATABASE_LOADED: 'No database loaded.',
  SAVE_CANCELED: 'Save canceled',
  SAVE_SUCCESS: name => `${name} saved`,
  LOADING_FILE: name => `Loading ${name} ...`,
  CELL_NOT_FOUND: 'Cell not found.',
  BLOB_NOT_SUPPORTED: 'BLOB cells are not supported yet.',
  DROPDOWN_VALUE_INVALID: 'Value is not in the dropdown options.',
  INVALID_INTEGER: 'Please enter a valid integer.',
  INVALID_NUMBER: 'Please enter a valid number.',
  STATUS_CHANGED: name => `${name} changed`,
  STATUS_CHANGED_UNDO: name => `${name} changed (undo)`,
  STATUS_CHANGED_REDO: name => `${name} changed (redo)`,
  NOTHING_TO_UNDO: 'Nothing to undo',
  NOTHING_TO_REDO: 'Nothing to redo',
  CELL_NOT_EDITABLE: 'This cell is not editable.',
  DROPDOWN_CANNOT_CLEAR: 'This dropdown cell cannot be cleared.',
  NO_SHEETS_FOUND: 'No sheets found',
  SHEET_NOT_FOUND: 'Sheet not found',
  SHEET_NO_DISPLAYABLE_COLUMNS: 'This sheet has no displayable columns.',
  NO_ROWS_MATCH_FILTER: 'No rows match the active filter.',
  FILTER_HEADER: col => `Filter: ${col}`,
  FILTER_ALL: 'All',
  FILTER_NONE: 'None',
  FILTER_RESET: 'Reset',
  FILTER_APPLY: 'Apply',
  FILTER_CLOSE: 'Close',
  FILTER_EMPTY: '(Empty)'
};

export function applyStaticTranslations(documentRef = document) {
  documentRef.documentElement.lang = 'en';
  if (documentRef.title !== undefined) documentRef.title = I18N.APP_TITLE;
  const openDbLabel = documentRef.getElementById('openDbLabel');
  if (openDbLabel) openDbLabel.textContent = I18N.OPEN_DB_LABEL;
  const saveBtn = documentRef.getElementById('saveBtn');
  if (saveBtn) saveBtn.textContent = I18N.SAVE_DB_BUTTON;
  const statusEl = documentRef.getElementById('status');
  if (statusEl) statusEl.textContent = I18N.STATUS_NO_FILE;
  const sheetWrapEl = documentRef.getElementById('sheetWrap');
  if (sheetWrapEl) {
    sheetWrapEl.innerHTML = `<div class="empty">${I18N.INITIAL_EMPTY_HTML}</div>`;
  }
}
