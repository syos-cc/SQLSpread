import { dom } from '../state.js';
import { saveFormulaBoxToSelectedCell } from '../logic/editing.js';

export function initFormulaBar() {
  if (!dom.formulaBox) return;
  dom.formulaBox.addEventListener('keydown', async event => {
    if (event.key === 'Enter') { event.preventDefault(); await saveFormulaBoxToSelectedCell(); }
  });
  dom.formulaBox.addEventListener('blur', async () => {
    if (document.activeElement !== dom.formulaBox) await saveFormulaBoxToSelectedCell();
  });
}
