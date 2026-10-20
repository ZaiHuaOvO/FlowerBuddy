import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { Tag } from '../../components/Tag'
import { PageHeader } from '../components/PageHeader'
import { Section } from '../components/Section'
import { Toggle } from '../components/Toggle'
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
    <>
      <PageHeader
        title="网站检测"
        description="从本机网络检查 HTTP(S) 地址的状态码、耗时和错误类型，不读取响应正文。"
        actions={
          <Button
            variant="secondary"
            disabled={checkingAll || websites.length === 0}
            onClick={() => void checkAll()}
          >
            {checkingAll ? '检测中…' : '检测全部'}
          </Button>
        }
      />

      <Section
        title={editingId ? '编辑网站' : '添加网站'}
        description="只检测本机网络能否访问，不代表全球可用性。"
      >
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
          <div className="form-span-2">
            <Field label="URL" hint="仅支持 http/https">
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
          </div>
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
                form.pollingIntervalMinutes === null
                  ? 'manual'
                  : String(form.pollingIntervalMinutes)
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
          <div className="form-actions form-actions-end">
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
      </Section>

      <Section
        title="网站列表"
        description={websites.length > 0 ? `${websites.length} 个地址` : undefined}
      >
        {websites.length === 0 ? (
          <EmptyState
            title="还没有网站检测"
            description="添加一个 HTTP(S) 地址，即可从本机检查它的状态码、耗时和错误类型。"
          />
        ) : (
          <div className="data-list">
            {websites.map((check) => (
              <div className="data-row" key={check.id} data-website={check.id}>
                <div className="data-row-main">
                  <div className="data-row-title">
                    <span className="data-row-name">{check.name}</span>
                    <Tag tone={websiteTone(check.lastResult)}>{websiteLabel(check.lastResult)}</Tag>
                  </div>
                  <p className="data-row-subtitle" title={check.url}>
                    {check.url}
                  </p>
                  <p className="data-row-meta">
                    {check.pollingIntervalMinutes === null
                      ? '仅手动检测'
                      : `每 ${check.pollingIntervalMinutes} 分钟`}
                    {check.lastResult ? ` · 更新于 ${formatTime(check.lastResult.checkedAt)}` : ''}
                  </p>
                </div>
                <div className="data-row-actions">
                  <Toggle
                    checked={check.enabled}
                    ariaLabel={`${check.name} 启用`}
                    label={check.enabled ? '已启用' : '已停用'}
                    onChange={(enabled) => void toggle(check.id, enabled)}
                  />
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
      </Section>
    </>
  )
}
