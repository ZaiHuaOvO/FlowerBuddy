import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: vi.fn()
  }
}))

import { protocol } from 'electron'
import { MEMO_IMAGE_SCHEME, PET_ASSET_SCHEME } from '../../src/shared/api'
import { APP_SCHEME_PRIVILEGES } from '../../src/shared/app-schemes'
import { registerAppSchemes } from '../../src/main/protocol/app-schemes'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('app scheme privileges', () => {
  it('declares both resource schemes in one shared list', () => {
    expect(APP_SCHEME_PRIVILEGES.map((entry) => entry.scheme)).toEqual([
      PET_ASSET_SCHEME,
      MEMO_IMAGE_SCHEME
    ])
  })

  it('marks every app scheme as standard, secure and fetchable', () => {
    for (const entry of APP_SCHEME_PRIVILEGES) {
      expect(entry.privileges).toEqual({
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      })
    }
  })

  it('does not declare duplicate schemes', () => {
    const schemes = APP_SCHEME_PRIVILEGES.map((entry) => entry.scheme)
    expect(new Set(schemes).size).toBe(schemes.length)
  })

  it('registers every scheme through a single privileged call', () => {
    registerAppSchemes()

    const register = vi.mocked(protocol.registerSchemesAsPrivileged)
    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith(
      APP_SCHEME_PRIVILEGES.map((entry) => ({
        scheme: entry.scheme,
        privileges: { ...entry.privileges }
      }))
    )
  })
})
