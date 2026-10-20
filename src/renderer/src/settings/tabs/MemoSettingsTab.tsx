import { useEffect, useRef } from 'react'
import type { MemoSummary } from '../../../../shared/api'
import { memoImageUrl } from '../../../../shared/api'
import { formatMemoDateTime, memoExcerpt, memoTitle } from '../utils/formatters'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { IconButton } from '../../components/IconButton'
import { Tag } from '../../components/Tag'
import { useTooltip } from '../../components/Tooltip'
import { MemoReminderPicker } from '../components/MemoReminderPicker'
import type { useMemoSettings } from '../hooks/useMemoSettings'

type MemoModel = ReturnType<typeof useMemoSettings>

interface Props {
  model: MemoModel
  onOpenSettings: () => void
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

function LinesIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d="m2.2 3.9 1.1 1.1 1.9-2.2M2.2 7.9l1.1 1.1 1.9-2.2M2.2 11.9l1.1 1.1 1.9-2.2M8.2 4.4h5.6M8.2 8.4h5.6M8.2 12.4h5.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 1.6 : 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
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

export function MemoSettingsTab({ model, onOpenSettings }: Props) {
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
    toggleDraftLineTasks,
    toggleAnchor,
    toggleMemoLineTasks,
    remove
  } = model
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const reminderTip =
    draft.reminderError ||
    (draft.reminderAt ? `提醒时间：${formatMemoDateTime(draft.reminderAt)}` : '')
  const reminderTooltip = useTooltip<HTMLInputElement>(reminderTip, 'right', {
    persistent: Boolean(draft.reminderAt)
  })

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

  return (
    <section className="panel memo-panel">
      <div className="memo-header">
        <div className="memo-title-group">
          <h2>备忘录</h2>
          <IconButton label="打开备忘录设置" onClick={onOpenSettings}>
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
              onToggleLineTasks={(enabled) => void toggleMemoLineTasks(memo.id, enabled)}
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
                  ref={reminderTooltip.triggerRef}
                  {...reminderTooltip.handlers}
                  className={`fl-input memo-reminder-input${draft.reminderError ? ' is-invalid' : ''}`}
                  value={draft.reminderText}
                  placeholder="提醒时间，例如：下周五 3 点 / 2026-10-20 15:30"
                  onChange={(event) => updateReminderText(event.target.value)}
                />
                {reminderTooltip.layer}
                <MemoReminderPicker
                  value={draft.reminderAt}
                  onSelect={setReminderFromPicker}
                  onClear={() => updateReminderText('')}
                />
              </div>

              <div className="memo-editor-footer">
                <div className="memo-editor-switches">
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
                  <label className="fl-switch memo-anchor-switch">
                    <input
                      type="checkbox"
                      checked={draft.lineTasks}
                      onChange={(event) => toggleDraftLineTasks(event.target.checked)}
                    />
                    <span className="fl-switch-track" aria-hidden="true" />
                    <span className="fl-switch-label">逐行打勾</span>
                  </label>
                </div>
                <div className="form-actions memo-form-actions">
                  <Button variant="primary" type="submit" disabled={busy}>
                    {editingId ? '保存修改' : '添加备忘录'}
                  </Button>
                  <Button variant="ghost" onClick={cancelEdit} disabled={busy}>
                    取消
                  </Button>
                </div>
              </div>
            </form>
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
  onToggleLineTasks: (enabled: boolean) => void
  onRemove: () => void
}

function MemoRow({
  memo,
  confirmDeleteId,
  setConfirmDeleteId,
  onEdit,
  onToggleComplete,
  onToggleAnchor,
  onToggleLineTasks,
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
          {memo.completed ? <Tag tone="success">已完成</Tag> : null}
        </span>
        {memo.completed && memo.completedAt ? (
          <span className="memo-card-completed">完成于 {formatMemoDateTime(memo.completedAt)}</span>
        ) : null}
      </button>

      <div className="row-actions">
        <IconButton
          label={memo.lineTasksEnabled ? '关闭逐行打勾' : '开启逐行打勾'}
          aria-pressed={memo.lineTasksEnabled}
          disabled={memo.completed}
          className={memo.lineTasksEnabled ? 'is-active' : undefined}
          onClick={() => onToggleLineTasks(!memo.lineTasksEnabled)}
        >
          <LinesIcon active={memo.lineTasksEnabled} />
        </IconButton>
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
