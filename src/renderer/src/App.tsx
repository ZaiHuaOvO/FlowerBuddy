import BubbleView from './bubbles/BubbleView'
import PetView from './pet/PetView'
import QuickMenu from './quick-menu/QuickMenu'
import SettingsApp from './settings/SettingsApp'

export default function App() {
  const view = new URLSearchParams(window.location.search).get('view')

  if (view === 'menu') {
    return <QuickMenu />
  }
  if (view === 'bubble') {
    return <BubbleView />
  }
  if (view === 'settings') {
    return <SettingsApp />
  }
  return <PetView />
}
