import { describe, expect, it } from 'vitest'
import { createSecureWebPreferences } from '../../src/main/security/web-preferences'

describe('secure web preferences', () => {
  it('disables Node.js access in every renderer scope', () => {
    const prefs = createSecureWebPreferences('preload.js')

    expect(prefs.preload).toBe('preload.js')
    expect(prefs.nodeIntegration).toBe(false)
    expect(prefs.nodeIntegrationInWorker).toBe(false)
    expect(prefs.nodeIntegrationInSubFrames).toBe(false)
  })

  it('keeps isolation, sandbox and web security enabled', () => {
    const prefs = createSecureWebPreferences('preload.js')

    expect(prefs.contextIsolation).toBe(true)
    expect(prefs.sandbox).toBe(true)
    expect(prefs.webSecurity).toBe(true)
    expect(prefs.allowRunningInsecureContent).toBe(false)
    expect(prefs.experimentalFeatures).toBe(false)
  })

  it('disables webview and drag-and-drop navigation', () => {
    const prefs = createSecureWebPreferences('preload.js')

    expect(prefs.webviewTag).toBe(false)
    expect(prefs.navigateOnDragDrop).toBe(false)
  })
})
