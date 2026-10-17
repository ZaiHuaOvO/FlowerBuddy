import type { ReactNode } from 'react'

export type TagTone = 'muted' | 'success' | 'warning' | 'danger'

export function Tag({ tone = 'muted', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`fl-tag fl-tag-${tone}`}>{children}</span>
}
