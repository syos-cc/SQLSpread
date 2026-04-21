import { dom } from '../state.js';
import { normalizeNoticeValue } from '../utils.js';

export function showCustomTooltip(text, mouseEvent) {
  if (!dom.customTooltip) return;
  const content = normalizeNoticeValue(text);
  if (!content) return hideCustomTooltip();
  dom.customTooltip.textContent = content;
  dom.customTooltip.style.display = 'block';
  positionCustomTooltip(mouseEvent);
}

export function positionCustomTooltip(mouseEvent) {
  if (!dom.customTooltip || dom.customTooltip.style.display === 'none') return;
  const offset = 14;
  const rect = dom.customTooltip.getBoundingClientRect();
  let left = mouseEvent.clientX + offset;
  let top = mouseEvent.clientY + offset;
  if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
  if (top + rect.height > window.innerHeight - 8) top = mouseEvent.clientY - rect.height - offset;
  if (left < 8) left = 8; if (top < 8) top = 8;
  dom.customTooltip.style.left = `${left}px`; dom.customTooltip.style.top = `${top}px`;
}

export function hideCustomTooltip() {
  if (!dom.customTooltip) return;
  dom.customTooltip.style.display = 'none';
  dom.customTooltip.textContent = '';
}

export function initTooltipGlobalEvents() {
  document.addEventListener('scroll', () => hideCustomTooltip(), true);
  document.addEventListener('mousedown', () => hideCustomTooltip());
}
