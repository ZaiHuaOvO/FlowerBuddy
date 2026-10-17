import type { ModuleId, PublicConfig } from '../../../../shared/api'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { Tag } from '../../components/Tag'
import type { useDeepSeekSettings } from '../hooks/useDeepSeekSettings'
import { formatBalanceAmount, formatTime } from '../utils/formatters'

type DeepSeekModel = ReturnType<typeof useDeepSeekSettings>

interface Props {
  config: PublicConfig
  model: DeepSeekModel
  onToggleModule: (moduleId: ModuleId, enabled: boolean) => void
}

export function DeepSeekSettingsTab({ config, model, onToggleModule }: Props) {
  const {
    summary,
    keyDraft,
    setKeyDraft,
    busy,
    balance,
    saveKey,
    clearKey,
    refresh,
    saveRefreshInterval
  } = model

  return (
    <section className="panel">
      <div className="panel-header-row">
        <div className="module-title-row">
          <h2>DeepSeek 余额</h2>
          <Tag tone={summary?.configured ? 'success' : 'warning'}>
            {summary?.statusLabel ?? '未配置'}
          </Tag>
        </div>
        <label className="module-switch">
          <input
            type="checkbox"
            checked={summary?.enabled ?? false}
            onChange={(event) => onToggleModule('deepseek', event.target.checked)}
          />
          <span>{summary?.enabled ? '已启用' : '已停用'}</span>
        </label>
      </div>
      <p className="hint">
        API Key 仅由主进程使用 Windows safeStorage
        加密保存，界面不会回显明文，也不会写入日志或普通配置文件。
      </p>
      <div className="form-grid">
        <Field label="API Key" hint="保存后无法读取；输入新值可覆盖">
          <input
            className="fl-input"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={keyDraft}
            placeholder="sk-..."
            onChange={(event) => setKeyDraft(event.target.value)}
          />
        </Field>
        <Field label="自动刷新" hint="默认仅手动刷新">
          <select
            className="fl-select"
            value={
              config.modules.deepseek.refreshIntervalMinutes === null
                ? 'manual'
                : String(config.modules.deepseek.refreshIntervalMinutes)
            }
            onChange={(event) => void saveRefreshInterval('deepseek', event.target.value)}
          >
            <option value="manual">仅手动刷新</option>
            <option value="15">每 15 分钟</option>
            <option value="30">每 30 分钟</option>
            <option value="60">每 60 分钟</option>
          </select>
        </Field>
        <div className="form-actions">
          <Button variant="primary" disabled={busy} onClick={() => void saveKey()}>
            {busy ? '处理中…' : '保存并查询余额'}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !summary?.configured}
            onClick={() => void refresh()}
          >
            刷新余额
          </Button>
          <Button variant="danger" disabled={!summary?.configured} onClick={() => void clearKey()}>
            清除 Key
          </Button>
        </div>
      </div>
      <div className="fl-alert fl-alert-info panel-alert" role="note">
        <span className="fl-alert-icon" aria-hidden="true">
          i
        </span>
        <span className="fl-alert-message">
          “今日花费”当前未接入官方账号级每日消费统计；余额变化不等于消费，本应用不会用余额差额估算。
        </span>
      </div>
      {balance ? (
        <div className="result-card">
          <p className="result-title">
            {balance.isAvailable ? '账户余额' : '账户当前不可用（余额不足或受限）'}
          </p>
          {balance.balances.length === 0 ? (
            <p className="hint">接口未返回余额信息。</p>
          ) : (
            balance.balances.map((info, index) => (
              <div key={`${info.currency}-${index}`}>
                <div className="result-row">
                  <span>{info.currency}</span>
                  <span className="result-value">
                    {formatBalanceAmount(info.currency, info.totalBalance)}
                  </span>
                </div>
                <p className="hint">
                  赠送 {formatBalanceAmount(info.currency, info.grantedBalance)} · 充值{' '}
                  {formatBalanceAmount(info.currency, info.toppedUpBalance)}
                </p>
              </div>
            ))
          )}
          <p className="hint">更新于 {formatTime(balance.fetchedAt)}</p>
        </div>
      ) : (
        <EmptyState
          title="尚未查询余额"
          description={
            summary?.configured ? '点击“刷新余额”查询当前余额。' : '保存 API Key 后即可查询余额。'
          }
        />
      )}
    </section>
  )
}
