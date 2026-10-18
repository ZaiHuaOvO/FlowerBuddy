import { protocol } from 'electron'
import { APP_SCHEME_PRIVILEGES } from '../../shared/app-schemes'

/** Must run before app ready. */
export function registerAppSchemes(): void {
  protocol.registerSchemesAsPrivileged(
    APP_SCHEME_PRIVILEGES.map((entry) => ({
      scheme: entry.scheme,
      privileges: { ...entry.privileges }
    }))
  )
}
