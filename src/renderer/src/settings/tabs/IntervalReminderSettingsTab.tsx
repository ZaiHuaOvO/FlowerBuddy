import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { IconButton } from '../../components/IconButton'
import type { useIntervalReminderSettings } from '../hooks/useIntervalReminderSettings'
import { formatReminderRanges } from '../utils/formatters'

type ReminderModel = ReturnType<typeof useIntervalReminderSettings>

interface Props {
  model: ReminderModel
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d="M2.8 4.2h10.4M6.2 4.2V3a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v1.2M4.2 4.2l.6 8.3a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-8.3M6.6 6.6v4.2M9.4 6.6v4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IntervalReminderSettingsTab({ model }: Props) {
  const {
    reminders,
    form,
    setForm,
    editingId,
    dialogOpen,
    confirmDeleteId,
    setConfirmDeleteId,
    busy,
    openNew,
    openEdit,
    closeDialog,
    changeUnit,
    addRange,
    updateRange,
    removeRange,
    submit,
    toggle,
    remove
  } = model
  const intervalStep = form.intervalUnit === 'hours' ? 'any' : 1
  const intervalMin = form.intervalUnit === 'hours' ? 0.1 : 1
  const intervalMax = form.intervalUnit === 'hours' ? 24 : 1440

  return (
    <section className="panel reminder-panel">
      <div className="memo-header">
        <h2>定时提醒</h2>
        <Button variant="secondary" onClick={openNew}>
          新增提醒
        </Button>
      </div>

      {reminders.length === 0 ? (
        <EmptyState
          title="还没有定时提醒"
          description="添加一个提醒，让桌宠按间隔在气泡中提示你。"
        />
      ) : (
        <div className="reminder-list">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className={`reminder-row${reminder.enabled ? '' : ' is-disabled'}`}
            >
              <button type="button" className="reminder-main" onClick={() => openEdit(reminder)}>
                <span className="reminder-name">{reminder.name}</span>
                <span className="reminder-range">{formatReminderRanges(reminder.ranges)}</span>
              </button>
              <label className="fl-switch reminder-switch">
                <input
                  type="checkbox"
                  checked={reminder.enabled}
                  aria-label={`${reminder.name} 启用`}
                  onChange={(event) => void toggle(reminder.id, event.target.checked)}
                />
                <span className="fl-switch-track" aria-hidden="true" />
              </label>
            </div>
          ))}
        </div>
      )}

      {dialogOpen
        ? createPortal(
            <div
              className="memo-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeDialog()
                }
              }}
            >
              <div
                className="memo-modal reminder-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reminder-dialog-title"
              >
                <div className="memo-modal-header">
                  <h3 id="reminder-dialog-title">{editingId ? '编辑提醒' : '新建提醒'}</h3>
                  <IconButton label="关闭" onClick={closeDialog}>
                    <span aria-hidden="true">×</span>
                  </IconButton>
                </div>

                <form className="reminder-form" onSubmit={(event) => void submit(event)}>
                  <Field label="名字">
                    <input
                      className="fl-input"
                      value={form.name}
                      maxLength={40}
                      required
                      placeholder="例如：喝水"
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                    />
                  </Field>

                  <Field label="提醒间隔">
                    <div className="reminder-interval-row">
                      <input
                        className="fl-input reminder-interval-value"
                        type="number"
                        min={intervalMin}
                        max={intervalMax}
                        step={intervalStep}
                        value={form.intervalValue}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            intervalValue: Math.max(0, Number(event.target.value))
                          })
                        }
                      />
                      <select
                        className="fl-select reminder-interval-unit"
                        value={form.intervalUnit}
                        onChange={(event) => changeUnit(event.target.value as 'minutes' | 'hours')}
                      >
                        <option value="minutes">分钟</option>
                        <option value="hours">小时</option>
                      </select>
                    </div>
                  </Field>

                  <div className="reminder-field">
                    <span className="reminder-field-label">生效时间</span>
                    <div className="reminder-ranges">
                      {form.ranges.map((range, index) => (
                        <div className="reminder-range-row" key={`${range.start}-${index}`}>
                          <input
                            className="fl-input reminder-time-input"
                            type="time"
                            step="60"
                            value={range.start}
                            aria-label="开始时间"
                            onChange={(event) => updateRange(index, { start: event.target.value })}
                          />
                          <span className="reminder-range-separator">至</span>
                          <input
                            className="fl-input reminder-time-input"
                            type="time"
                            step="60"
                            value={range.end}
                            aria-label="结束时间"
                            onChange={(event) => updateRange(index, { end: event.target.value })}
                          />
                          <IconButton
                            label="删除时间段"
                            tone="danger"
                            onClick={() => removeRange(index)}
                          >
                            <TrashIcon />
                          </IconButton>
                        </div>
                      ))}
                      {form.ranges.length === 0 ? (
                        <p className="hint">未设置时间段时全天生效。</p>
                      ) : null}
                      <Button variant="secondary" onClick={addRange}>
                        添加时间段
                      </Button>
                    </div>
                  </div>

                  <div className="reminder-random-row">
                    <label className="fl-switch">
                      <input
                        type="checkbox"
                        checked={form.randomEnabled}
                        onChange={(event) =>
                          setForm({ ...form, randomEnabled: event.target.checked })
                        }
                      />
                      <span className="fl-switch-track" aria-hidden="true" />
                      <span className="fl-switch-label">随机值</span>
                    </label>
                    <label className="reminder-random-value">
                      <input
                        className="fl-input reminder-jitter-input"
                        type="number"
                        min={0}
                        max={120}
                        step={1}
                        value={form.randomJitterMinutes}
                        disabled={!form.randomEnabled}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            randomJitterMinutes: Math.max(0, Number(event.target.value))
                          })
                        }
                      />
                      <span>分钟</span>
                    </label>
                  </div>

                  <Field label="提醒文本">
                    <textarea
                      className="fl-input reminder-text"
                      value={form.text}
                      maxLength={500}
                      rows={3}
                      required
                      placeholder="气泡中显示的文本"
                      onChange={(event) => setForm({ ...form, text: event.target.value })}
                    />
                  </Field>

                  <div className="reminder-form-footer">
                    <div className="reminder-delete-area">
                      {editingId ? (
                        confirmDeleteId === editingId ? (
                          <>
                            <Button variant="danger" onClick={() => void remove(editingId)}>
                              确认删除
                            </Button>
                            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                              取消
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" onClick={() => setConfirmDeleteId(editingId)}>
                            删除
                          </Button>
                        )
                      ) : null}
                    </div>
                    <div className="form-actions reminder-form-actions">
                      <Button variant="secondary" onClick={closeDialog} disabled={busy}>
                        取消
                      </Button>
                      <Button variant="primary" type="submit" disabled={busy}>
                        保存
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  )
}
