import type { BubbleApi, MenuApi, PetApi, SettingsApi } from '../shared/api'

declare global {
  interface Window {
    petApi?: PetApi
    menuApi?: MenuApi
    bubbleApi?: BubbleApi
    settingsApi?: SettingsApi
  }
}

export {}
