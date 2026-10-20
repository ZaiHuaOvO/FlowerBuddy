import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Field } from '../../components/Field'
import { PageHeader } from '../components/PageHeader'
import { Dialog } from '../components/Dialog'
import { Toggle } from '../components/Toggle'
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
    <>
      <PageHeader
        title="定时提醒"
        description="按分钟或小时重复提醒，可限制生效时段并加入随机偏移。"
        actions={
          <Button variant="primary" onClick={openNew}>
            新增提醒
          </Button>
        }
      />

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
              <Toggle
                checked={reminder.enabled}
                ariaLabel={`${reminder.name} 启用`}
                onChange={(checked) => void toggle(reminder.id, checked)}
              />
            </div>
          ))}
        </div>
      )}

      {dialogOpen ? (
        <Dialog
          title={editingId ? '编辑提醒' : '新建提醒'}
          onClose={closeDialog}
          onSubmit={(event) => void submit(event)}
          footerLeft={
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
                    删除提醒
                  </Button>
                )
              ) : null}
            </div>
          }
          footerRight={
            <>
              <Button variant="ghost" onClick={closeDialog} disabled={busy}>
                取消
              </Button>
              <Button variant="primary" type="submit" disabled={busy}>
                保存
              </Button>
            </>
          }
        >
          <Field label="名字">
            <input
              className="fl-input"
              data-autofocus
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

          <div className="field">
            <span className="field-label">生效时间</span>
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
                  <Button
                    variant="ghost"
                    className="reminder-range-remove"
                    aria-label="删除时间段"
                    onClick={() => removeRange(index)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              ))}
              {form.ranges.length === 0 ? (
                <p className="field-hint">未设置时间段时全天生效。</p>
              ) : null}
              <Button variant="secondary" onClick={addRange}>
                添加时间段
              </Button>
            </div>
          </div>

          <div className="form-row-inline">
            <Toggle
              checked={form.randomEnabled}
              onChange={(enabled) => setForm({ ...form, randomEnabled: enabled })}
              label="随机偏移"
            />
            <label className="form-row-inline-value">
              <input
                className="fl-input reminder-jitter-input"
                type="number"
                min={0}
                max={120}
                step={1}
                value={form.randomJitterMinutes}
                disabled={!form.randomEnabled}
                aria-label="随机偏移分钟数"
                onChange={(event) =>
                  setForm({
                    ...form,
                    randomJitterMinutes: Math.max(0, Number(event.target.value))
                  })
                }
              />
              <span>分钟内随机</span>
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
        </Dialog>
      ) : null}
    </>
  )
}
