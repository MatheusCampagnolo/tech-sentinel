const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onPythonData: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('from-python', subscription);
  },
  
  killProcess: (pid) => ipcRenderer.send('kill-process', pid) 
});