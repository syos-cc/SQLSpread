import { DEFAULTS, state } from '../state.js';
import { setStatus } from '../db.js';
import { I18N } from '../i18n.js';
import { getVisibleRowNumbersForCurrentSheet } from '../render/render-sheet.js';
import {
  buildCellStyle,
  buildStyleString,
  cellDisplayValue,
  cssUserSelect,
  escapeHtml,
  getFrozenColumns,
  getFrozenRowNumbers,
  getOrderedColumns,
  getJsonDropdownSelected,
  isBooleanTrue,
  isFrozenColumn,
  isFrozenRow,
  styleValue,
  withDefault
} from '../utils.js';

function downloadTextFile(filename, content, mimeType = 'text/html;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildExportHeaderCellStyle(colDef = {}) {
  return buildStyleString({
    width: styleValue(withDefault(colDef.width, DEFAULTS.COLUMN.width)),
    minWidth: styleValue(withDefault(colDef.width, DEFAULTS.COLUMN.width)),
    maxWidth: styleValue(withDefault(colDef.width, DEFAULTS.COLUMN.width)),
    backgroundColor: styleValue(withDefault(colDef.background_color, DEFAULTS.COLUMN.background_color)),
    visibility: styleValue(withDefault(colDef.visibility, DEFAULTS.COLUMN.visibility)),
    userSelect: styleValue(cssUserSelect(withDefault(colDef.user_select, DEFAULTS.COLUMN.user_select)))
  });
}

function buildExportRowHeaderStyle(rowDef = {}) {
  return buildStyleString({
    height: styleValue(withDefault(rowDef.height, DEFAULTS.ROW.height)),
    minHeight: styleValue(withDefault(rowDef.height, DEFAULTS.ROW.height)),
    maxHeight: styleValue(withDefault(rowDef.height, DEFAULTS.ROW.height)),
    backgroundColor: styleValue(withDefault(rowDef.background_color, DEFAULTS.ROW.background_color)),
    visibility: styleValue(withDefault(rowDef.visibility, DEFAULTS.ROW.visibility)),
    userSelect: styleValue(cssUserSelect(withDefault(rowDef.user_select, DEFAULTS.ROW.user_select)))
  });
}

function renderExportCellValue(cell) {
  if (!cell) return '';
  const valueType = String(cell.value_type || 'TEXT').toUpperCase();
  if (valueType === 'BOOLEAN') {
    return `<span class="bool-checkbox${isBooleanTrue(cell.value) ? ' checked' : ''}"></span>`;
  }
  if (valueType === 'JSON') {
    return escapeHtml(getJsonDropdownSelected(cell) || String(cellDisplayValue(cell) ?? ''));
  }
  return escapeHtml(String(cellDisplayValue(cell) ?? ''));
}

function buildExportHtml(sheetName, sheet) {
  const cols = getOrderedColumns(sheet);
  const rowNums = getVisibleRowNumbersForCurrentSheet(sheet, sheetName);
  const frozenCols = new Set(getFrozenColumns(sheet));
  const frozenRows = new Set(getFrozenRowNumbers(sheet));

  const colgroup = cols.map(col => {
    const colDef = sheet.colDefs.get(col) || {};
    const width = withDefault(colDef.width, DEFAULTS.COLUMN.width);
    return `<col style="width:${escapeHtml(width)};min-width:${escapeHtml(width)};max-width:${escapeHtml(width)};">`;
  }).join('');

  let tableHtml = `<table class="sheet"><colgroup><col style="width:48px;min-width:48px;max-width:48px;">${colgroup}</colgroup><thead><tr><th class="corner-cell"></th>`;

  for (const col of cols) {
    const colDef = sheet.colDefs.get(col) || {};
    const classes = ['col-header'];
    if (frozenCols.has(col)) classes.push('frozen-col');
    const style = buildExportHeaderCellStyle(colDef);
    tableHtml += `<th class="${classes.join(' ')}"${style ? ` style="${escapeHtml(style)}"` : ''}><div class="col-header-inner"><span class="col-header-label">${escapeHtml(col)}</span></div></th>`;
  }

  tableHtml += '</tr></thead><tbody>';

  for (const rowNum of rowNums) {
    const rowDef = sheet.rowDefs.get(rowNum) || {};
    const rowHeaderClasses = ['row-header'];
    if (frozenRows.has(rowNum)) rowHeaderClasses.push('frozen-row');
    const rowHeaderStyle = buildExportRowHeaderStyle(rowDef);
    tableHtml += `<tr data-row="${rowNum}"><th class="${rowHeaderClasses.join(' ')}"${rowHeaderStyle ? ` style="${escapeHtml(rowHeaderStyle)}"` : ''}><div class="row-header-inner"><span>${escapeHtml(rowNum)}</span></div></th>`;

    for (const col of cols) {
      const cell = sheet.cells.get(`${col}|${rowNum}`) || null;
      const colDef = sheet.colDefs.get(col) || {};
      const tdClasses = [];
      if (frozenCols.has(col)) tdClasses.push('frozen-col');
      if (frozenRows.has(rowNum)) tdClasses.push('frozen-row');
      if (cell && String(cell.value_type || '').toUpperCase() === 'BOOLEAN') tdClasses.push('bool-cell');
      const style = buildCellStyle(cell, rowDef, colDef);
      tableHtml += `<td${tdClasses.length ? ` class="${tdClasses.join(' ')}"` : ''}${style ? ` style="${escapeHtml(style)}"` : ''}>${renderExportCellValue(cell)}</td>`;
    }

    tableHtml += '</tr>';
  }

  tableHtml += '</tbody></table>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(sheetName)}</title>
  <style>
    body {
      margin: 16px;
      font-family: Calibri, "Segoe UI", Arial, sans-serif;
      background: #f5f5f5;
      color: #000;
    }
    h1 {
      margin: 0 0 12px 0;
      font-size: 20px;
      font-weight: 600;
    }
    .sheet-container {
      display: inline-block;
      border: 1px solid #d0d0d0;
      background: #fff;
      overflow: auto;
      max-width: 100%;
    }
    table.sheet {
      border-collapse: collapse;
      table-layout: fixed;
      width: max-content;
      min-width: 0;
      background: #fff;
    }
    table.sheet th,
    table.sheet td {
      border: 1px solid #d9d9d9;
      height: 24px;
      min-height: 24px;
      max-height: 24px;
      padding: 2px 6px;
      font: 14px Calibri, "Segoe UI", Arial, sans-serif;
      color: #000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
      background: #fff;
    }
    .corner-cell,
    .col-header,
    .row-header {
      background: #f3f3f3;
      text-align: center;
      font-weight: 400;
    }
    .row-header,
    .corner-cell {
      width: 48px;
      min-width: 48px;
      max-width: 48px;
    }
    .col-header-inner,
    .row-header-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 24px;
    }
    .bool-cell {
      text-align: center;
      padding: 0 !important;
    }
    .bool-checkbox {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 1px solid #8a8a8a;
      border-radius: 3px;
      background: #ffffff;
      position: relative;
      vertical-align: middle;
      margin: 0;
      box-sizing: border-box;
    }
    .bool-checkbox.checked {
      background: #217346;
      border-color: #217346;
    }
    .bool-checkbox.checked::after {
      content: "";
      position: absolute;
      left: 4px;
      top: 1px;
      width: 4px;
      height: 8px;
      border: solid #ffffff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(sheetName)}</h1>
  <div class="sheet-container">${tableHtml}</div>
</body>
</html>`;
}

export function exportCurrentSheetAsHTML() {
  const sheetName = state.currentSheet;
  if (!sheetName) {
    setStatus(I18N.SHEET_NOT_FOUND, true);
    return;
  }
  const sheet = state.workbook.get(sheetName);
  if (!sheet) {
    setStatus(I18N.SHEET_NOT_FOUND, true);
    return;
  }
  const html = buildExportHtml(sheetName, sheet);
  const filenameBase = String(sheetName || 'sheet').replace(/[\\/:*?"<>|]+/g, '_');
  downloadTextFile(`${filenameBase}.html`, html);
  setStatus(I18N.EXPORT_HTML_SUCCESS(filenameBase));
}
