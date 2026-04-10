const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  name: 'SQLSpread'
});

contextBridge.exposeInMainWorld('sqlspreadFS', {
  openDatabase: async () => {
    const result = await ipcRenderer.invoke('sqlspread:open-database');
    if (!result) return { canceled: true };
    return result;
  },

  saveDatabase: async (payload) => {
    const result = await ipcRenderer.invoke('sqlspread:save-database', payload);
    if (!result) return { canceled: true };
    return result;
  }
});