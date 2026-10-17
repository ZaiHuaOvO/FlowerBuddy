import type { AppSettingsPatch, PublicConfig } from '../../../../shared/api'
import { BUBBLE_DURATION_OPTIONS } from '../utils/constants'

interface Props {
  config: PublicConfig
  onSave: (patch: AppSettingsPatch) => void
}

export function GeneralSettingsTab({ config, onSave }: Props) {
  return (
    <section className="panel">
      <h2>常规</h2>
      <label className="row">
        <span>始终置顶</span>
        <input
          type="checkbox"
          checked={config.app.alwaysOnTop}
          onChange={(event) => onSave({ alwaysOnTop: event.target.checked })}
        />
      </label>
      <label className="row">
        <span>点击弹跳动画</span>
        <input
          type="checkbox"
          checked={config.app.bounceAnimation}
          onChange={(event) => onSave({ bounceAnimation: event.target.checked })}
        />
      </label>
      <label className="row">
        <span>气泡停留时长</span>
        <select
          className="fl-select"
          value={config.app.bubbleDurationMs}
          onChange={(event) => onSave({ bubbleDurationMs: Number(event.target.value) })}
        >
          {BUBBLE_DURATION_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value / 1000} 秒
            </option>
          ))}
        </select>
      </label>
      <label className="row">
        <span>开机启动</span>
        <input
          type="checkbox"
          checked={config.app.launchAtLogin}
          onChange={(event) => onSave({ launchAtLogin: event.target.checked })}
        />
      </label>
      <label className="row">
        <span>启动时显示桌宠</span>
        <input
          type="checkbox"
          checked={config.app.showPetOnStartup}
          onChange={(event) => onSave({ showPetOnStartup: event.target.checked })}
        />
      </label>
    </section>
  )
}
