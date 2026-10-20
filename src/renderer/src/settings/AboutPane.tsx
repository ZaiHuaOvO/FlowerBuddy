import type { AppInfo, ExternalLinkId, UpdateStatus } from '../../../shared/api'
import { Button } from '../components/Button'
import { Tag } from '../components/Tag'
import type { TagTone } from '../components/tag-tone'
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

function updateTag(status: UpdateStatus): { tone: TagTone; label: string } {
  switch (status.state) {
    case 'checking':
      return { tone: 'muted', label: '检查中' }
    case 'available':
      return { tone: 'warning', label: '有更新' }
    case 'downloading':
      return { tone: 'warning', label: '下载中' }
    case 'downloaded':
      return { tone: 'success', label: '待安装' }
    case 'not-available':
      return { tone: 'success', label: '已是最新' }
    case 'error':
      return { tone: 'danger', label: '更新失败' }
    case 'unsupported':
      return { tone: 'muted', label: '手动更新' }
    case 'idle':
      return { tone: 'muted', label: '待检查' }
  }
}

const LINKS: Array<{ label: string; value: string; link: ExternalLinkId }> = [
  { label: 'GitHub 仓库', value: 'ZaiHuaOvO/FlowerBuddy', link: 'repository' },
  { label: '问题反馈', value: '提交 Issue', link: 'issues' },
  { label: '作者', value: '再花', link: 'author' }
]

export function AboutPane({
  appInfo,
  updateStatus,
  onOpenExternal,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate
}: Props) {
  const tag = updateStatus ? updateTag(updateStatus) : null
  return (
    <section className="panel about-pane">
      <div className="about-hero">
        <div className="about-icon-shell">
          <img className="about-icon" src={appIcon} width={80} height={80} alt="花伴 app icon" />
        </div>
        <div className="about-identity">
          <div className="about-title-row">
            <h2>花伴</h2>
            {appInfo ? <Tag tone="muted">v{appInfo.version}</Tag> : null}
          </div>
          <p className="about-tagline">桌面宠物与个人信息助手</p>
          <p className="about-meta">FlowerBuddy · 数据仅保存在本机</p>
        </div>
      </div>

      <div className="about-grid">
        <section className="about-card">
          <div className="about-card-head">
            <h3>应用更新</h3>
            {tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : null}
          </div>
          <p className="about-status" role="status">
            {updateStatus ? updateMessage(updateStatus) : '正在读取更新状态…'}
          </p>
          {updateStatus?.state === 'downloading' && updateStatus.percent !== null ? (
            <progress className="about-update-progress" max={100} value={updateStatus.percent} />
          ) : null}
          {updateStatus ? (
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
          ) : null}
        </section>

        <section className="about-card">
          <h3>链接</h3>
          <div className="about-links">
            {LINKS.map((item) => (
              <button
                key={item.link}
                type="button"
                className="about-link"
                onClick={() => onOpenExternal(item.link)}
              >
                <span>{item.label}</span>
                <span className="about-link-value">{item.value}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <p className="about-footer">花伴 · MIT License</p>
    </section>
  )
}
