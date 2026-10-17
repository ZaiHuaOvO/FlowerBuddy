import type { PetApi } from '../shared/api'

declare global {
  interface Window {
    petApi: PetApi
  }
}

export {}
