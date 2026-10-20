import type { AppInfo, ExternalLinkId } from '../../../shared/api'
import { Button } from '../components/Button'
import appIcon from '../assets/app-icon-256.png'

interface Props {
  appInfo: AppInfo | null
  onOpenExternal: (link: ExternalLinkId) => void
}

export function AboutPane({ appInfo, onOpenExternal }: Props) {
  return (
    <section className="panel about-pane">
      <div className="about-brand">
        <img className="about-icon" src={appIcon} width={96} height={96} alt="花伴 app icon" />
        <div>
          <h2>花伴</h2>
          <p className="hint">FlowerBuddy · 桌面宠物与个人信息助手</p>
          {appInfo ? <p className="hint">版本 {appInfo.version}</p> : null}
        </div>
      </div>
      <div className="about-links">
        <div className="row">
          <span className="row-label">作者</span>
          <Button variant="ghost" onClick={() => onOpenExternal('author')}>
            再花
          </Button>
        </div>
        <div className="row">
          <span className="row-label">GitHub 仓库</span>
          <Button variant="ghost" onClick={() => onOpenExternal('repository')}>
            ZaiHuaOvO/FlowerBuddy
          </Button>
        </div>
        <div className="row">
          <span className="row-label">反馈</span>
          <Button variant="ghost" onClick={() => onOpenExternal('issues')}>
            提交 Issue
          </Button>
        </div>
      </div>
    </section>
  )
}
