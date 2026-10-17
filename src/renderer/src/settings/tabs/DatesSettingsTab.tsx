import type { DateCategory, DateRecurrence } from '../../../../shared/api'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { Tag } from '../../components/Tag'
import type { useDatesSettings } from '../hooks/useDatesSettings'
import { CATEGORY_OPTIONS } from '../utils/constants'
import { categoryLabel, dateStatusLabel, dateTone } from '../utils/formatters'

type DatesModel = ReturnType<typeof useDatesSettings>

interface Props {
  model: DatesModel
}

export function DatesSettingsTab({ model }: Props) {
  const {
    events,
    form,
    setForm,
    editingId,
    confirmDeleteId,
    setConfirmDeleteId,
    submit,
    startEdit,
    cancelEdit,
    toggle,
    remove
  } = model

  return (
    <section className="panel">
      <h2>日期事件</h2>
      <p className="hint">“今天”按本机时区计算；每年重复的 2 月 29 日在非闰年按 2 月 28 日处理。</p>
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <Field label="事件名称">
          <input
            className="fl-input"
            value={form.title}
            maxLength={80}
            required
            placeholder="例如：结婚纪念日"
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </Field>
        <Field label="日期">
          <input
            className="fl-input"
            type="date"
            value={form.date}
            required
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </Field>
        <Field label="重复">
          <select
            className="fl-select"
            value={form.recurrence}
            onChange={(event) =>
              setForm({
                ...form,
                recurrence: event.target.value as DateRecurrence
              })
            }
          >
            <option value="yearly">每年</option>
            <option value="none">一次性</option>
          </select>
        </Field>
        <Field label="分类">
          <select
            className="fl-select"
            value={form.category}
            onChange={(event) =>
              setForm({
                ...form,
                category: event.target.value as DateCategory
              })
            }
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <Button variant="primary" type="submit">
            {editingId ? '保存修改' : '添加事件'}
          </Button>
          {editingId ? (
            <Button variant="secondary" onClick={cancelEdit}>
              取消
            </Button>
          ) : null}
        </div>
      </form>

      {events.length === 0 ? (
        <EmptyState
          title="还没有日期事件"
          description="添加生日、纪念日或一次性日期，桌宠会显示最近的事件。"
        />
      ) : (
        <div className="module-list">
          {events.map((item) => (
            <div className="module-card" key={item.id} data-date-event={item.id}>
              <div className="module-main">
                <div className="module-title-row">
                  <span className="module-name">{item.title}</span>
                  <Tag tone="muted">{categoryLabel(item.category)}</Tag>
                  <Tag tone={dateTone(item)}>{dateStatusLabel(item)}</Tag>
                </div>
                <p className="hint">
                  {item.date} · {item.recurrence === 'yearly' ? '每年' : '一次性'}
                  {item.upcoming && item.occurrence && item.occurrence !== item.date
                    ? ` · 下次 ${item.occurrence}`
                    : ''}
                </p>
              </div>
              <div className="row-actions">
                <label className="module-switch">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(event) => void toggle(item.id, event.target.checked)}
                  />
                  <span>{item.enabled ? '已启用' : '已停用'}</span>
                </label>
                <Button variant="secondary" onClick={() => startEdit(item)}>
                  编辑
                </Button>
                {confirmDeleteId === item.id ? (
                  <>
                    <Button variant="danger" onClick={() => void remove(item.id)}>
                      确认删除
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                      取消
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmDeleteId(item.id)}>
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
