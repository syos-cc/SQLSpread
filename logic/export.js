import { state } from '../state.js';
import { setStatus } from '../db.js';
import { I18N } from '../i18n.js';
import { cellDisplayValue, escapeHtml, getOrderedColumns } from '../utils.js';
import { getVisibleRowNumbersForCurrentSheet } from '../render/render-sheet.js';

function buildSheetHtmlDocument(sheetName, sheet, cols, rowNums) {
  const tableHead = cols.map(col => `<th>${escapeHtml(col)}</th>`).join('');
  const tableBody = rowNums.map(rowNum => {
    const cells = cols.map(col => {
      const cell = sheet.cells.get(`${col}|${rowNum}`) || null;
      const value = cellDisplayValue(cell);
      const rendered = value === true ? 'TRUE' : value === false ? 'FALSE' : String(value ?? '');
      return `<td>${escapeHtml(rendered)}</td>`;
    }).join('');
    return `<tr><th>${escapeHtml(rowNum)}</th>${cells}</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(sheetName)}</title>
  <style>
    body { font-family: Calibri, "Segoe UI", Arial, sans-serif; margin: 24px; color: #222; }
    h1 { margin: 0 0 16px 0; font-size: 22px; }
    table { border-collapse: collapse; width: max-content; max-width: 100%; background: #fff; }
    th, td { border: 1px solid #d9d9d9; padding: 4px 8px; font-size: 14px; white-space: nowrap; }
    thead th, tbody th { background: #f3f3f3; font-weight: 600; }
    tbody th { text-align: right; }
  </style>
</head>
<body>
  <h1>${escapeHtml(sheetName)}</h1>
  <table>
    <thead>
      <tr>
        <th>#</th>
        ${tableHead}
      </tr>
    </thead>
    <tbody>
      ${tableBody}
    </tbody>
  </table>
</body>
</html>`;
}

export async function exportCurrentSheetAsHtml() {
  try {
    if (!state.workbook || !state.workbook.size || !state.currentSheet) {
      throw new Error(I18N.EXPORT_NO_SHEET);
    }

    const sheetName = state.currentSheet;
    const sheet = state.workbook.get(sheetName);
    if (!sheet) {
      throw new Error(I18N.EXPORT_NO_SHEET);
    }

    const cols = getOrderedColumns(sheet);
    const rowNums = getVisibleRowNumbersForCurrentSheet(sheet, sheetName);
    const html = buildSheetHtmlDocument(sheetName, sheet, cols, rowNums);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `${sheetName.replace(/[\\/:*?"<>|]+/g, '_') || 'sheet'}.html`;

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatus(I18N.EXPORT_SUCCESS(fileName));
  } catch (error) {
    console.error(error);
    setStatus(error.message || String(error), true);
  }
}
