import { useEffect, useState } from 'react'
import type { MenuActionSummary } from '../../../shared/api'
import { Button } from '../components/Button'
import '../styles/menu.css'

function fire(operation: Promise<unknown> | undefined): void {
  void operation?.catch(() => {})
}

export default function QuickMenu() {
  const api = window.menuApi
  const [actions, setActions] = useState<MenuActionSummary[]>([])

  useEffect(() => {
    if (!api) {
      return
    }
    let active = true

    const loadActions = (): void => {
      void api
        .getActions()
        .then((next) => {
          if (active) {
            setActions(next)
          }
        })
        .catch(() => {})
    }

    loadActions()
    window.addEventListener('focus', loadActions)

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        fire(api.close())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      active = false
      window.removeEventListener('focus', loadActions)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [api])

  if (!api) {
    return null
  }

  return (
    <div className="menu-root">
      <div className="menu-panel" role="menu">
        <p className="menu-title">快捷操作</p>
        {actions.length === 0 ? <p className="menu-empty">暂无可用的快捷功能</p> : null}
        {actions.map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            className="menu-item"
            role="menuitem"
            data-action={action.id}
            onClick={() => fire(api.runAction(action.id))}
          >
            {action.label}
          </Button>
        ))}
        <div className="menu-separator" />
        <Button
          variant="ghost"
          className="menu-item"
          role="menuitem"
          onClick={() => fire(api.openSettings())}
        >
          打开设置
        </Button>
        <Button
          variant="ghost"
          className="menu-item"
          role="menuitem"
          onClick={() => fire(api.hidePet())}
        >
          隐藏桌宠
        </Button>
        <Button
          variant="danger"
          className="menu-item"
          role="menuitem"
          onClick={() => fire(api.quit())}
        >
          退出 FlowerBuddy
        </Button>
      </div>
    </div>
  )
}
