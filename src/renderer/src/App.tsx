import { lazy, Suspense } from 'react'
import BubbleView from './bubbles/BubbleView'
import PetView from './pet/PetView'
import QuickMenu from './quick-menu/QuickMenu'

const SettingsApp = lazy(() => import('./settings/SettingsApp'))
const MemoCardView = lazy(() => import('./memo-card/MemoCardView'))

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view')

  let content
  if (view === 'menu') {
    content = <QuickMenu />
  } else if (view === 'bubble') {
    content = <BubbleView />
  } else if (view === 'settings') {
    content = <SettingsApp />
  } else if (view === 'memo-card') {
    content = <MemoCardView />
  } else {
    content = <PetView />
  }

  return <Suspense fallback={null}>{content}</Suspense>
}
