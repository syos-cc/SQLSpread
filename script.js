let SQL;
let db;
let workbook = new Map();
let currentSheet = null;
let currentDbPath = null;
let currentDbName = 'database.sqlite';

const statusEl = document.getElementById('status');
const tabsEl = document.getElementById('tabs');
const sheetWrapEl = document.getElementById('sheetWrap');
const dbFileInput = document.getElementById('dbFile');
const openBtn = document.getElementById('openBtn');
const saveBtn = document.getElementById('saveBtn');
const nameBox = document.getElementById('nameBox');
const formulaBox = document.getElementById('formulaBox');

function isElectron() {
  return typeof window.sqlspreadFS !== 'undefined';
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'status error' : 'status';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeColName(x) {
  return String(x || '').trim().toUpperCase();
}

function colNameToNumber(name) {
  const s = normalizeColName(name);
  if (!/^[A-Z]+$/.test(s)) return Number.MAX_SAFE_INTEGER;
  let num = 0;
  for (let i = 0; i < s.length; i++) {
    num = num * 26 + (s.charCodeAt(i) - 64);
  }
  return num;
}

function sortColumns(cols) {
  return [...cols].sort((a, b) => {
    const na = colNameToNumber(a);
    const nb = colNameToNumber(b);
    if (na !== nb) return na - nb;
    return String(a).localeCompare(String(b));
  });
}

function cellDisplayValue(cell) {
  if (!cell) return '';
  const type = String(cell.value_type || 'TEXT').toUpperCase();
  switch (type) {
    case 'INTEGER':
      return cell.value_integer ?? '';
    case 'REAL':
      return cell.value_real ?? '';
    case 'BLOB':
      return cell.value_blob == null ? '' : '[BLOB]';
    case 'NULL':
      return '';
    case 'TEXT':
    default:
      return cell.value_text ?? '';
  }
}


function cssUserSelect(value) {
  if (value === null || value === undefined) return undefined;
  return value ? 'text' : 'none';
}

const DEFAULTS = {
  ROW: {
    height: '24px',
    min_height: '24px',
    max_height: '24px',
    background_color: '#ffffff',
    visibility: 'visible',
    user_select: true
  },
  COLUMN: {
    width: '120px',
    min_width: '40px',
    max_width: '500px',
    background_color: '#ffffff',
    visibility: 'visible',
    user_select: true
  },
  CELL: {
    padding: '2px 6px',
    border: '1px solid #d9d9d9',
    border_top: null,
    border_right: null,
    border_bottom: null,
    border_left: null,
    background_color: '#ffffff',
    box_shadow: 'none',
    text_align: 'left',
    vertical_align: 'middle',
    font: '14px Calibri, "Segoe UI", Arial, sans-serif',
    color: '#000000',
    white_space: 'nowrap',
    overflow: 'hidden',
    text_overflow: 'ellipsis',
    display: 'table-cell',
    visibility: 'visible',
    opacity: '1',
    cursor: 'cell',
    user_select: true,
    notice: ''
  }
};

function withDefault(value, fallback) {
  return value === null || value === undefined ? fallback : value;
}

function styleValue(value) {
  return value === null || value === undefined || value === '' ? undefined : value;
}

function buildCellStyle(cell, rowDef, colDef) {
  const resolvedUserSelect = withDefault(
    cell?.user_select,
    withDefault(
      rowDef?.user_select,
      withDefault(colDef?.user_select, DEFAULTS.CELL.user_select)
    )
  );

  const styleMap = {
    width: styleValue(withDefault(colDef?.width, DEFAULTS.COLUMN.width)),
    minWidth: styleValue(withDefault(colDef?.min_width, DEFAULTS.COLUMN.min_width)),
    maxWidth: styleValue(withDefault(colDef?.max_width, DEFAULTS.COLUMN.max_width)),
    height: styleValue(withDefault(rowDef?.height, DEFAULTS.ROW.height)),
    minHeight: styleValue(withDefault(rowDef?.min_height, DEFAULTS.ROW.min_height)),
    maxHeight: styleValue(withDefault(rowDef?.max_height, DEFAULTS.ROW.max_height)),
    padding: styleValue(withDefault(cell?.padding, DEFAULTS.CELL.padding)),
    border: styleValue(withDefault(cell?.border, DEFAULTS.CELL.border)),
    borderTop: styleValue(withDefault(cell?.border_top, DEFAULTS.CELL.border_top)),
    borderRight: styleValue(withDefault(cell?.border_right, DEFAULTS.CELL.border_right)),
    borderBottom: styleValue(withDefault(cell?.border_bottom, DEFAULTS.CELL.border_bottom)),
    borderLeft: styleValue(withDefault(cell?.border_left, DEFAULTS.CELL.border_left)),
    backgroundColor: styleValue(
      withDefault(
        cell?.background_color,
        withDefault(
          rowDef?.background_color,
          withDefault(colDef?.background_color, DEFAULTS.CELL.background_color)
        )
      )
    ),
    boxShadow: styleValue(withDefault(cell?.box_shadow, DEFAULTS.CELL.box_shadow)),
    textAlign: styleValue(withDefault(cell?.text_align, DEFAULTS.CELL.text_align)),
    verticalAlign: styleValue(withDefault(cell?.vertical_align, DEFAULTS.CELL.vertical_align)),
    font: styleValue(withDefault(cell?.font, DEFAULTS.CELL.font)),
    color: styleValue(withDefault(cell?.color, DEFAULTS.CELL.color)),
    whiteSpace: styleValue(withDefault(cell?.white_space, DEFAULTS.CELL.white_space)),
    overflow: styleValue(withDefault(cell?.overflow, DEFAULTS.CELL.overflow)),
    textOverflow: styleValue(withDefault(cell?.text_overflow, DEFAULTS.CELL.text_overflow)),
    display: styleValue(withDefault(cell?.display, DEFAULTS.CELL.display)),
    visibility: styleValue(
      withDefault(
        cell?.visibility,
        withDefault(
          rowDef?.visibility,
          withDefault(colDef?.visibility, DEFAULTS.CELL.visibility)
        )
      )
    ),
    opacity: styleValue(withDefault(cell?.opacity, DEFAULTS.CELL.opacity)),
    cursor: styleValue(withDefault(cell?.cursor, DEFAULTS.CELL.cursor)),
    userSelect: styleValue(cssUserSelect(resolvedUserSelect))
  };

  return Object.entries(styleMap)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${String(value)}`)
    .join(';');
}

function buildTabStyle(tabDef) {
  const resolvedVisibility = withDefault(tabDef?.visibility, 'visible');
  const resolvedUserSelect = withDefault(tabDef?.user_select, true);

  const styleMap = {
    visibility: styleValue(resolvedVisibility),
    userSelect: styleValue(cssUserSelect(resolvedUserSelect))
  };

  return Object.entries(styleMap)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${String(value)}`)
    .join(';');
}

function hasTable(database, tableName) {
  const res = database.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=${JSON.stringify(tableName)}`
  );
  return res.length > 0;
}

function requireSchema(database) {
  const required = ['data', 'general_tabs', 'general_rows', 'general_columns'];
  const missing = required.filter(name => !hasTable(database, name));
  if (missing.length) {
    throw new Error(`Die SQLite-Datei enthält nicht alle benötigten Tabellen: ${missing.join(', ')}`);
  }
}

function queryTable(database, sql) {
  const result = database.exec(sql);
  if (!result.length) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => Object.fromEntries(row.map((value, i) => [columns[i], value])));
}

function queryWorkbook(database) {
  return {
    tabs: queryTable(database, `
      SELECT z, visibility, user_select
      FROM general_tabs
      ORDER BY z
    `),
    rows: queryTable(database, `
      SELECT y, z, height, min_height, max_height, background_color, visibility, user_select
      FROM general_rows
      ORDER BY z, y
    `),
    columns: queryTable(database, `
      SELECT x, z, width, min_width, max_width, background_color, visibility, user_select
      FROM general_columns
      ORDER BY z, x
    `),
    cells: queryTable(database, `
      SELECT
        x, y, z,
        value_type, value_text, value_integer, value_real, value_blob,
        padding, border, border_top, border_right, border_bottom, border_left,
        background_color, box_shadow, text_align, vertical_align, font, color,
        white_space, overflow, text_overflow, display, visibility, opacity,
        cursor, user_select, notice
      FROM data
      ORDER BY z, y, x
    `)
  };
}

function ensureSheet(book, sheetName) {
  if (!book.has(sheetName)) {
    book.set(sheetName, {
      tab: null,
      cells: new Map(),
      cols: new Set(),
      rows: new Set(),
      rowDefs: new Map(),
      colDefs: new Map()
    });
  }
  return book.get(sheetName);
}

function transformWorkbook(payload) {
  const book = new Map();

  for (const tab of payload.tabs) {
    const sheetName = tab.z || 'Tabelle';
    const sheet = ensureSheet(book, sheetName);
    sheet.tab = tab;
  }

  for (const rowDef of payload.rows) {
    const sheetName = rowDef.z || 'Tabelle';
    const sheet = ensureSheet(book, sheetName);
    const rowNum = Number(rowDef.y);
    if (!Number.isFinite(rowNum)) continue;
    sheet.rows.add(rowNum);
    sheet.rowDefs.set(rowNum, rowDef);
  }

  for (const colDef of payload.columns) {
    const sheetName = colDef.z || 'Tabelle';
    const sheet = ensureSheet(book, sheetName);
    const col = normalizeColName(colDef.x);
    if (!col) continue;
    sheet.cols.add(col);
    sheet.colDefs.set(col, colDef);
  }

  for (const cell of payload.cells) {
    const sheetName = cell.z || 'Tabelle';
    const sheet = ensureSheet(book, sheetName);
    const col = normalizeColName(cell.x);
    const rowNum = Number(cell.y);
    if (!col || !Number.isFinite(rowNum)) continue;
    sheet.cols.add(col);
    sheet.rows.add(rowNum);
    sheet.cells.set(`${col}|${rowNum}`, cell);
  }

  return book;
}

function renderTabs() {
  tabsEl.innerHTML = '';
  const names = [...workbook.keys()];
  if (!names.length) {
    const msg = document.createElement('div');
    msg.className = 'muted';
    msg.textContent = 'Keine Blätter gefunden';
    tabsEl.appendChild(msg);
    return;
  }

  for (const name of names) {
    const sheet = workbook.get(name);
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab' + (name === currentSheet ? ' active' : '');
    tab.textContent = name;
    const tabStyle = buildTabStyle(sheet?.tab);
    if (tabStyle) tab.setAttribute('style', tabStyle);
    tab.addEventListener('click', () => {
      currentSheet = name;
      renderTabs();
      renderSheet(name);
    });
    tabsEl.appendChild(tab);
  }
}


function renderSheet(sheetName) {
  const sheet = workbook.get(sheetName);
  if (!sheet) {
    sheetWrapEl.innerHTML = '<div class="empty">Blatt nicht gefunden</div>';
    return;
  }

  const cols = sortColumns(sheet.cols);
  const rowNums = [...sheet.rows].sort((a, b) => a - b);

  if (!cols.length || !rowNums.length) {
    sheetWrapEl.innerHTML = '<div class="empty">Dieses Blatt enthält keine darstellbaren Zeilen oder Spalten.</div>';
    return;
  }

  const colWidthStyles = cols.map(col => {
    const colDef = sheet.colDefs.get(col) || {};
    const width = withDefault(colDef.width, DEFAULTS.COLUMN.width);
    const minWidth = withDefault(colDef.min_width, DEFAULTS.COLUMN.min_width);
    const maxWidth = withDefault(colDef.max_width, DEFAULTS.COLUMN.max_width);
    const visibility = withDefault(colDef.visibility, DEFAULTS.COLUMN.visibility);
    return `<col style="width:${escapeHtml(width)};min-width:${escapeHtml(minWidth)};max-width:${escapeHtml(maxWidth)};visibility:${escapeHtml(visibility)};">`;
  }).join('');

  let html = `<table class="sheet"><colgroup><col style="width:48px">${colWidthStyles}</colgroup><thead><tr><th class="corner-cell"></th>`;
  for (const col of cols) {
    const colDef = sheet.colDefs.get(col) || {};
    const colHeaderStyle = [
      `width:${withDefault(colDef.width, DEFAULTS.COLUMN.width)}`,
      `min-width:${withDefault(colDef.min_width, DEFAULTS.COLUMN.min_width)}`,
      `max-width:${withDefault(colDef.max_width, DEFAULTS.COLUMN.max_width)}`,
      `background-color:${withDefault(colDef.background_color, DEFAULTS.COLUMN.background_color)}`,
      `visibility:${withDefault(colDef.visibility, DEFAULTS.COLUMN.visibility)}`,
      `user-select:${cssUserSelect(withDefault(colDef.user_select, DEFAULTS.COLUMN.user_select))}`
    ];
    html += `<th class="col-header" style="${escapeHtml(colHeaderStyle.join(';'))}">${escapeHtml(col)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const rowNum of rowNums) {
    const rowDef = sheet.rowDefs.get(rowNum) || {};
    const rowHeaderStyle = [
      `height:${withDefault(rowDef.height, DEFAULTS.ROW.height)}`,
      `min-height:${withDefault(rowDef.min_height, DEFAULTS.ROW.min_height)}`,
      `max-height:${withDefault(rowDef.max_height, DEFAULTS.ROW.max_height)}`,
      `background-color:${withDefault(rowDef.background_color, DEFAULTS.ROW.background_color)}`,
      `visibility:${withDefault(rowDef.visibility, DEFAULTS.ROW.visibility)}`,
      `user-select:${cssUserSelect(withDefault(rowDef.user_select, DEFAULTS.ROW.user_select))}`
    ];

    html += `<tr><th class="row-header" style="${escapeHtml(rowHeaderStyle.join(';'))}">${escapeHtml(rowNum)}</th>`;
    for (const col of cols) {
      const cell = sheet.cells.get(`${col}|${rowNum}`);
      const colDef = sheet.colDefs.get(col) || {};
      const value = cellDisplayValue(cell);
      const titleValue = withDefault(cell?.notice, DEFAULTS.CELL.notice);
      const title = titleValue ? ` title="${escapeHtml(titleValue)}"` : '';
      const style = buildCellStyle(cell, rowDef, colDef);
      html += `<td data-cell="${escapeHtml(col + rowNum)}" data-value="${escapeHtml(String(value))}" ${title}${style ? ` style="${escapeHtml(style)}"` : ''}>${escapeHtml(value)}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  sheetWrapEl.innerHTML = html;

  for (const td of sheetWrapEl.querySelectorAll('td[data-cell]')) {
    td.addEventListener('click', () => {
      nameBox.textContent = td.dataset.cell;
      formulaBox.textContent = td.dataset.value || '';
    });
  }
}

async function ensureSqlJs() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: file => `${file}`
    });
  }
}

async function loadDatabaseFromArrayBuffer(buffer, label, pathHint = null) {
  try {
    await ensureSqlJs();
    db = new SQL.Database(new Uint8Array(buffer));
    requireSchema(db);

    const payload = queryWorkbook(db);
    workbook = transformWorkbook(payload);
    currentSheet = [...workbook.keys()][0] || null;
    currentDbPath = pathHint;
    currentDbName = label || 'database.sqlite';

    renderTabs();
    if (currentSheet) {
      renderSheet(currentSheet);
    } else {
      sheetWrapEl.innerHTML = '<div class="empty">Die Tabellen enthalten keine darstellbaren Blätter.</div>';
    }

    nameBox.textContent = '-';
    formulaBox.textContent = '-';
    setStatus(`${label} geladen · ${payload.cells.length} Zellen · ${payload.rows.length} Zeilen · ${payload.columns.length} Spalten · ${workbook.size} Blatt/Blätter`);
  } catch (error) {
    console.error(error);
    workbook = new Map();
    currentSheet = null;
    currentDbPath = null;
    renderTabs();
    sheetWrapEl.innerHTML = `<div class="empty">Fehler beim Laden: ${escapeHtml(error.message || String(error))}</div>`;
    setStatus(error.message || String(error), true);
  }
}

async function openViaElectron() {
  try {
    setStatus('Öffne Datenbank ...');
    const result = await window.sqlspreadFS.openDatabase();
    if (!result || result.canceled) {
      setStatus('Öffnen abgebrochen');
      return;
    }
    const buffer = new Uint8Array(result.data).buffer;
    await loadDatabaseFromArrayBuffer(buffer, result.name, result.path);
  } catch (error) {
    console.error(error);
    setStatus(error.message || String(error), true);
  }
}

async function saveViaElectron() {
  try {
    if (!db) {
      setStatus('Keine Datenbank geladen', true);
      return;
    }
    const bytes = Array.from(db.export());
    const result = await window.sqlspreadFS.saveDatabase({
      path: currentDbPath,
      filename: currentDbName,
      data: bytes
    });
    if (!result || result.canceled) {
      setStatus('Speichern abgebrochen');
      return;
    }
    currentDbPath = result.path;
    currentDbName = result.name;
    setStatus(`${result.name} gespeichert`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || String(error), true);
  }
}

function saveViaBrowser() {
  if (!db) {
    setStatus('Keine Datenbank geladen', true);
    return;
  }
  const bytes = db.export();
  const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentDbName || 'database.sqlite';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`${a.download} gespeichert`);
}

dbFileInput?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  setStatus(`Lade ${file.name} ...`);
  const buffer = await file.arrayBuffer();
  await loadDatabaseFromArrayBuffer(buffer, file.name, null);
});

openBtn?.addEventListener('click', async () => {
  if (isElectron()) {
    await openViaElectron();
  } else {
    dbFileInput?.click();
  }
});

saveBtn?.addEventListener('click', async () => {
  if (isElectron()) {
    await saveViaElectron();
  } else {
    saveViaBrowser();
  }
});

