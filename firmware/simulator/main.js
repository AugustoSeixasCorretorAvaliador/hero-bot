const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs').promises
const {
  DEFAULT_WS_HOST,
  DEFAULT_WS_PORT,
  createHeroWebSocketServer
} = require('./hero-ws-server')

// Listen on the LAN. The Windows firewall must restrict this port to private
// networks; no firewall rule is created automatically.
const configuredPort = Number.parseInt(process.env.HERO_WS_PORT || '', 10)
const WS_PORT = Number.isInteger(configuredPort) ? configuredPort : DEFAULT_WS_PORT
const WS_HOST = DEFAULT_WS_HOST
const WS_TOKEN = process.env.HERO_WS_TOKEN || ''

const heroWsServer = createHeroWebSocketServer({
  host: WS_HOST,
  port: WS_PORT,
  token: WS_TOKEN,
  onEvent: (heroEvent) => {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('hero:event', heroEvent))
  }
})

// IPC: provide animations list and contents to renderer
const ASSETS_DIR = path.join(__dirname, 'assets', 'animations')
const EXPERIENCES_DIR = path.join(__dirname, 'assets', 'experiences')
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

ipcMain.handle('simulator:loadExperiences', async () => {
  try {
    const files = await fs.readdir(EXPERIENCES_DIR)
    const result = []
    for (const f of files) {
      if (!f.toLowerCase().endsWith('.json')) continue
      const p = path.join(EXPERIENCES_DIR, f)
      const txt = await fs.readFile(p, 'utf8')
      try { result.push(JSON.parse(txt)) } catch (e) { console.warn('Invalid experience file', f) }
    }
    return result
  } catch (e) {
    console.error('Failed to load experiences', e)
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
  const result = heroWsServer.publishFromRenderer(heroEvent)
  if (!result.ok) console.warn('Simulator event rejected:', result.reason)
})

heroWsServer.ready
  .then(() => console.log(`Simulator WebSocket bridge listening on ws://${WS_HOST}:${WS_PORT} (LAN enabled, token ${WS_TOKEN ? 'enabled' : 'disabled'})`))
  .catch(error => console.error('Failed to start WebSocket bridge:', error))

app.on('before-quit', () => {
  heroWsServer.close().catch(() => {})
})
