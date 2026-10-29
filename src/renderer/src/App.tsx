import { lazy, Suspense } from 'react'
import BubbleView from './bubbles/BubbleView'
import PetView from './pet/PetView'
import QuickMenu from './quick-menu/QuickMenu'

const SettingsApp = lazy(() => import('./settings/SettingsApp'))
const MemoCardView = lazy(() => import('./memo-card/MemoCardView'))

function SettingsLoading() {
  return (
    <div className="app-loading" role="status">
      <span className="app-loading-spinner" aria-hidden="true" />
      <span>正在打开设置…</span>
    </div>
  )
}

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view')

  let content
  if (view === 'menu') {
    content = <QuickMenu />
  } else if (view === 'bubble') {
    content = <BubbleView />
  } else if (view === 'settings') {
    content = (
      <Suspense fallback={<SettingsLoading />}>
        <SettingsApp />
      </Suspense>
    )
  } else if (view === 'memo-card') {
    content = <MemoCardView />
  } else {
    content = <PetView />
  }

  return <Suspense fallback={null}>{content}</Suspense>
}
