import { lazy, Suspense } from 'react'
import BubbleView from './bubbles/BubbleView'
import PetView from './pet/PetView'
import QuickMenu from './quick-menu/QuickMenu'

const SettingsApp = lazy(() => import('./settings/SettingsApp'))

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view')

  let content
  if (view === 'menu') {
    content = <QuickMenu />
  } else if (view === 'bubble') {
    content = <BubbleView />
  } else if (view === 'settings') {
    content = <SettingsApp />
  } else {
    content = <PetView />
  }

  return <Suspense fallback={null}>{content}</Suspense>
}
