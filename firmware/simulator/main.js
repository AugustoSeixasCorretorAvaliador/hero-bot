const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const WebSocket = require('ws')
const fs = require('fs').promises

// WebSocket server port and host for HeroOS bridge (bind to localhost only)
const WS_PORT = 8765
const WS_HOST = '127.0.0.1'

// Create WebSocket server bound to localhost only
const wss = new WebSocket.Server({ port: WS_PORT, host: WS_HOST })

wss.on('connection', (ws) => {
  console.log('WebSocket client connected')
  ws.on('message', (message) => {
    try {
      const obj = JSON.parse(message)
      // forward WS events to renderer windows
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('hero:event', obj))
    } catch (e) {
      console.error('Invalid WS message', e)
    }
  })
  ws.send(JSON.stringify({ type: 'SIMULATOR_CONNECTED', source: 'simulator' }))
})

// IPC: provide animations list and contents to renderer
const ASSETS_DIR = path.join(__dirname, 'assets', 'animations')
ipcMain.handle('simulator:loadAnimations', async () => {
  try {
    const files = await fs.readdir(ASSETS_DIR)
    const result = []
    for (const f of files) {
      if (!f.toLowerCase().endsWith('.json')) continue
      const p = path.join(ASSETS_DIR, f)
      const txt = await fs.readFile(p, 'utf8')
      try { result.push(JSON.parse(txt)) } catch (e) { console.warn('Invalid animation file', f) }
    }
    return result
  } catch (e) {
    console.error('Failed to load animations', e)
    return []
  }
})

function createWindow () {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// Simple IPC bridge: main can emit simulated HeroEvents to renderer
ipcMain.on('simulator:publishEvent', (event, heroEvent) => {
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('hero:event', heroEvent))
  // forward published events to any connected WS clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(heroEvent))
    }
  })
})

console.log(`Simulator WebSocket bridge listening on ws://${WS_HOST}:${WS_PORT} (bound to localhost only)`)
