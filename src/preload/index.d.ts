import type { BubbleApi, MemoCardApi, MenuApi, PetApi, SettingsApi } from '../shared/api'

declare global {
  interface Window {
    petApi?: PetApi
    menuApi?: MenuApi
    bubbleApi?: BubbleApi
    settingsApi?: SettingsApi
    memoCardApi?: MemoCardApi
  }
}

export {}
