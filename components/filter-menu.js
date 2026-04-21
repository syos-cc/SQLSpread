import { dom } from '../state.js';
import { hideFilterMenu } from '../logic/filtering.js';

export function initFilterMenuGlobalEvents() {
  document.addEventListener('click', event => {
    if (!dom.filterMenu || dom.filterMenu.style.display !== 'block') return;
    if (dom.filterMenu.contains(event.target)) return;
    hideFilterMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideFilterMenu();
  });
}
