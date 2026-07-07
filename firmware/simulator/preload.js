const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  publishEvent: (ev) => ipcRenderer.send('simulator:publishEvent', ev),
  onHeroEvent: (cb) => ipcRenderer.on('hero:event', (e, data) => cb(data)),
  loadAnimations: () => ipcRenderer.invoke('simulator:loadAnimations'),
  loadExperiences: () => ipcRenderer.invoke('simulator:loadExperiences')
})
