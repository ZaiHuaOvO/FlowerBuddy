import type { ReactNode } from 'react'
import type { TagTone } from './tag-tone'

export function Tag({ tone = 'muted', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`fl-tag fl-tag-${tone}`}>{children}</span>
}
