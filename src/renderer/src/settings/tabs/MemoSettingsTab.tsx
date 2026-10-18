import { useEffect, useRef } from 'react'
import type { MemoSummary } from '../../../../shared/api'
import { memoImageUrl } from '../../../../shared/api'
import { formatMemoDateTime, memoExcerpt, memoTitle } from '../utils/formatters'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { IconButton } from '../../components/IconButton'
import { Tag } from '../../components/Tag'
import type { useMemoSettings } from '../hooks/useMemoSettings'

type MemoModel = ReturnType<typeof useMemoSettings>

interface Props {
  model: MemoModel
  composeSignal: number
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

function toLocalInputValue(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function MemoSettingsTab({ model, composeSignal }: Props) {
  const {
    memos,
    draft,
    setDraft,
    editingId,
    confirmDeleteId,
    setConfirmDeleteId,
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
    toggleAnchor,
    remove
  } = model
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pickerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (composeSignal > 0 && !editingId) {
      textareaRef.current?.focus()
      textareaRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [composeSignal, editingId])

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
        <h2>备忘录</h2>
        <Button variant="secondary" onClick={startNew}>
          新建备忘录
        </Button>
      </div>
      <p className="hint">
        支持普通文本与粘贴图片；图片只保存在本机。设置提醒后，到点会通过桌宠气泡提醒。
      </p>

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
            placeholder="提醒时间，例如：明天上午9点 / 2026-10-20 15:30"
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
          <p className="memo-reminder-preview">提醒时间：{formatMemoDateTime(draft.reminderAt)}</p>
        ) : (
          <p className="hint">不填写则不提醒；支持“明天上午9点”“下周一 15:30”等表达。</p>
        )}

        <div className="form-actions">
          <Button variant="primary" type="submit" disabled={busy}>
            {editingId ? '保存修改' : '添加备忘录'}
          </Button>
          {editingId ? (
            <Button variant="ghost" onClick={cancelEdit} disabled={busy}>
              取消
            </Button>
          ) : null}
        </div>
      </form>

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
              onComplete={() => void complete(memo.id)}
              onToggleAnchor={(anchored) => void toggleAnchor(memo.id, anchored)}
              onRemove={() => void remove(memo.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

interface MemoRowProps {
  memo: MemoSummary
  confirmDeleteId: string | null
  setConfirmDeleteId: (id: string | null) => void
  onEdit: () => void
  onComplete: () => void
  onToggleAnchor: (anchored: boolean) => void
  onRemove: () => void
}

function MemoRow({
  memo,
  confirmDeleteId,
  setConfirmDeleteId,
  onEdit,
  onComplete,
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
        <IconButton label="完成" disabled={memo.completed} onClick={onComplete}>
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
