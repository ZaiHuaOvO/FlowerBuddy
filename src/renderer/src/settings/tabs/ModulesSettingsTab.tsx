import { useState } from 'react'
import type { ModuleId, ModuleSummary, SecurityStatus } from '../../../../shared/api'
import { IconButton } from '../../components/IconButton'
import { InfoTip } from '../../components/InfoTip'

interface Props {
  modules: ModuleSummary[]
  security: SecurityStatus | null
  onToggle: (moduleId: ModuleId, enabled: boolean) => void
  onReorder: (order: ModuleId[]) => void
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

function EnableIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 5.2v5.6M5.2 8h5.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ModulesSettingsTab({ modules, security, onToggle, onReorder }: Props) {
  const [draggingId, setDraggingId] = useState<ModuleId | null>(null)
  const [dragOverId, setDragOverId] = useState<ModuleId | null>(null)
  const enabled = modules.filter((module) => module.enabled)
  const disabled = modules.filter((module) => !module.enabled)

  function reorder(targetId: ModuleId): void {
    if (!draggingId || draggingId === targetId) {
      return
    }
    const order = enabled.map((module) => module.id)
    const from = order.indexOf(draggingId)
    const to = order.indexOf(targetId)
    if (from < 0 || to < 0) {
      return
    }
    order.splice(from, 1)
    order.splice(to, 0, draggingId)
    onReorder(order)
  }

  function clearDrag(): void {
    setDraggingId(null)
    setDragOverId(null)
  }

  return (
    <section className="panel">
      <h2>功能管理</h2>
      {security && !security.encryptionAvailable && security.message ? (
        <div className="fl-alert fl-alert-warning module-security-alert" role="status">
          <span className="fl-alert-icon" aria-hidden="true">
            !
          </span>
          <span className="fl-alert-message">{security.message}</span>
        </div>
      ) : null}

      <div className="module-columns">
        <div className="module-column">
          <h3 className="module-column-title">已启用</h3>
          {enabled.length === 0 ? (
            <p className="hint">暂无已启用的功能。</p>
          ) : (
            <ul className="module-list">
              {enabled.map((module) => (
                <li
                  key={module.id}
                  className={`module-row${draggingId === module.id ? ' is-dragging' : ''}${
                    dragOverId === module.id ? ' is-drag-over' : ''
                  }`}
                  draggable
                  onDragStart={(event) => {
                    setDraggingId(module.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', module.id)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDragOverId(module.id)
                  }}
                  onDragLeave={() =>
                    setDragOverId((current) => (current === module.id ? null : current))
                  }
                  onDrop={(event) => {
                    event.preventDefault()
                    reorder(module.id)
                    clearDrag()
                  }}
                  onDragEnd={clearDrag}
                >
                  <span className="module-row-main">
                    <span className="module-row-name">{module.name}</span>
                    <InfoTip text={module.description} align="right" />
                  </span>
                  <IconButton label="停用" tone="danger" onClick={() => onToggle(module.id, false)}>
                    <TrashIcon />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="module-column">
          <h3 className="module-column-title">已停用</h3>
          {disabled.length === 0 ? (
            <p className="hint">所有功能均已启用。</p>
          ) : (
            <ul className="module-list">
              {disabled.map((module) => (
                <li key={module.id} className="module-row is-disabled">
                  <span className="module-row-main">
                    <span className="module-row-name">{module.name}</span>
                    <InfoTip text={module.description} align="left" />
                  </span>
                  <IconButton label="启用" onClick={() => onToggle(module.id, true)}>
                    <EnableIcon />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="hint">已启用功能可拖拽排序</p>
    </section>
  )
}
