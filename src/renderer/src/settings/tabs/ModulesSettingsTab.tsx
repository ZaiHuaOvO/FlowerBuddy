import type { ModuleId, ModuleSummary, SecurityStatus } from '../../../../shared/api'
import { Tag } from '../../components/Tag'
import { tagTone } from '../utils/formatters'

interface Props {
  modules: ModuleSummary[]
  security: SecurityStatus | null
  onToggle: (moduleId: ModuleId, enabled: boolean) => void
}

export function ModulesSettingsTab({ modules, security, onToggle }: Props) {
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
      <div className="module-list">
        {modules.map((module) => (
          <div className="module-card" key={module.id} data-module={module.id}>
            <div className="module-main">
              <div className="module-title-row">
                <span className="module-name">{module.name}</span>
                <Tag tone={tagTone(module.status)}>{module.statusLabel}</Tag>
              </div>
              <p className="hint">{module.description}</p>
            </div>
            <label className="module-switch">
              <input
                type="checkbox"
                checked={module.enabled}
                onChange={(event) => onToggle(module.id, event.target.checked)}
              />
              <span>{module.enabled ? '已启用' : '已停用'}</span>
            </label>
          </div>
        ))}
      </div>
      <p className="hint">开关立即生效；未配置或尚未实现的模块不会发起任何后台请求。</p>
    </section>
  )
}
