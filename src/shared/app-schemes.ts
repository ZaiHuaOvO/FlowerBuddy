import { MEMO_IMAGE_SCHEME, PET_ASSET_SCHEME } from './api'

export interface AppSchemePrivileges {
  scheme: string
  privileges: {
    standard: boolean
    secure: boolean
    supportFetchAPI: boolean
    stream: boolean
  }
}

/**
 * Custom schemes are declared together so Electron's single
 * registerSchemesAsPrivileged() call covers every app resource.
 */
export const APP_SCHEME_PRIVILEGES: readonly AppSchemePrivileges[] = [
  {
    scheme: PET_ASSET_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  },
  {
    scheme: MEMO_IMAGE_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
]
