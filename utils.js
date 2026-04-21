import { DEFAULTS } from './state.js';

export function isElectron() {
  return typeof window.sqlspreadFS !== 'undefined';
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeColName(x) {
  return String(x || '').trim().toUpperCase();
}

export function colNameToNumber(name) {
  const s = normalizeColName(name);
  if (!/^[A-Z]+$/.test(s)) return Number.MAX_SAFE_INTEGER;
  let num = 0;
  for (let i = 0; i < s.length; i += 1) num = num * 26 + (s.charCodeAt(i) - 64);
  return num;
}

export function sortColumns(cols) {
  return [...cols].sort((a, b) => {
    const na = colNameToNumber(a);
    const nb = colNameToNumber(b);
    if (na !== nb) return na - nb;
    return String(a).localeCompare(String(b));
  });
}

export function withDefault(value, fallback) {
  return value === null || value === undefined ? fallback : value;
}

export function styleValue(value) {
  return value === null || value === undefined || value === '' ? undefined : value;
}

export function cssUserSelect(value) {
  if (value === null || value === undefined) return undefined;
  return value ? 'text' : 'none';
}

export function isBooleanTrue(value) {
  return value === true || value === 1 || value === '1' || (typeof value === 'string' && value.toLowerCase() === 'true');
}

export function isExplicitFalse(value) {
  return value === false || value === 0 || value === '0' || (typeof value === 'string' && value.toLowerCase() === 'false');
}

export function parseJsonValue(cell) {
  if (!cell || cell.value == null || cell.value === '') return null;
  try { return typeof cell.value === 'string' ? JSON.parse(cell.value) : cell.value; } catch { return null; }
}

export function isJsonDropdownCell(cell) {
  const obj = parseJsonValue(cell);
  return !!(obj && typeof obj === 'object' && String(obj.type || '').toLowerCase() === 'dropdown' && Array.isArray(obj.options));
}

export function getJsonDropdownSelected(cell) {
  const obj = parseJsonValue(cell);
  if (!obj || typeof obj !== 'object') return '';
  if (obj.selected !== undefined && obj.selected !== null) return String(obj.selected);
  if (obj.selectd !== undefined && obj.selectd !== null) return String(obj.selectd);
  return '';
}

export function getJsonDropdownOptions(cell) {
  const obj = parseJsonValue(cell);
  if (!obj || !Array.isArray(obj.options)) return [''];
  return obj.options.map(v => String(v));
}

export function isCellEditable(cell = null, rowDef = {}, colDef = {}) {
  const resolvedUserSelect = withDefault(cell?.user_select, withDefault(rowDef?.user_select, withDefault(colDef?.user_select, DEFAULTS.CELL.user_select)));
  return !isExplicitFalse(resolvedUserSelect);
}

export function cellDisplayValue(cell) {
  if (!cell) return '';
  const type = String(cell.value_type || 'TEXT').toUpperCase();
  const raw = cell.value ?? '';
  if (type === 'JSON' && isJsonDropdownCell(cell)) return getJsonDropdownSelected(cell);
  switch (type) {
    case 'INTEGER': return raw === null || raw === '' ? '' : String(parseInt(raw, 10));
    case 'REAL': return raw === null || raw === '' ? '' : String(raw);
    case 'BOOLEAN': return isBooleanTrue(raw);
    case 'BLOB': return raw == null || raw === '' ? '' : '[BLOB]';
    case 'NULL': return '';
    case 'JSON': return raw ?? '';
    default: return raw ?? '';
  }
}

export function normalizeNoticeValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text || text.toUpperCase() === 'NULL') return '';
  return text;
}

export function getCssPixelValue(value, fallback) {
  const source = value === null || value === undefined || value === '' ? fallback : value;
  const parsed = parseFloat(String(source));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isFrozenRow(rowDef = {}) { return isBooleanTrue(rowDef?.freeze); }
export function isFrozenColumn(colDef = {}) { return isBooleanTrue(colDef?.freeze); }
export function getFrozenRowNumbers(sheet) { return [...sheet.rows].sort((a, b) => a - b).filter(rowNum => isFrozenRow(sheet.rowDefs.get(rowNum) || {})); }
export function getFrozenColumns(sheet) { return sortColumns(sheet.cols).filter(col => isFrozenColumn(sheet.colDefs.get(col) || {})); }
export function getOrderedColumns(sheet) {
  const allCols = sortColumns(sheet.cols);
  const frozenCols = getFrozenColumns(sheet);
  const frozenSet = new Set(frozenCols);
  return [...frozenCols, ...allCols.filter(col => !frozenSet.has(col))];
}

export function buildStyleString(styleMap) {
  return Object.entries(styleMap)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${String(value)}`)
    .join(';');
}

export function buildTabStyle(tabDef = {}) {
  return buildStyleString({
    visibility: styleValue(withDefault(tabDef.visibility, DEFAULTS.TAB.visibility)),
    userSelect: styleValue(cssUserSelect(withDefault(tabDef.user_select, DEFAULTS.TAB.user_select)))
  });
}

export function buildCellStyle(cell = null, rowDef = {}, colDef = {}) {
  const fixedWidth = withDefault(colDef?.width, DEFAULTS.COLUMN.width);
  const fixedHeight = withDefault(rowDef?.height, DEFAULTS.ROW.height);
  const resolvedUserSelect = withDefault(cell?.user_select, withDefault(rowDef?.user_select, withDefault(colDef?.user_select, DEFAULTS.CELL.user_select)));
  return buildStyleString({
    width: styleValue(fixedWidth), minWidth: styleValue(fixedWidth), maxWidth: styleValue(fixedWidth),
    height: styleValue(fixedHeight), minHeight: styleValue(fixedHeight), maxHeight: styleValue(fixedHeight),
    padding: styleValue(withDefault(cell?.padding, DEFAULTS.CELL.padding)),
    border: styleValue(withDefault(cell?.border, DEFAULTS.CELL.border)),
    borderTop: styleValue(withDefault(cell?.border_top, DEFAULTS.CELL.border_top)),
    borderRight: styleValue(withDefault(cell?.border_right, DEFAULTS.CELL.border_right)),
    borderBottom: styleValue(withDefault(cell?.border_bottom, DEFAULTS.CELL.border_bottom)),
    borderLeft: styleValue(withDefault(cell?.border_left, DEFAULTS.CELL.border_left)),
    backgroundColor: styleValue(withDefault(cell?.background_color, withDefault(rowDef?.background_color, withDefault(colDef?.background_color, DEFAULTS.CELL.background_color)))),
    boxShadow: styleValue(withDefault(cell?.box_shadow, DEFAULTS.CELL.box_shadow)),
    textAlign: styleValue(withDefault(cell?.text_align, DEFAULTS.CELL.text_align)),
    verticalAlign: styleValue(withDefault(cell?.vertical_align, DEFAULTS.CELL.vertical_align)),
    font: styleValue(withDefault(cell?.font, DEFAULTS.CELL.font)),
    fontWeight: styleValue(withDefault(cell?.font_weight, DEFAULTS.CELL.font_weight)),
    color: styleValue(withDefault(cell?.color, DEFAULTS.CELL.color)),
    whiteSpace: styleValue(withDefault(cell?.white_space, DEFAULTS.CELL.white_space)),
    overflow: styleValue(withDefault(cell?.overflow, DEFAULTS.CELL.overflow)),
    textOverflow: styleValue(withDefault(cell?.text_overflow, DEFAULTS.CELL.text_overflow)),
    display: styleValue(withDefault(cell?.display, DEFAULTS.CELL.display)),
    visibility: styleValue(withDefault(cell?.visibility, withDefault(rowDef?.visibility, withDefault(colDef?.visibility, DEFAULTS.CELL.visibility)))),
    opacity: styleValue(withDefault(cell?.opacity, DEFAULTS.CELL.opacity)),
    cursor: styleValue(withDefault(cell?.cursor, DEFAULTS.CELL.cursor)),
    userSelect: styleValue(cssUserSelect(resolvedUserSelect))
  });
}
