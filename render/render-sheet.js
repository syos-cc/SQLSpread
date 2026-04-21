import { DEFAULTS, state, dom } from '../state.js';
import { buildCellStyle, buildStyleString, cellDisplayValue, cssUserSelect, escapeHtml, getCssPixelValue, getFrozenColumns, getFrozenRowNumbers, getJsonDropdownOptions, getJsonDropdownSelected, getOrderedColumns, isCellEditable, isFrozenColumn, isJsonDropdownCell, normalizeNoticeValue, styleValue, withDefault } from '../utils.js';
import { clearColumnFilter, getColumnFilterValues, hideFilterMenu, openFilterMenu, rowMatchesFilters, sanitizeSheetUiState } from '../logic/filtering.js';
import { compareCellValues, getNextSortDirection, getSheetSortState, getSortIndicator, setSheetSortState } from '../logic/sorting.js';
import { activateCellEditor, selectCell, updateJsonDropdownCell } from '../logic/editing.js';
import { startColumnResize, startRowResize } from '../logic/resizing.js';
import { hideCustomTooltip, positionCustomTooltip, showCustomTooltip } from '../components/tooltip.js';

export function getVisibleRowNumbersForCurrentSheet(sheet, sheetName) {
  const baseRowNums = [...sheet.rows].sort((a, b) => a - b);
  const frozenRowNums = [], normalRowNums = [];
  for (const rowNum of baseRowNums) {
    if ((sheet.rowDefs.get(rowNum) || {}).freeze === true || (sheet.rowDefs.get(rowNum) || {}).freeze === 1 || (sheet.rowDefs.get(rowNum) || {}).freeze === '1' || String((sheet.rowDefs.get(rowNum) || {}).freeze).toLowerCase() === 'true') frozenRowNums.push(rowNum);
    else normalRowNums.push(rowNum);
  }
  const filteredRowNums = normalRowNums.filter(rowNum => rowMatchesFilters(sheet, sheetName, rowNum));
  const sortState = getSheetSortState(sheetName);
  const canSort = !!(sortState.col && sortState.direction && !isFrozenColumn(sheet.colDefs.get(sortState.col) || {}));
  if (!canSort) return [...frozenRowNums, ...filteredRowNums];
  const factor = sortState.direction === 'desc' ? -1 : 1;
  const sortedRows = [...filteredRowNums].sort((a, b) => {
    const aCell = sheet.cells.get(`${sortState.col}|${a}`) || null;
    const bCell = sheet.cells.get(`${sortState.col}|${b}`) || null;
    const result = compareCellValues(aCell, bCell);
    if (result !== 0) return result * factor;
    return a - b;
  });
  return [...frozenRowNums, ...sortedRows];
}

export function renderSheet(sheetName) {
  if (!dom.sheetWrapEl) return;
  const sheet = state.workbook.get(sheetName);
  if (!sheet) { dom.sheetWrapEl.innerHTML = '<div class="empty">Blatt nicht gefunden</div>'; return; }
  sanitizeSheetUiState(sheetName, sheet);
  const cols = getOrderedColumns(sheet);
  const sortState = getSheetSortState(sheetName);
  const rowNums = getVisibleRowNumbersForCurrentSheet(sheet, sheetName);
  const frozenCols = getFrozenColumns(sheet);
  const frozenColSet = new Set(frozenCols);
  const frozenRows = getFrozenRowNumbers(sheet);
  const frozenRowSet = new Set(frozenRows);
  if (!cols.length) { dom.sheetWrapEl.innerHTML = '<div class="empty">Dieses Blatt enthält keine darstellbaren Spalten.</div>'; return; }
  if (!rowNums.length) { dom.sheetWrapEl.innerHTML = '<div class="empty">Keine Zeilen entsprechen dem aktiven Filter.</div>'; return; }
  const frozenColumnLeftOffsets = new Map(); let frozenLeft = 48;
  for (const col of frozenCols) { frozenColumnLeftOffsets.set(col, frozenLeft); frozenLeft += getCssPixelValue((sheet.colDefs.get(col) || {}).width, 120); }
  const frozenRowTopOffsets = new Map(); let frozenTop = 24;
  for (const rowNum of frozenRows) { frozenRowTopOffsets.set(rowNum, frozenTop); frozenTop += getCssPixelValue((sheet.rowDefs.get(rowNum) || {}).height, 24); }
  const colgroup = cols.map(col => { const width = withDefault((sheet.colDefs.get(col) || {}).width, DEFAULTS.COLUMN.width); return `<col style="width:${escapeHtml(width)};min-width:${escapeHtml(width)};max-width:${escapeHtml(width)};">`; }).join('');
  let html = `<table class="sheet"><colgroup><col style="width:48px;min-width:48px;max-width:48px;">${colgroup}</colgroup><thead><tr><th class="corner-cell"></th>`;
  for (const col of cols) {
    const colDef = sheet.colDefs.get(col) || {};
    const isFrozenCol = frozenColSet.has(col);
    const colHeaderStyle = buildStyleString({ width: styleValue(withDefault(colDef.width, DEFAULTS.COLUMN.width)), minWidth: styleValue(withDefault(colDef.width, DEFAULTS.COLUMN.width)), maxWidth: styleValue(withDefault(colDef.width, DEFAULTS.COLUMN.width)), backgroundColor: styleValue(withDefault(colDef.background_color, DEFAULTS.COLUMN.background_color)), visibility: styleValue(withDefault(colDef.visibility, DEFAULTS.COLUMN.visibility)), userSelect: styleValue(cssUserSelect(withDefault(colDef.user_select, DEFAULTS.COLUMN.user_select))), left: isFrozenCol ? `${frozenColumnLeftOffsets.get(col) || 48}px` : undefined, zIndex: isFrozenCol ? '6' : undefined });
    const isSortedCol = !isFrozenCol && sortState.col === col && !!sortState.direction;
    const isFilterActive = !!getColumnFilterValues(sheetName, col);
    html += `<th class="col-header${isFrozenCol ? '' : ' sortable'}${isSortedCol ? ' sorted' : ''}${isFilterActive ? ' filter-active' : ''}" data-col="${escapeHtml(col)}"${colHeaderStyle ? ` style="${escapeHtml(colHeaderStyle)}"` : ''}><div class="col-header-inner"><span class="col-header-label">${escapeHtml(col)}</span><span class="sort-indicator">${escapeHtml(getSortIndicator(isSortedCol ? sortState.direction : null))}</span><div class="col-resizer" data-resize-col="${escapeHtml(col)}"></div></div></th>`;
  }
  html += '</tr></thead><tbody>';
  for (const rowNum of rowNums) {
    const rowDef = sheet.rowDefs.get(rowNum) || {};
    const isFrozenRowValue = frozenRowSet.has(rowNum);
    const rowHeaderStyle = buildStyleString({ height: styleValue(withDefault(rowDef.height, DEFAULTS.ROW.height)), minHeight: styleValue(withDefault(rowDef.height, DEFAULTS.ROW.height)), maxHeight: styleValue(withDefault(rowDef.height, DEFAULTS.ROW.height)), backgroundColor: styleValue(withDefault(rowDef.background_color, DEFAULTS.ROW.background_color)), visibility: styleValue(withDefault(rowDef.visibility, DEFAULTS.ROW.visibility)), userSelect: styleValue(cssUserSelect(withDefault(rowDef.user_select, DEFAULTS.ROW.user_select))), top: isFrozenRowValue ? `${frozenRowTopOffsets.get(rowNum) || 24}px` : undefined, zIndex: isFrozenRowValue ? '5' : undefined });
    html += `<tr data-row="${rowNum}"><th class="row-header" data-row-header="${rowNum}"${rowHeaderStyle ? ` style="${escapeHtml(rowHeaderStyle)}"` : ''}><div class="row-header-inner"><span>${escapeHtml(rowNum)}</span><div class="row-resizer" data-resize-row="${rowNum}"></div></div></th>`;
    for (const col of cols) {
      const cell = sheet.cells.get(`${col}|${rowNum}`) || null;
      const colDef = sheet.colDefs.get(col) || {};
      const value = cellDisplayValue(cell);
      const titleValue = normalizeNoticeValue(withDefault(cell?.notice, DEFAULTS.CELL.notice));
      const noticeAttr = titleValue ? ` data-notice="${escapeHtml(titleValue)}"` : '';
      const baseStyle = buildCellStyle(cell, rowDef, colDef);
      const isFrozenCol = frozenColSet.has(col);
      const styleParts = [baseStyle];
      if (isFrozenRowValue) { styleParts.push('position:sticky'); styleParts.push(`top:${frozenRowTopOffsets.get(rowNum) || 24}px`); styleParts.push(`z-index:${isFrozenCol ? 4 : 3}`); }
      if (isFrozenCol) { styleParts.push('position:sticky'); styleParts.push(`left:${frozenColumnLeftOffsets.get(col) || 48}px`); styleParts.push(`z-index:${isFrozenRowValue ? 4 : 2}`); }
      const editable = isCellEditable(cell, rowDef, colDef);
      const cellRef = `${col}${rowNum}`;
      const isBooleanCell = cell && String(cell.value_type || '').toUpperCase() === 'BOOLEAN';
      const isDropdownCell = cell && String(cell.value_type || '').toUpperCase() === 'JSON' && isJsonDropdownCell(cell);
      let tdClass = '', renderedValue = escapeHtml(value);
      if (isBooleanCell) { tdClass = 'bool-cell'; renderedValue = `<span class="bool-checkbox${value === true ? ' checked' : ''}"></span>`; }
      else if (isDropdownCell) {
        tdClass = 'json-dropdown-cell dropdown-cell';
        const options = getJsonDropdownOptions(cell); const selected = getJsonDropdownSelected(cell);
        renderedValue = `<select class="cell-dropdown" data-dropdown-cell="${escapeHtml(cellRef)}" ${editable ? '' : 'disabled'}>` + options.map(option => `<option value="${escapeHtml(option)}"${option === selected ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('') + `</select>`;
      }
      html += `<td${tdClass ? ` class="${tdClass}"` : ''} data-cell="${escapeHtml(cellRef)}" data-value="${escapeHtml(String(value))}" data-editable="${editable ? 'true' : 'false'}"${noticeAttr}${styleParts.filter(Boolean).join(';') ? ` style="${escapeHtml(styleParts.filter(Boolean).join(';'))}"` : ''}>${renderedValue}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  dom.sheetWrapEl.innerHTML = html;
  dom.sheetWrapEl.querySelectorAll('td[data-cell]').forEach(td => {
    td.addEventListener('click', () => selectCell(td));
    td.addEventListener('dblclick', () => activateCellEditor(td));
    td.addEventListener('mouseenter', event => { const notice = td.dataset.notice || ''; if (notice) showCustomTooltip(notice, event); });
    td.addEventListener('mousemove', event => { const notice = td.dataset.notice || ''; if (notice) positionCustomTooltip(event); });
    td.addEventListener('mouseleave', () => hideCustomTooltip());
  });
  dom.sheetWrapEl.querySelectorAll('select.cell-dropdown[data-dropdown-cell]').forEach(select => {
    select.addEventListener('click', event => { event.stopPropagation(); const td = select.closest('td[data-cell]'); if (td) selectCell(td); });
    select.addEventListener('change', async () => { const td = select.closest('td[data-cell]'); if (td) await updateJsonDropdownCell(td, select.value); });
  });
  dom.sheetWrapEl.querySelectorAll('th.col-header[data-col]').forEach(header => {
    header.addEventListener('click', event => {
      if (event.target.closest('.col-resizer')) return;
      const col = header.dataset.col; if (!col || isFrozenColumn(sheet.colDefs.get(col) || {})) return;
      setSheetSortState(sheetName, col, getNextSortDirection(sheetName, col)); renderSheet(sheetName);
    });
    header.addEventListener('contextmenu', event => {
      if (event.target.closest('.col-resizer')) return;
      event.preventDefault(); event.stopPropagation();
      const col = header.dataset.col; if (!col || isFrozenColumn(sheet.colDefs.get(col) || {})) return;
      openFilterMenu(sheetName, col, event.clientX, event.clientY);
    });
  });
  dom.sheetWrapEl.querySelectorAll('.col-resizer[data-resize-col]').forEach(resizer => resizer.addEventListener('mousedown', event => { const col = resizer.dataset.resizeCol; const th = resizer.closest('th[data-col]'); if (col && th) startColumnResize(event, col, th); }));
  dom.sheetWrapEl.querySelectorAll('.row-resizer[data-resize-row]').forEach(resizer => resizer.addEventListener('mousedown', event => { const rowNum = Number(resizer.dataset.resizeRow); const rowHeader = resizer.closest('th[data-row-header]'); if (rowNum && rowHeader) startRowResize(event, rowNum, rowHeader); }));
}
