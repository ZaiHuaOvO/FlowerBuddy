import { useEffect } from 'react'
import { Button } from '../components/Button'

const DEMO_ACTIONS = [
  { id: 'demo:success', label: '演示：加载成功' },
  { id: 'demo:error', label: '演示：加载失败' }
]

function fire(operation: Promise<unknown> | undefined): void {
  void operation?.catch(() => {})
}

export default function QuickMenu() {
  const api = window.menuApi

  useEffect(() => {
    if (!api) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        fire(api.close())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [api])

  if (!api) {
    return null
  }

  return (
    <div className="menu-root">
      <div className="menu-panel" role="menu">
        <p className="menu-title">快捷操作</p>
        {DEMO_ACTIONS.map((action) => (
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
