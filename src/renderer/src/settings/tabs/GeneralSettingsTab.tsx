import { useEffect, useState } from 'react'
import type { AppSettingsPatch, PublicConfig } from '../../../../shared/api'
import { Button } from '../../components/Button'
import { InfoTip } from '../../components/InfoTip'
import { BUBBLE_SECONDS_MAX, BUBBLE_SECONDS_MIN } from '../utils/constants'

interface Props {
  config: PublicConfig
  onSave: (patch: AppSettingsPatch) => void
  onImportImage: () => void
}

export function GeneralSettingsTab({ config, onSave, onImportImage }: Props) {
  const bubbleSeconds = Math.min(
    BUBBLE_SECONDS_MAX,
    Math.max(BUBBLE_SECONDS_MIN, Math.round(config.app.bubbleDurationMs / 1000))
  )
  const [bubbleDraft, setBubbleDraft] = useState(bubbleSeconds)

  useEffect(() => {
    setBubbleDraft(bubbleSeconds)
  }, [bubbleSeconds])

  function commitBubble(): void {
    if (bubbleDraft * 1000 !== config.app.bubbleDurationMs) {
      onSave({ bubbleDurationMs: bubbleDraft * 1000 })
    }
  }

  return (
    <section className="panel">
      <h2>常规</h2>

      <div className="row">
        <span className="row-label">
          <label htmlFor="setting-launch-at-login">开机自启</label>
          <InfoTip text="开机就会启动桌宠" />
        </span>
        <input
          id="setting-launch-at-login"
          type="checkbox"
          checked={config.app.launchAtLogin}
          onChange={(event) => onSave({ launchAtLogin: event.target.checked })}
        />
      </div>

      <div className="row">
        <span className="row-label">
          <label htmlFor="setting-always-on-top">始终置顶</label>
          <InfoTip text="总是会在其他窗口上面" />
        </span>
        <input
          id="setting-always-on-top"
          type="checkbox"
          checked={config.app.alwaysOnTop}
          onChange={(event) => onSave({ alwaysOnTop: event.target.checked })}
        />
      </div>

      <div className="row">
        <span className="row-label">
          <label htmlFor="setting-bounce-animation">抚摸效果</label>
          <InfoTip text="是否开启左键点击的桌宠Q弹效果" />
        </span>
        <input
          id="setting-bounce-animation"
          type="checkbox"
          checked={config.app.bounceAnimation}
          onChange={(event) => onSave({ bounceAnimation: event.target.checked })}
        />
      </div>

      <div className="row">
        <span className="row-label">
          <label htmlFor="setting-bubble-duration">气泡停留时长</label>
          <InfoTip text="控制各类信息气泡的展示时间" />
        </span>
        <span className="range-field">
          <input
            id="setting-bubble-duration"
            type="range"
            min={BUBBLE_SECONDS_MIN}
            max={BUBBLE_SECONDS_MAX}
            step={1}
            value={bubbleDraft}
            onChange={(event) => setBubbleDraft(Number(event.target.value))}
            onPointerUp={commitBubble}
            onKeyUp={commitBubble}
          />
          <span className="range-value">{bubbleDraft} 秒</span>
        </span>
      </div>

      <div className="row">
        <span className="row-label">
          <span>桌宠图片选择</span>
          <InfoTip text="推荐上传 15MB 内的透明底 png 图片" />
        </span>
        <Button variant="secondary" onClick={onImportImage}>
          选择图片
        </Button>
      </div>
    </section>
  )
}
