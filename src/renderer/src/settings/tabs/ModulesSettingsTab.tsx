import { useState } from 'react'
import { GripVertical } from 'lucide-react'
import type { ModuleId, ModuleSummary, SecurityStatus } from '../../../../shared/api'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { InfoTip } from '../../components/InfoTip'
import { PageHeader } from '../components/PageHeader'

interface Props {
  modules: ModuleSummary[]
  security: SecurityStatus | null
  onToggle: (moduleId: ModuleId, enabled: boolean) => void
  onReorder: (order: ModuleId[]) => void
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
    <>
      <PageHeader title="功能管理" description="启用需要的功能，并拖动已启用项调整导航顺序。" />

      {security && !security.encryptionAvailable && security.message ? (
        <Alert tone="warning" className="module-security-alert">
          {security.message}
        </Alert>
      ) : null}

      <div className="module-columns">
        <section className="module-column">
          <header className="module-column-header">
            <h3>已启用</h3>
            <span className="module-count">{enabled.length}</span>
          </header>
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
                    <GripVertical
                      className="module-drag-handle"
                      size={14}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span className="module-row-name">{module.name}</span>
                    <InfoTip text={module.description} align="right" />
                  </span>
                  <Button
                    variant="ghost"
                    className="module-row-action"
                    onClick={() => onToggle(module.id, false)}
                  >
                    停用
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="module-column">
          <header className="module-column-header">
            <h3>已停用</h3>
            <span className="module-count">{disabled.length}</span>
          </header>
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
                  <Button
                    variant="secondary"
                    className="module-row-action"
                    onClick={() => onToggle(module.id, true)}
                  >
                    启用
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="page-footnote">
        停用功能会隐藏入口但保留数据；重新启用后会追加到已启用列表末尾。
      </p>
    </>
  )
}
