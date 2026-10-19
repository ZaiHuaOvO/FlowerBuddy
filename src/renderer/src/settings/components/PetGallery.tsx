import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { MAX_PET_NAME_LENGTH, petAssetUrl } from '../../../../shared/api'
import type { PetUserImage } from '../../../../shared/api'
import { PET_PRESETS } from '../../../../shared/pet-presets'

interface Props {
  currentAssetId: string
  userImages: PetUserImage[]
  onSelect: (assetId: string) => Promise<void>
  onDelete: (assetId: string) => Promise<void>
  onRename: (assetId: string, name: string) => Promise<void>
}

interface CardProps {
  assetId: string
  label: string
  selected: boolean
  disabled: boolean
  onSelect: (assetId: string) => Promise<void>
  onDelete?: (assetId: string) => Promise<void>
  rename?: {
    editing: boolean
    draft: string
    fallbackLabel: string
    onStart: () => void
    onChange: (value: string) => void
    onCommit: () => void
    onCancel: () => void
  }
}

function PetGalleryCard({
  assetId,
  label,
  selected,
  disabled,
  onSelect,
  onDelete,
  rename
}: CardProps) {
  const editing = rename?.editing ?? false

  return (
    <div
      className={`pet-gallery-card${selected ? ' is-selected' : ''}${editing ? ' is-editing' : ''}`}
      role="listitem"
      onContextMenu={
        rename
          ? (event) => {
              event.preventDefault()
              rename.onStart()
            }
          : undefined
      }
    >
      <button
        type="button"
        className="pet-gallery-select"
        aria-pressed={selected}
        disabled={disabled}
        onClick={() => void onSelect(assetId)}
      >
        <span className="pet-gallery-thumb">
          <img src={petAssetUrl(assetId)} alt="" draggable={false} />
        </span>
        <span className={`pet-gallery-label${editing ? ' is-editing' : ''}`}>{label}</span>
      </button>
      {rename && editing ? (
        <input
          className="pet-gallery-name-input"
          value={rename.draft}
          maxLength={MAX_PET_NAME_LENGTH}
          placeholder={rename.fallbackLabel}
          aria-label="桌宠名称"
          autoFocus
          onChange={(event) => rename.onChange(event.target.value)}
          onBlur={rename.onCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              rename.onCancel()
            }
          }}
        />
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="pet-gallery-delete"
          aria-label={`删除${label}`}
          title="删除"
          disabled={disabled}
          onClick={() => void onDelete(assetId)}
        >
          <X size={12} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export function PetGallery({ currentAssetId, userImages, onSelect, onDelete, onRename }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const cancelRename = useRef(false)

  async function select(assetId: string): Promise<void> {
    if (busyId || assetId === currentAssetId) {
      return
    }
    setBusyId(assetId)
    try {
      await onSelect(assetId)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(assetId: string): Promise<void> {
    if (busyId) {
      return
    }
    setBusyId(assetId)
    try {
      await onDelete(assetId)
    } finally {
      setBusyId(null)
    }
  }

  function startRename(image: PetUserImage, fallbackLabel: string): void {
    if (busyId) {
      return
    }
    cancelRename.current = false
    setEditingId(image.assetId)
    setDraft(image.name ?? fallbackLabel)
  }

  function commitRename(assetId: string, fallbackLabel: string): void {
    if (cancelRename.current) {
      cancelRename.current = false
      return
    }
    const trimmed = draft.trim()
    setEditingId(null)
    setDraft('')
    void onRename(assetId, trimmed === fallbackLabel ? '' : trimmed)
  }

  function cancelEditing(): void {
    cancelRename.current = true
    setEditingId(null)
    setDraft('')
  }

  return (
    <div className="pet-gallery" role="list" aria-label="桌宠形象">
      {PET_PRESETS.map((preset) => (
        <PetGalleryCard
          key={preset.id}
          assetId={preset.id}
          label={preset.label}
          selected={preset.id === currentAssetId}
          disabled={busyId !== null}
          onSelect={select}
        />
      ))}
      {userImages.map((image, index) => {
        const fallbackLabel = `自定义 ${index + 1}`
        return (
          <PetGalleryCard
            key={image.assetId}
            assetId={image.assetId}
            label={image.name ?? fallbackLabel}
            selected={image.assetId === currentAssetId}
            disabled={busyId !== null}
            onSelect={select}
            onDelete={remove}
            rename={{
              editing: editingId === image.assetId,
              draft,
              fallbackLabel,
              onStart: () => startRename(image, fallbackLabel),
              onChange: setDraft,
              onCommit: () => commitRename(image.assetId, fallbackLabel),
              onCancel: cancelEditing
            }}
          />
        )
      })}
    </div>
  )
}
