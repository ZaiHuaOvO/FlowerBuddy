import type { AppInfo, ExternalLinkId, UpdateStatus } from '../../../shared/api'
import { Button } from '../components/Button'
import appIcon from '../assets/app-icon-256.png'

interface Props {
  appInfo: AppInfo | null
  updateStatus: UpdateStatus | null
  onOpenExternal: (link: ExternalLinkId) => void
  onCheckForUpdates: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
}

function updateMessage(status: UpdateStatus): string {
  switch (status.state) {
    case 'unsupported':
      return status.message ?? '当前版本不支持应用内更新。'
    case 'idle':
      return '尚未检查更新。'
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return `发现新版本 ${status.version ?? ''}。`
    case 'not-available':
      return '当前已是最新版本。'
    case 'downloading':
      return status.percent === null ? '正在下载更新…' : `正在下载更新（${status.percent}%）…`
    case 'downloaded':
      return `新版本 ${status.version ?? ''} 已下载，重启后安装。`
    case 'error':
      return status.message ?? '更新失败，请稍后重试或手动下载新版本。'
  }
}

export function AboutPane({
  appInfo,
  updateStatus,
  onOpenExternal,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate
}: Props) {
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

      <div className="about-update">
        <h3>应用更新</h3>
        {updateStatus ? (
          <>
            <p className="hint" role="status">
              {updateMessage(updateStatus)}
            </p>
            {updateStatus.state === 'downloading' && updateStatus.percent !== null ? (
              <progress className="about-update-progress" max={100} value={updateStatus.percent} />
            ) : null}
            <div className="about-update-actions">
              {updateStatus.state === 'available' ? (
                <Button variant="primary" onClick={onDownloadUpdate}>
                  下载更新
                </Button>
              ) : null}
              {updateStatus.state === 'downloaded' ? (
                <Button variant="primary" onClick={onInstallUpdate}>
                  重启并安装
                </Button>
              ) : null}
              {updateStatus.state === 'idle' ||
              updateStatus.state === 'not-available' ||
              updateStatus.state === 'error' ? (
                <Button variant="secondary" onClick={onCheckForUpdates}>
                  检查更新
                </Button>
              ) : null}
              {updateStatus.state === 'unsupported' || updateStatus.state === 'error' ? (
                <Button variant="ghost" onClick={() => onOpenExternal('releases')}>
                  手动下载
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="hint">正在读取更新状态…</p>
        )}
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
