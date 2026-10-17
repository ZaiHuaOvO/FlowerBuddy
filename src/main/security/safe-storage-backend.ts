import { safeStorage } from 'electron'
import type { SafeStorageBackend } from './secret-store'

/** Production adapter; safeStorage is only ever used from the main process. */
export const electronSafeStorageBackend: SafeStorageBackend = {
  async isAvailable() {
    try {
      return await safeStorage.isAsyncEncryptionAvailable()
    } catch {
      return false
    }
  },
  encrypt(plainText) {
    return safeStorage.encryptStringAsync(plainText)
  },
  async decrypt(encrypted) {
    const result = await safeStorage.decryptStringAsync(encrypted)
    return { result: result.result, shouldReEncrypt: result.shouldReEncrypt }
  }
}
