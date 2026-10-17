import type { ModuleId, PublicConfig } from '../../../../shared/api'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { Tag } from '../../components/Tag'
import type { useEsaSettings } from '../hooks/useEsaSettings'
import { formatBytes, formatTime, formatTrafficRange } from '../utils/formatters'

type EsaModel = ReturnType<typeof useEsaSettings>

interface Props {
  config: PublicConfig
  model: EsaModel
  onToggleModule: (moduleId: ModuleId, enabled: boolean) => void
}

export function EsaSettingsTab({ config, model, onToggleModule }: Props) {
  const {
    summary,
    keyIdDraft,
    setKeyIdDraft,
    keySecretDraft,
    setKeySecretDraft,
    siteIdDraft,
    setSiteIdDraft,
    busy,
    traffic,
    saveCredentials,
    clearCredentials,
    refresh,
    saveRefreshInterval
  } = model

  return (
    <section className="panel">
      <div className="panel-header-row">
        <div className="module-title-row">
          <h2>ESA 今日流量</h2>
          <Tag tone={summary?.configured ? 'success' : 'warning'}>
            {summary?.statusLabel ?? '未配置'}
          </Tag>
        </div>
        <label className="module-switch">
          <input
            type="checkbox"
            checked={summary?.enabled ?? false}
            onChange={(event) => onToggleModule('esa', event.target.checked)}
          />
          <span>{summary?.enabled ? '已启用' : '已停用'}</span>
        </label>
      </div>
      <p className="hint">
        请使用只授予 ESA 只读权限（例如 esa:DescribeSiteTimeSeriesData）的 RAM
        子账号，不要使用阿里云主账号 AccessKey。清除配置会同时移除 AccessKey 与 SiteId。
      </p>
      <div className="form-grid">
        <Field label="AccessKey ID" hint="仅保存在本机加密存储">
          <input
            className="fl-input"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={keyIdDraft}
            onChange={(event) => setKeyIdDraft(event.target.value)}
          />
        </Field>
        <Field label="AccessKey Secret" hint="保存后无法读取">
          <input
            className="fl-input"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={keySecretDraft}
            onChange={(event) => setKeySecretDraft(event.target.value)}
          />
        </Field>
        <Field label="SiteId" hint="可在 ESA 控制台或 ListSites 接口获取">
          <input
            className="fl-input"
            value={siteIdDraft}
            maxLength={128}
            onChange={(event) => setSiteIdDraft(event.target.value)}
          />
        </Field>
        <Field label="自动刷新" hint="默认仅手动刷新">
          <select
            className="fl-select"
            value={
              config.modules.esa.refreshIntervalMinutes === null
                ? 'manual'
                : String(config.modules.esa.refreshIntervalMinutes)
            }
            onChange={(event) => void saveRefreshInterval('esa', event.target.value)}
          >
            <option value="manual">仅手动刷新</option>
            <option value="10">每 10 分钟</option>
            <option value="15">每 15 分钟</option>
            <option value="30">每 30 分钟</option>
          </select>
        </Field>
        <div className="form-actions">
          <Button variant="primary" disabled={busy} onClick={() => void saveCredentials()}>
            {busy ? '处理中…' : '保存并查询今日流量'}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !summary?.configured}
            onClick={() => void refresh()}
          >
            刷新流量
          </Button>
          <Button
            variant="danger"
            disabled={!summary?.configured}
            onClick={() => void clearCredentials()}
          >
            清除配置
          </Button>
        </div>
      </div>
      <div className="fl-alert fl-alert-info panel-alert" role="note">
        <span className="fl-alert-icon" aria-hidden="true">
          i
        </span>
        <span className="fl-alert-message">
          今日范围按本机时区 00:00 至当前时刻换算为
          UTC；高访问时官方数据可能采样，不能当作精确账单。
        </span>
      </div>
      {traffic ? (
        <div className="result-card">
          <p className="result-title">今日累计流量</p>
          <p className="result-value result-big">{formatBytes(traffic.bytes)}</p>
          <p className="hint">{formatTrafficRange(traffic.startTime, traffic.endTime)}</p>
          <p className="hint">
            {traffic.samplingRate === null ? '官方未提供采样率' : `采样率 ${traffic.samplingRate}%`}
            ；统计可能有延迟，不等同于精确账单。
          </p>
          <p className="hint">更新于 {formatTime(traffic.fetchedAt)}</p>
        </div>
      ) : (
        <EmptyState
          title="尚未查询流量"
          description={
            summary?.configured
              ? '点击“刷新流量”查询今日累计流量。'
              : '保存 AccessKey 与 SiteId 后即可查询。'
          }
        />
      )}
    </section>
  )
}
