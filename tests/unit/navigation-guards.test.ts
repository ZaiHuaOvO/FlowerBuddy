import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import {
  installNavigationGuards,
  isAllowedAppNavigation
} from '../../src/main/security/navigation-guards'

const RENDERER_INDEX = '/app/out/renderer/index.html'
const PRODUCTION_OPTIONS = {
  devServerUrl: undefined,
  rendererIndexPath: RENDERER_INDEX
}
const PRODUCTION_URL = pathToFileURL(RENDERER_INDEX).toString()

describe('navigation guards', () => {
  it('allows the production renderer page with query and hash', () => {
    expect(isAllowedAppNavigation(`${PRODUCTION_URL}?view=settings`, PRODUCTION_OPTIONS)).toBe(true)
    expect(isAllowedAppNavigation(`${PRODUCTION_URL}#section`, PRODUCTION_OPTIONS)).toBe(true)
  })

  it('blocks other files, remote pages and non-http schemes in production', () => {
    expect(isAllowedAppNavigation('file:///etc/passwd', PRODUCTION_OPTIONS)).toBe(false)
    expect(isAllowedAppNavigation('https://example.com', PRODUCTION_OPTIONS)).toBe(false)
    expect(isAllowedAppNavigation('javascript:alert(1)', PRODUCTION_OPTIONS)).toBe(false)
    expect(isAllowedAppNavigation('data:text/html,hello', PRODUCTION_OPTIONS)).toBe(false)
    expect(isAllowedAppNavigation('flowerbuddy-pet://asset/default', PRODUCTION_OPTIONS)).toBe(
      false
    )
  })

  it('allows only the dev server origin and root page in development', () => {
    const options = {
      devServerUrl: 'http://localhost:5173',
      rendererIndexPath: RENDERER_INDEX
    }
    expect(isAllowedAppNavigation('http://localhost:5173/?view=pet', options)).toBe(true)
    expect(isAllowedAppNavigation('http://localhost:5173/other', options)).toBe(false)
    expect(isAllowedAppNavigation('https://localhost:5173/', options)).toBe(false)
    expect(isAllowedAppNavigation('http://127.0.0.1:5173/', options)).toBe(false)
  })

  it('installs a deny-all window-open handler and blocks external navigation', () => {
    const listeners = new Map<string, (details: Record<string, unknown>) => void>()
    const setWindowOpenHandler = vi.fn()
    const contents = {
      setWindowOpenHandler,
      on: (event: string, listener: (details: Record<string, unknown>) => void) => {
        listeners.set(event, listener)
      }
    } as unknown as WebContents

    installNavigationGuards(contents, PRODUCTION_OPTIONS)

    const openHandler = setWindowOpenHandler.mock.calls[0]?.[0] as (details: {
      url: string
    }) => unknown
    expect(openHandler({ url: 'https://example.com' })).toEqual({ action: 'deny' })

    const blocked = { url: 'https://example.com', isMainFrame: true, preventDefault: vi.fn() }
    listeners.get('will-navigate')?.(blocked)
    listeners.get('will-redirect')?.(blocked)
    expect(blocked.preventDefault).toHaveBeenCalledTimes(2)

    const allowed = { url: PRODUCTION_URL, isMainFrame: true, preventDefault: vi.fn() }
    listeners.get('will-navigate')?.(allowed)
    listeners.get('will-redirect')?.(allowed)
    expect(allowed.preventDefault).not.toHaveBeenCalled()
  })
})
