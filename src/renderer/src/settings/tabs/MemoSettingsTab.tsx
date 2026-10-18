import { useEffect, useRef, useState } from 'react'
import type { MemoSummary } from '../../../../shared/api'
import { memoImageUrl } from '../../../../shared/api'
import { formatMemoDateTime, memoExcerpt, memoTitle } from '../utils/formatters'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { IconButton } from '../../components/IconButton'
import { InfoTip } from '../../components/InfoTip'
import { Tag } from '../../components/Tag'
import { ShortcutInput } from '../components/ShortcutInput'
import type { useMemoSettings } from '../hooks/useMemoSettings'

type MemoModel = ReturnType<typeof useMemoSettings>

interface Props {
  model: MemoModel
  memoShortcut: string
  onSaveShortcut: (accelerator: string) => void
}

function PinIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d="M9.4 1.8 14.2 6.6l-1.7.5-2.4 2.4-.3 2.1-1.1 1.1-5.4-5.4 1.1-1.1 2.1-.3L8.9 3.5zM4.7 11.3 2 14"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="m5.2 8.2 1.9 1.9 3.7-3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <rect
        x="2.3"
        y="3.4"
        width="11.4"
        height="10.3"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M2.3 6.4h11.4M5.4 2.2v2.4M10.6 2.2v2.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function MemoSettingsTab({ model, memoShortcut, onSaveShortcut }: Props) {
  const {
    memos,
    draft,
    setDraft,
    editingId,
    confirmDeleteId,
    setConfirmDeleteId,
    editorOpen,
    busy,
    startNew,
    startEdit,
    cancelEdit,
    updateReminderText,
    setReminderFromPicker,
    addPastedImages,
    removeImage,
    submit,
    complete,
    uncomplete,
    toggleAnchorNew,
    toggleAnchor,
    remove
  } = model
  const [settingsOpen, setSettingsOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pickerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editorOpen) {
      textareaRef.current?.focus()
      textareaRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [editorOpen, editingId])

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>): void {
    const files: File[] = []
    for (const item of Array.from(event.clipboardData.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          files.push(file)
        }
      }
    }
    for (const file of Array.from(event.clipboardData.files)) {
      if (file.type.startsWith('image/') && !files.some((entry) => entry.name === file.name)) {
        files.push(file)
      }
    }
    if (files.length > 0) {
      event.preventDefault()
      void addPastedImages(files)
    }
  }

  function openPicker(): void {
    const picker = pickerRef.current
    if (!picker) {
      return
    }
    if (draft.reminderAt) {
      const date = new Date(draft.reminderAt)
      if (!Number.isNaN(date.getTime())) {
        picker.value = toLocalInputValue(date)
      }
    }
    if (typeof picker.showPicker === 'function') {
      picker.showPicker()
    } else {
      picker.click()
    }
  }

  return (
    <section className="panel memo-panel">
      <div className="memo-header">
        <div className="memo-title-group">
          <h2>备忘录</h2>
          <IconButton
            label="备忘录设置"
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen(true)}
          >
            <GearIcon />
          </IconButton>
        </div>
        <Button variant="secondary" onClick={startNew}>
          新增备忘录
        </Button>
      </div>

      {memos.length === 0 ? (
        <EmptyState title="还没有备忘录" description="记录一条备忘，设置提醒，或把它锚定到桌面。" />
      ) : (
        <div className="memo-list">
          {memos.map((memo) => (
            <MemoRow
              key={memo.id}
              memo={memo}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              onEdit={() => startEdit(memo)}
              onToggleComplete={() =>
                memo.completed ? void uncomplete(memo.id) : void complete(memo.id)
              }
              onToggleAnchor={(anchored) => void toggleAnchor(memo.id, anchored)}
              onRemove={() => void remove(memo.id)}
            />
          ))}
        </div>
      )}

      {editorOpen ? (
        <div
          className="memo-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelEdit()
            }
          }}
        >
          <div
            className="memo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memo-editor-title"
          >
            <div className="memo-modal-header">
              <h3 id="memo-editor-title">{editingId ? '编辑备忘录' : '新建备忘录'}</h3>
              <IconButton label="关闭" onClick={cancelEdit}>
                <span aria-hidden="true">×</span>
              </IconButton>
            </div>

            <form className="memo-editor" onSubmit={(event) => void submit(event)}>
              <textarea
                ref={textareaRef}
                className="fl-input memo-textarea"
                value={draft.text}
                maxLength={20000}
                rows={6}
                placeholder="写点什么……可直接粘贴图片"
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                onPaste={handlePaste}
              />

              {draft.images.length > 0 ? (
                <div className="memo-attachments">
                  {draft.images.map((image) => (
                    <div className="memo-attachment" key={image.id}>
                      <img
                        src={memoImageUrl(image.id)}
                        alt="备忘录图片"
                        width={image.width}
                        height={image.height}
                        loading="lazy"
                      />
                      <button
                        type="button"
                        className="memo-attachment-remove"
                        aria-label="移除图片"
                        onClick={() => removeImage(image.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="memo-reminder-field">
                <input
                  className={`fl-input memo-reminder-input${draft.reminderError ? ' is-invalid' : ''}`}
                  value={draft.reminderText}
                  placeholder="提醒时间，例如：下周五 3 点 / 2026-10-20 15:30"
                  onChange={(event) => updateReminderText(event.target.value)}
                />
                <Button variant="secondary" aria-label="选择提醒时间" onClick={openPicker}>
                  <CalendarIcon />
                  选择时间
                </Button>
                <input
                  ref={pickerRef}
                  className="memo-picker-hidden"
                  type="datetime-local"
                  step="1"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => setReminderFromPicker(event.target.value)}
                />
              </div>
              {draft.reminderError ? (
                <p className="memo-reminder-error">{draft.reminderError}</p>
              ) : draft.reminderAt ? (
                <p className="memo-reminder-preview">
                  提醒时间：{formatMemoDateTime(draft.reminderAt)}
                </p>
              ) : (
                <p className="hint">
                  不填写则不提醒；支持“明天上午9点”“下周五 3 点”“10-20 15:30”等表达。
                </p>
              )}

              {!editingId ? (
                <label className="fl-switch memo-anchor-switch">
                  <input
                    type="checkbox"
                    checked={draft.anchor}
                    onChange={(event) => toggleAnchorNew(event.target.checked)}
                  />
                  <span className="fl-switch-track" aria-hidden="true" />
                  <span className="fl-switch-label">创建后锚定到桌面</span>
                </label>
              ) : null}

              <div className="form-actions">
                <Button variant="primary" type="submit" disabled={busy}>
                  {editingId ? '保存修改' : '添加备忘录'}
                </Button>
                <Button variant="ghost" onClick={cancelEdit} disabled={busy}>
                  取消
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div
          className="memo-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSettingsOpen(false)
            }
          }}
        >
          <div
            className="memo-modal memo-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memo-settings-title"
          >
            <div className="memo-modal-header">
              <h3 id="memo-settings-title">备忘录设置</h3>
              <IconButton label="关闭" onClick={() => setSettingsOpen(false)}>
                <span aria-hidden="true">×</span>
              </IconButton>
            </div>
            <div className="memo-setting-list">
              <div className="row">
                <span className="row-label">
                  <span>新增快捷键</span>
                  <InfoTip
                    text="按下组合键后打开设置并新建备忘录；点击右侧按钮录制，退格清除"
                    align="right"
                  />
                </span>
                <ShortcutInput value={memoShortcut} onSave={onSaveShortcut} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

interface MemoRowProps {
  memo: MemoSummary
  confirmDeleteId: string | null
  setConfirmDeleteId: (id: string | null) => void
  onEdit: () => void
  onToggleComplete: () => void
  onToggleAnchor: (anchored: boolean) => void
  onRemove: () => void
}

function MemoRow({
  memo,
  confirmDeleteId,
  setConfirmDeleteId,
  onEdit,
  onToggleComplete,
  onToggleAnchor,
  onRemove
}: MemoRowProps) {
  const excerpt = memoExcerpt(memo.text)
  return (
    <article className={`memo-card${memo.completed ? ' is-completed' : ''}`}>
      <button
        type="button"
        className="memo-card-main"
        onClick={onEdit}
        disabled={memo.completed}
        aria-label="编辑备忘录"
      >
        <span className="memo-card-title">{memoTitle(memo.text)}</span>
        {excerpt ? <span className="memo-card-excerpt">{excerpt}</span> : null}
        <span className="memo-card-meta">
          {memo.reminderAt ? (
            <Tag tone="warning">提醒 · {formatMemoDateTime(memo.reminderAt)}</Tag>
          ) : (
            <Tag tone="muted">无提醒</Tag>
          )}
          {memo.images.length > 0 ? <Tag tone="muted">{memo.images.length} 张图片</Tag> : null}
          {memo.completed ? (
            <Tag tone="success">已完成</Tag>
          ) : memo.anchored ? (
            <Tag tone="success">已锚定</Tag>
          ) : null}
        </span>
        {memo.completed && memo.completedAt ? (
          <span className="memo-card-completed">完成于 {formatMemoDateTime(memo.completedAt)}</span>
        ) : null}
      </button>

      <div className="row-actions">
        <IconButton
          label={memo.anchored ? '取消锚点' : '锚定到桌面'}
          aria-pressed={memo.anchored}
          disabled={memo.completed}
          className={memo.anchored ? 'is-active' : undefined}
          onClick={() => onToggleAnchor(!memo.anchored)}
        >
          <PinIcon active={memo.anchored} />
        </IconButton>
        <IconButton
          label={memo.completed ? '取消完成' : '完成'}
          aria-pressed={memo.completed}
          className={memo.completed ? 'is-active' : undefined}
          onClick={onToggleComplete}
        >
          <CheckIcon />
        </IconButton>
        {confirmDeleteId === memo.id ? (
          <>
            <Button variant="danger" onClick={onRemove}>
              确认删除
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
              取消
            </Button>
          </>
        ) : (
          <IconButton label="删除" tone="danger" onClick={() => setConfirmDeleteId(memo.id)}>
            <TrashIcon />
          </IconButton>
        )}
      </div>
    </article>
  )
}
