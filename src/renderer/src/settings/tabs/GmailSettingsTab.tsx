import type { ModuleId, PublicConfig } from '../../../../shared/api'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { Tag } from '../../components/Tag'
import type { useGmailSettings } from '../hooks/useGmailSettings'
import { maskEmail } from '../utils/formatters'

type GmailModel = ReturnType<typeof useGmailSettings>

interface Props {
  config: PublicConfig
  model: GmailModel
  onToggleModule: (moduleId: ModuleId, enabled: boolean) => void
}

export function GmailSettingsTab({ config, model, onToggleModule }: Props) {
  const {
    gmailState,
    summary,
    clientIdDraft,
    setClientIdDraft,
    clientSecretDraft,
    setClientSecretDraft,
    busy,
    checkResult,
    saveClient,
    connect,
    disconnect,
    checkNow,
    updateSettings
  } = model

  return (
    <section className="panel">
      <div className="panel-header-row">
        <div className="module-title-row">
          <h2>Gmail 新邮件</h2>
          <Tag
            tone={
              summary?.status === 'auth-expired'
                ? 'danger'
                : summary?.configured
                  ? 'success'
                  : 'warning'
            }
          >
            {summary?.statusLabel ?? '未配置'}
          </Tag>
        </div>
        <label className="module-switch">
          <input
            type="checkbox"
            checked={summary?.enabled ?? false}
            onChange={(event) => onToggleModule('gmail', event.target.checked)}
          />
          <span>{summary?.enabled ? '已启用' : '已停用'}</span>
        </label>
      </div>
      <p className="hint">
        使用 Gmail API + OAuth
        2.0，只申请只读权限；首次连接只建立同步基线，不会把历史邮件当作新邮件提醒。
      </p>
      {gmailState?.authExpired ? (
        <div className="fl-alert fl-alert-warning panel-alert" role="status">
          <span className="fl-alert-icon" aria-hidden="true">
            !
          </span>
          <span className="fl-alert-message">Gmail 授权已失效，请重新连接。</span>
        </div>
      ) : null}
      {gmailState?.configured && gmailState.emailAddress ? (
        <p className="hint">已连接：{maskEmail(gmailState.emailAddress)}</p>
      ) : null}
      <div className="form-grid">
        <Field label="OAuth Client ID" hint="Google Cloud 中“桌面应用”类型的 OAuth 客户端">
          <input
            className="fl-input"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={clientIdDraft}
            onChange={(event) => setClientIdDraft(event.target.value)}
          />
        </Field>
        <Field label="OAuth Client Secret" hint="加密保存，保存后无法读取">
          <input
            className="fl-input"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={clientSecretDraft}
            onChange={(event) => setClientSecretDraft(event.target.value)}
          />
        </Field>
        <Field label="轮询间隔" hint="默认每 3 分钟，范围 1–15 分钟">
          <select
            className="fl-select"
            value={config.modules.gmail.pollIntervalMinutes}
            onChange={(event) =>
              void updateSettings({
                pollIntervalMinutes: Number(event.target.value)
              })
            }
          >
            {[1, 3, 5, 10, 15].map((minutes) => (
              <option key={minutes} value={minutes}>
                每 {minutes} 分钟
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <Button variant="secondary" disabled={busy !== 'idle'} onClick={() => void saveClient()}>
            保存客户端配置
          </Button>
          <Button
            variant="primary"
            disabled={busy !== 'idle' || !gmailState?.clientConfigured}
            onClick={() => void connect()}
          >
            {busy === 'connecting' ? '等待浏览器授权…' : '连接 Gmail'}
          </Button>
          <Button
            variant="secondary"
            disabled={busy !== 'idle' || !gmailState?.configured}
            onClick={() => void checkNow()}
          >
            {busy === 'checking' ? '检查中…' : '立即检查'}
          </Button>
          <Button
            variant="danger"
            disabled={busy !== 'idle' || !gmailState?.configured}
            onClick={() => void disconnect()}
          >
            断开连接
          </Button>
        </div>
      </div>
      <label className="row">
        <span>新邮件系统通知</span>
        <input
          type="checkbox"
          checked={config.modules.gmail.notifyNewMail}
          onChange={(event) => void updateSettings({ notifyNewMail: event.target.checked })}
        />
      </label>
      <label className="row">
        <span>通知中隐藏发件人与主题</span>
        <input
          type="checkbox"
          checked={config.modules.gmail.hideSubject}
          onChange={(event) => void updateSettings({ hideSubject: event.target.checked })}
        />
      </label>
      <div className="fl-alert fl-alert-info panel-alert" role="note">
        <span className="fl-alert-icon" aria-hidden="true">
          i
        </span>
        <span className="fl-alert-message">
          需要先在 Google Cloud 启用 Gmail API、配置 OAuth consent screen，并创建“桌面应用”OAuth
          客户端。未发布的 OAuth 应用可能只允许测试用户登录。
        </span>
      </div>
      {checkResult ? (
        <div className="result-card">
          <p className="result-title">检查结果</p>
          <p className="hint">{checkResult}</p>
        </div>
      ) : null}
      {!gmailState?.configured ? (
        <EmptyState
          title="尚未连接 Gmail"
          description={
            gmailState?.clientConfigured
              ? '客户端配置已保存，点击“连接 Gmail”在浏览器中完成授权。'
              : '填写 OAuth 客户端配置并保存，然后点击“连接 Gmail”在浏览器中完成授权。'
          }
        />
      ) : null}
    </section>
  )
}
