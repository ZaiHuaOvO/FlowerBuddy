import { contextBridge, ipcRenderer } from 'electron'
import { createPetApi } from './api'

contextBridge.exposeInMainWorld('petApi', createPetApi(ipcRenderer))
