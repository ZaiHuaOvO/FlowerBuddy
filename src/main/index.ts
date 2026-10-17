import { join } from 'node:path'
import { app, BrowserWindow, session } from 'electron'
import { registerIpcHandlers } from './ipc/register-handlers'
import { createSenderValidator } from './ipc/validate-sender'
import { createSecureWebPreferences } from './security/web-preferences'

const APP_USER_MODEL_ID = 'com.flowerbuddy.app'
const RENDERER_INDEX_PATH = join(__dirname, '../renderer/index.html')
const PRELOAD_PATH = join(__dirname, '../preload/index.js')
const devServerUrl = process.env['ELECTRON_RENDERER_URL']

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 660,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1419',
    webPreferences: createSecureWebPreferences(PRELOAD_PATH)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!devServerUrl || new URL(url).origin !== new URL(devServerUrl).origin) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(RENDERER_INDEX_PATH)
  }

  return mainWindow
}

app.whenReady().then(() => {
  app.setAppUserModelId(APP_USER_MODEL_ID)

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)

  registerIpcHandlers(
    createSenderValidator({
      devServerUrl,
      rendererIndexPath: RENDERER_INDEX_PATH
    })
  )

  createMainWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
