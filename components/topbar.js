import { dom } from '../state.js';
import { loadDatabaseFromArrayBuffer, saveDatabaseToFile, setStatus } from '../db.js';
import { isElectron } from '../utils.js';
import { I18N } from '../i18n.js';
import { exportCurrentSheetAsHTML } from '../logic/export.js';

export function initTopbar() {
  if (dom.dbFileInput) {
    dom.dbFileInput.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      setStatus(I18N.LOADING_FILE(file.name));
      const buffer = await file.arrayBuffer();
      await loadDatabaseFromArrayBuffer(buffer, file.name, { name: file.name });
    });
  }
  if (isElectron() && dom.openDbLabel) {
    dom.openDbLabel.addEventListener('click', async event => {
      event.preventDefault();
      try {
        const result = await window.sqlspreadFS.openDatabase();
        if (!result || result.canceled) return;
        const bytes = new Uint8Array(result.data);
        await loadDatabaseFromArrayBuffer(bytes.buffer, result.name, { path: result.path, name: result.name });
      } catch (error) {
        console.error(error);
        setStatus(error.message || String(error), true);
      }
    });
  }
  if (dom.saveBtn) dom.saveBtn.addEventListener('click', async () => { await saveDatabaseToFile(); });
  if (dom.exportHtmlBtn) dom.exportHtmlBtn.addEventListener('click', () => { exportCurrentSheetAsHTML(); });
}
