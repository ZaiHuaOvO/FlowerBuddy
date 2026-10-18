export interface WebsiteFormState {
  name: string
  url: string
  timeoutMs: number
  pollingIntervalMinutes: number | null
}

export function createWebsiteForm(): WebsiteFormState {
  return { name: '', url: '', timeoutMs: 8000, pollingIntervalMinutes: null }
}
