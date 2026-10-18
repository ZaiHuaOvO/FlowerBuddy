import { useEffect, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { MemoImageInfo, MemoSummary } from '../../../../shared/api'
import {
  formatReminderDateTime,
  parseReminderDateTime,
  parseReminderInput
} from '../../../../shared/memo-reminder'
import { mergeMemoOrder } from '../utils/memo-order'
import { formatMemoDateTime, toMessage } from '../utils/formatters'
import type { SettingsApi } from '../types'

const MAX_IMAGES = 9
const MAX_IMAGE_DIMENSION = 4096

export interface MemoDraft {
  text: string
  images: MemoImageInfo[]
  reminderText: string
  reminderAt: string | null
  reminderError: string
}

interface Options {
  api: SettingsApi | undefined
  memos: MemoSummary[]
  setMemos: Dispatch<SetStateAction<MemoSummary[]>>
  flash: (message: string) => void
  setError: (message: string) => void
  composeSignal: number
  listVisible: boolean
}

export function createMemoDraft(): MemoDraft {
  return { text: '', images: [], reminderText: '', reminderAt: null, reminderError: '' }
}

export function useMemoSettings({
  api,
  memos,
  setMemos,
  flash,
  setError,
  composeSignal,
  listVisible
}: Options) {
  const [draft, setDraft] = useState<MemoDraft>(createMemoDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const newImageIds = useRef<Set<string>>(new Set())
  const newImageIdsSnapshot = useRef(newImageIds.current)
  const lastComposeSignal = useRef(composeSignal)
  const wasVisible = useRef(false)

  useEffect(() => {
    if (listVisible && !wasVisible.current) {
      void api
        ?.listMemos()
        .then(setMemos)
        .catch((cause: unknown) => setError(toMessage(cause)))
    }
    wasVisible.current = listVisible
  }, [api, listVisible, setError, setMemos])

  useEffect(() => {
    return () => {
      if (api && newImageIdsSnapshot.current.size > 0) {
        void api.discardMemoImages([...newImageIdsSnapshot.current])
      }
    }
  }, [api])

  useEffect(() => {
    if (composeSignal !== lastComposeSignal.current) {
      lastComposeSignal.current = composeSignal
      if (api && newImageIds.current.size > 0) {
        void api.discardMemoImages([...newImageIds.current])
      }
      newImageIds.current = new Set()
      newImageIdsSnapshot.current = newImageIds.current
      setDraft(createMemoDraft())
      setEditingId(null)
      setConfirmDeleteId(null)
      setEditorOpen(true)
    }
  }, [api, composeSignal])

  function releaseDraftImages(): void {
    if (api && newImageIds.current.size > 0) {
      void api.discardMemoImages([...newImageIds.current])
    }
    newImageIds.current = new Set()
    newImageIdsSnapshot.current = newImageIds.current
  }

  function startNew(): void {
    releaseDraftImages()
    setDraft(createMemoDraft())
    setEditingId(null)
    setConfirmDeleteId(null)
    setEditorOpen(true)
  }

  function startEdit(memo: MemoSummary): void {
    if (memo.completed) {
      return
    }
    releaseDraftImages()
    setDraft({
      text: memo.text,
      images: memo.images,
      reminderText: memo.reminderAt ? formatMemoDateTime(memo.reminderAt) : '',
      reminderAt: memo.reminderAt,
      reminderError: ''
    })
    setEditingId(memo.id)
    setConfirmDeleteId(null)
    setEditorOpen(true)
  }

  function cancelEdit(): void {
    releaseDraftImages()
    setDraft(createMemoDraft())
    setEditingId(null)
    setEditorOpen(false)
  }

  function updateReminderText(value: string): void {
    const trimmed = value.trim()
    if (!trimmed) {
      setDraft((current) => ({
        ...current,
        reminderText: value,
        reminderAt: null,
        reminderError: ''
      }))
      return
    }
    const parsed = parseReminderInput(value)
    setDraft((current) => ({
      ...current,
      reminderText: value,
      reminderAt: parsed ? parsed.at.toISOString() : null,
      reminderError: parsed ? '' : '无法识别这个时间表达'
    }))
  }

  function setReminderFromPicker(localValue: string): void {
    const date = parseReminderDateTime(localValue)
    if (!date) {
      return
    }
    setDraft((current) => ({
      ...current,
      reminderText: formatReminderDateTime(date),
      reminderAt: date.toISOString(),
      reminderError: ''
    }))
  }

  async function addPastedImages(files: File[]): Promise<void> {
    if (!api) {
      return
    }
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) {
      return
    }
    const available = MAX_IMAGES - draft.images.length
    if (available <= 0) {
      setError(`每条备忘录最多 ${MAX_IMAGES} 张图片`)
      return
    }
    const accepted = images.slice(0, available)
    for (const file of accepted) {
      try {
        const buffer = await imageToPng(file)
        const info = await api.addMemoImage(buffer)
        newImageIds.current.add(info.id)
        newImageIdsSnapshot.current = newImageIds.current
        setDraft((current) =>
          current.images.length >= MAX_IMAGES
            ? current
            : { ...current, images: [...current.images, info] }
        )
      } catch (cause) {
        setError(toMessage(cause) || '无法读取粘贴的图片')
      }
    }
    if (images.length > available) {
      setError(`每条备忘录最多 ${MAX_IMAGES} 张图片`)
    }
  }

  function removeImage(id: string): void {
    setDraft((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== id)
    }))
    if (newImageIds.current.delete(id)) {
      newImageIdsSnapshot.current = newImageIds.current
      void api?.discardMemoImages([id])
    }
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api) {
      return
    }
    setError('')
    if (draft.reminderText.trim() && !draft.reminderAt) {
      setDraft((current) => ({ ...current, reminderError: '无法识别这个时间表达' }))
      return
    }
    if (draft.text.trim().length === 0 && draft.images.length === 0) {
      setError('备忘录不能为空')
      return
    }
    setBusy(true)
    try {
      const input = {
        text: draft.text,
        images: draft.images,
        reminderAt: draft.reminderAt
      }
      const next = editingId ? await api.updateMemo(editingId, input) : await api.createMemo(input)
      setMemos(next)
      newImageIds.current = new Set()
      newImageIdsSnapshot.current = newImageIds.current
      setDraft(createMemoDraft())
      setEditingId(null)
      setEditorOpen(false)
      flash(editingId ? '已保存' : '已添加备忘录')
    } catch (cause) {
      setError(toMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function complete(id: string): Promise<void> {
    if (!api) {
      return
    }
    try {
      const next = await api.completeMemo(id)
      setMemos((current) => mergeMemoOrder(current, next))
      if (editingId === id) {
        cancelEdit()
      }
      flash('已完成')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function uncomplete(id: string): Promise<void> {
    if (!api) {
      return
    }
    try {
      const next = await api.uncompleteMemo(id)
      setMemos((current) => mergeMemoOrder(current, next))
      flash('已取消完成')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function toggleAnchor(id: string, anchored: boolean): Promise<void> {
    if (!api) {
      return
    }
    try {
      const next = await api.setMemoAnchored(id, anchored)
      setMemos((current) => mergeMemoOrder(current, next))
      flash(anchored ? '已锚定到桌面' : '已取消锚定')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function remove(id: string): Promise<void> {
    if (!api) {
      return
    }
    try {
      const next = await api.deleteMemo(id)
      setMemos((current) => mergeMemoOrder(current, next))
      setConfirmDeleteId(null)
      if (editingId === id) {
        cancelEdit()
      }
      flash('已删除')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  return {
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
    toggleAnchor,
    remove
  }
}

async function imageToPng(file: File): Promise<ArrayBuffer> {
  const bitmap = await createImageBitmap(file)
  if (bitmap.width > MAX_IMAGE_DIMENSION || bitmap.height > MAX_IMAGE_DIMENSION) {
    bitmap.close()
    throw new Error('图片尺寸不能超过 4096px')
  }
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('无法处理这张图片')
  }
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) {
    throw new Error('无法处理这张图片')
  }
  return blob.arrayBuffer()
}
