import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { createBridge } from './api'
import type { IpcBridge } from './api'

const bridge: IpcBridge = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown): void => {
      listener(payload)
    }
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
}

const viewArgument = process.argv.find((argument) => argument.startsWith('--fb-view='))
const view = viewArgument ? viewArgument.slice('--fb-view='.length) : 'pet'

const exposed = createBridge(view, bridge)
if (!exposed) {
  throw new Error(`Unknown renderer view: ${view}`)
}

contextBridge.exposeInMainWorld(exposed.key, exposed.value)
