import { state, dom } from '../state.js';
import { buildTabStyle } from '../utils.js';
import { renderSheet } from './render-sheet.js';

export function renderTabs() {
  if (!dom.tabsEl) return;
  dom.tabsEl.innerHTML = '';
  const names = [...state.workbook.keys()];
  if (!names.length) {
    const msg = document.createElement('div'); msg.className = 'muted'; msg.textContent = 'Keine Blätter gefunden'; dom.tabsEl.appendChild(msg); return;
  }
  for (const name of names) {
    const sheet = state.workbook.get(name);
    const tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'tab' + (name === state.currentSheet ? ' active' : ''); tab.textContent = name;
    const style = buildTabStyle(sheet?.tabDef || {});
    if (style) tab.setAttribute('style', style);
    tab.addEventListener('click', () => { state.currentSheet = name; renderTabs(); renderSheet(name); });
    dom.tabsEl.appendChild(tab);
  }
}
