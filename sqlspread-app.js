import { dom } from './state.js';
import { saveDatabaseToFile } from './db.js';
import { clearSelectedCellValue, moveSelectionRelative, redoLastChange, undoLastChange } from './logic/editing.js';
import { hideCustomTooltip, initTooltipGlobalEvents } from './components/tooltip.js';
import { initTopbar } from './components/topbar.js';
import { initFormulaBar } from './components/formula-bar.js';
import { initTabs } from './components/tabs.js';
import { initFilterMenuGlobalEvents } from './components/filter-menu.js';

initTopbar();
initFormulaBar();
initTabs();
initTooltipGlobalEvents();
initFilterMenuGlobalEvents();

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') hideCustomTooltip();
});

window.addEventListener('keydown', async event => {
  const activeElement = document.activeElement;
  const activeTag = activeElement?.tagName?.toLowerCase();
  const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeElement?.isContentEditable;
  const cellEditorActive = !!dom.sheetWrapEl.querySelector('td[data-editing="true"] .cell-editor');
  const mod = event.ctrlKey || event.metaKey;
  const key = String(event.key || '').toLowerCase();
  if (mod && key === 's') { event.preventDefault(); event.stopPropagation(); await saveDatabaseToFile(); return; }
  if (mod && key === 'z' && !event.shiftKey) { event.preventDefault(); await undoLastChange(); return; }
  if ((mod && key === 'y') || (mod && event.shiftKey && key === 'z')) { event.preventDefault(); await redoLastChange(); return; }
  if (cellEditorActive) return;
  if ((key === 'delete' || key === 'backspace') && !isTyping) { event.preventDefault(); await clearSelectedCellValue(); return; }
  if (isTyping) return;
  if (key === 'arrowleft') { event.preventDefault(); moveSelectionRelative(0, -1); return; }
  if (key === 'arrowright') { event.preventDefault(); moveSelectionRelative(0, 1); return; }
  if (key === 'arrowup') { event.preventDefault(); moveSelectionRelative(-1, 0); return; }
  if (key === 'arrowdown') { event.preventDefault(); moveSelectionRelative(1, 0); return; }
  if (key === 'tab') { event.preventDefault(); moveSelectionRelative(0, event.shiftKey ? -1 : 1); return; }
  if (key === 'enter') { event.preventDefault(); moveSelectionRelative(event.shiftKey ? -1 : 1, 0); }
});
