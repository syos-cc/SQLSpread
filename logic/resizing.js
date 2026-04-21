import { state } from '../state.js';
import { reloadWorkbookFromDb, setStatus } from '../db.js';
import { I18N } from '../i18n.js';

export function setColumnWidthInDb(sheetName, col, widthPx) {
  if (!state.db) throw new Error(I18N.NO_DATABASE_LOADED);
  const safeWidth = Math.max(30, Math.round(widthPx)) + 'px';
  state.db.run(`UPDATE parts SET width = ? WHERE tab = ? AND UPPER(part) = ?`, [safeWidth, sheetName, col]);
  return safeWidth;
}

export function setRowHeightInDb(sheetName, rowNum, heightPx) {
  if (!state.db) throw new Error(I18N.NO_DATABASE_LOADED);
  const safeHeight = Math.max(20, Math.round(heightPx)) + 'px';
  state.db.run(`UPDATE lines SET height = ? WHERE tab = ? AND line = ?`, [safeHeight, sheetName, rowNum]);
  return safeHeight;
}

export function startColumnResize(event, col, th) {
  event.preventDefault(); event.stopPropagation();
  if (!state.currentSheet) return;
  const startX = event.clientX; const startWidth = th.getBoundingClientRect().width;
  document.body.classList.add('col-resizing');
  function onMouseMove(moveEvent) {
    const widthStr = `${Math.round(Math.max(30, startWidth + (moveEvent.clientX - startX)))}px`;
    th.style.width = widthStr; th.style.minWidth = widthStr; th.style.maxWidth = widthStr;
    const colIndex = [...th.parentElement.children].indexOf(th);
    if (colIndex > 0) {
      const colEl = th.closest('table').querySelectorAll('colgroup col')[colIndex];
      if (colEl) { colEl.style.width = widthStr; colEl.style.minWidth = widthStr; colEl.style.maxWidth = widthStr; }
    }
  }
  async function onMouseUp(upEvent) {
    document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
    document.body.classList.remove('col-resizing');
    try { setColumnWidthInDb(state.currentSheet, col, Math.max(30, startWidth + (upEvent.clientX - startX))); await reloadWorkbookFromDb(I18N.STATUS_CHANGED(state.currentDbName)); }
    catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
  }
  document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
}

export function startRowResize(event, rowNum, rowHeader) {
  event.preventDefault(); event.stopPropagation();
  if (!state.currentSheet) return;
  const startY = event.clientY; const tr = rowHeader.closest('tr'); const startHeight = tr.getBoundingClientRect().height;
  document.body.classList.add('row-resizing');
  function onMouseMove(moveEvent) {
    const heightStr = `${Math.round(Math.max(20, startHeight + (moveEvent.clientY - startY)))}px`;
    tr.style.height = heightStr; tr.style.minHeight = heightStr; tr.style.maxHeight = heightStr;
    tr.querySelectorAll('th,td').forEach(cell => { cell.style.height = heightStr; cell.style.minHeight = heightStr; cell.style.maxHeight = heightStr; });
  }
  async function onMouseUp(upEvent) {
    document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
    document.body.classList.remove('row-resizing');
    try { setRowHeightInDb(state.currentSheet, rowNum, Math.max(20, startHeight + (upEvent.clientY - startY))); await reloadWorkbookFromDb(I18N.STATUS_CHANGED(state.currentDbName)); }
    catch (error) { console.error(error); setStatus(error.message || String(error), true); await reloadWorkbookFromDb(); }
  }
  document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
}
