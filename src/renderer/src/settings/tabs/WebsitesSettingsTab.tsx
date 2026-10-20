import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { Tag } from '../../components/Tag'
import type { useWebsiteSettings } from '../hooks/useWebsiteSettings'
import { POLLING_OPTIONS, TIMEOUT_OPTIONS } from '../utils/constants'
import { formatTime, websiteLabel, websiteTone } from '../utils/formatters'

type WebsiteModel = ReturnType<typeof useWebsiteSettings>

interface Props {
  model: WebsiteModel
}

export function WebsitesSettingsTab({ model }: Props) {
  const {
    websites,
    form,
    setForm,
    editingId,
    confirmDeleteId,
    setConfirmDeleteId,
    checkingId,
    checkingAll,
    submit,
    startEdit,
    cancelEdit,
    toggle,
    remove,
    checkOne,
    checkAll
  } = model

  return (
    <section className="panel">
      <h2>网站检测</h2>
      <p className="hint">只检测本机网络能否访问，不代表全球可用性。</p>
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <Field label="名称">
          <input
            className="fl-input"
            value={form.name}
            maxLength={80}
            required
            placeholder="例如：个人博客"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <Field label="URL">
          <input
            className="fl-input"
            type="url"
            value={form.url}
            maxLength={2048}
            required
            placeholder="https://example.com"
            onChange={(event) => setForm({ ...form, url: event.target.value })}
          />
        </Field>
        <Field label="超时">
          <select
            className="fl-select"
            value={form.timeoutMs}
            onChange={(event) =>
              setForm({
                ...form,
                timeoutMs: Number(event.target.value)
              })
            }
          >
            {TIMEOUT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value / 1000} 秒
              </option>
            ))}
          </select>
        </Field>
        <Field label="定时检测">
          <select
            className="fl-select"
            value={
              form.pollingIntervalMinutes === null ? 'manual' : String(form.pollingIntervalMinutes)
            }
            onChange={(event) =>
              setForm({
                ...form,
                pollingIntervalMinutes:
                  event.target.value === 'manual' ? null : Number(event.target.value)
              })
            }
          >
            {POLLING_OPTIONS.map((value) => (
              <option key={value ?? 'manual'} value={value ?? 'manual'}>
                {value === null ? '仅手动检测' : `每 ${value} 分钟`}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <Button variant="primary" type="submit">
            {editingId ? '保存修改' : '添加网站'}
          </Button>
          {editingId ? (
            <Button variant="secondary" onClick={cancelEdit}>
              取消
            </Button>
          ) : null}
        </div>
      </form>

      <div className="website-toolbar">
        <Button
          variant="secondary"
          disabled={checkingAll || websites.length === 0}
          onClick={() => void checkAll()}
        >
          {checkingAll ? '检测中…' : '检测全部启用网站'}
        </Button>
      </div>

      {websites.length === 0 ? (
        <EmptyState
          title="还没有网站检测"
          description="添加一个 HTTP(S) 地址，即可从本机检查它的状态码、耗时和错误类型。"
        />
      ) : (
        <div className="module-list">
          {websites.map((check) => (
            <div className="module-card" key={check.id} data-website={check.id}>
              <div className="module-main">
                <div className="module-title-row">
                  <span className="module-name">{check.name}</span>
                  <Tag tone={websiteTone(check.lastResult)}>{websiteLabel(check.lastResult)}</Tag>
                </div>
                <p className="website-url" title={check.url}>
                  {check.url}
                </p>
                <p className="hint">
                  {check.pollingIntervalMinutes === null
                    ? '仅手动检测'
                    : `每 ${check.pollingIntervalMinutes} 分钟`}
                  {check.lastResult ? ` · 更新于 ${formatTime(check.lastResult.checkedAt)}` : ''}
                </p>
              </div>
              <div className="row-actions">
                <label className="module-switch">
                  <input
                    type="checkbox"
                    checked={check.enabled}
                    onChange={(event) => void toggle(check.id, event.target.checked)}
                  />
                  <span>{check.enabled ? '已启用' : '已停用'}</span>
                </label>
                <Button
                  variant="secondary"
                  disabled={checkingId === check.id}
                  onClick={() => void checkOne(check.id)}
                >
                  {checkingId === check.id ? '检测中…' : '检测'}
                </Button>
                <Button variant="ghost" onClick={() => startEdit(check)}>
                  编辑
                </Button>
                {confirmDeleteId === check.id ? (
                  <>
                    <Button variant="danger" onClick={() => void remove(check.id)}>
                      确认删除
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                      取消
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmDeleteId(check.id)}>
                    删除
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
