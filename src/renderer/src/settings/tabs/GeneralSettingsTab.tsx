import { useEffect, useState } from 'react'
import { petAssetUrl } from '../../../../shared/api'
import type {
  AppSettingsPatch,
  PetSettingsPatch,
  PetUserImage,
  PublicConfig
} from '../../../../shared/api'
import { PET_BASE_HEIGHT } from '../../../../shared/pet-layout'
import { Button } from '../../components/Button'
import { InfoTip } from '../../components/InfoTip'
import { ShortcutInput } from '../components/ShortcutInput'
import { PetGallery } from '../components/PetGallery'
import {
  BUBBLE_SECONDS_MAX,
  BUBBLE_SECONDS_MIN,
  PET_SCALE_MAX,
  PET_SCALE_MIN,
  PET_SCALE_STEP
} from '../utils/constants'

interface Props {
  config: PublicConfig
  userImages: PetUserImage[]
  onSave: (patch: AppSettingsPatch) => void
  onSavePet: (patch: PetSettingsPatch) => void
  onImportImage: () => void
  onSelectAsset: (assetId: string) => Promise<void>
  onDeleteImage: (assetId: string) => Promise<void>
  onRenameImage: (assetId: string, name: string) => Promise<void>
}

export function GeneralSettingsTab({
  config,
  userImages,
  onSave,
  onSavePet,
  onImportImage,
  onSelectAsset,
  onDeleteImage,
  onRenameImage
}: Props) {
  const bubbleSeconds = Math.min(
    BUBBLE_SECONDS_MAX,
    Math.max(BUBBLE_SECONDS_MIN, Math.round(config.app.bubbleDurationMs / 1000))
  )
  const petScale = Math.min(PET_SCALE_MAX, Math.max(PET_SCALE_MIN, config.pet.scale))
  const [bubbleDraft, setBubbleDraft] = useState(bubbleSeconds)
  const [scaleDraft, setScaleDraft] = useState(petScale)

  useEffect(() => {
    setBubbleDraft(bubbleSeconds)
  }, [bubbleSeconds])

  useEffect(() => {
    setScaleDraft(petScale)
  }, [petScale])

  function commitBubble(): void {
    if (bubbleDraft * 1000 !== config.app.bubbleDurationMs) {
      onSave({ bubbleDurationMs: bubbleDraft * 1000 })
    }
  }

  function commitScale(): void {
    if (Math.abs(scaleDraft - config.pet.scale) > 0.001) {
      onSavePet({ scale: scaleDraft })
    }
  }

  return (
    <section className="panel">
      <h2>常规</h2>

      <div className="row">
        <span className="row-label">
          <label htmlFor="setting-launch-at-login">开机自启</label>
          <InfoTip text="开机就会启动桌宠" align="right" />
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
          <InfoTip text="总是会在其他窗口上面" align="right" />
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
          <InfoTip text="是否开启左键点击的桌宠Q弹效果" align="right" />
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
          <span>老板键</span>
          <InfoTip text="按下后隐藏桌宠和托盘图标，再按一次恢复" align="right" />
        </span>
        <ShortcutInput
          value={config.app.bossShortcut}
          label="修改老板键"
          onSave={(accelerator) => onSave({ bossShortcut: accelerator })}
        />
      </div>

      <div className="row">
        <span className="row-label">
          <label htmlFor="setting-bubble-duration">气泡停留时长</label>
          <InfoTip text="控制各类信息气泡的展示时间" align="right" />
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
          <InfoTip text="支持 15MB 内的 PNG/JPEG 图片，透明底 PNG 效果最佳" align="right" />
        </span>
        <Button variant="secondary" onClick={onImportImage}>
          选择图片
        </Button>
      </div>

      <div className="row">
        <span className="row-label">
          <label htmlFor="setting-pet-scale">缩放比例</label>
          <InfoTip text="调整桌宠在桌面上的显示大小" align="right" />
        </span>
        <span className="range-field">
          <input
            id="setting-pet-scale"
            type="range"
            min={PET_SCALE_MIN}
            max={PET_SCALE_MAX}
            step={PET_SCALE_STEP}
            value={scaleDraft}
            onChange={(event) => setScaleDraft(Number(event.target.value))}
            onPointerUp={commitScale}
            onKeyUp={commitScale}
          />
          <span className="range-value">{scaleDraft.toFixed(1)}×</span>
        </span>
      </div>

      <PetGallery
        currentAssetId={config.pet.assetId}
        userImages={userImages}
        onSelect={onSelectAsset}
        onDelete={onDeleteImage}
        onRename={onRenameImage}
      />

      <div className="pet-preview">
        <img
          className="pet-preview-image"
          src={petAssetUrl(config.pet.assetId)}
          alt="桌宠预览"
          style={{ height: `${Math.round(PET_BASE_HEIGHT * scaleDraft)}px` }}
          draggable={false}
        />
      </div>
    </section>
  )
}
