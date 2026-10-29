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
import { FormRow } from '../components/FormRow'
import { PageHeader } from '../components/PageHeader'
import { Section } from '../components/Section'
import { ShortcutInput } from '../components/ShortcutInput'
import { PetGallery } from '../components/PetGallery'
import { Toggle } from '../components/Toggle'
import {
  BUBBLE_SECONDS_MAX,
  BUBBLE_SECONDS_MIN,
  BUBBLE_SIZE_OPTIONS,
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
    <>
      <PageHeader title="常规" description="应用行为、桌宠显示与桌面形象。" />

      <Section title="应用行为">
        <FormRow
          label="开机自启"
          hint="登录 Windows 后自动启动花伴"
          htmlFor="setting-launch-at-login"
        >
          <Toggle
            id="setting-launch-at-login"
            ariaLabel="开机自启"
            checked={config.app.launchAtLogin}
            onChange={(checked) => onSave({ launchAtLogin: checked })}
          />
        </FormRow>

        <FormRow label="老板键" hint="按下后隐藏桌宠与托盘图标，再按一次恢复">
          <ShortcutInput
            value={config.app.bossShortcut}
            label="修改老板键"
            onSave={(accelerator) => onSave({ bossShortcut: accelerator })}
          />
        </FormRow>

        <FormRow
          label="气泡停留时长"
          hint="普通气泡自动关闭前的停留时间"
          htmlFor="setting-bubble-duration"
        >
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
        </FormRow>

        <FormRow label="气泡尺寸" hint="小、中、大只改变气泡大小；超级档改为屏幕顶部的大提示框">
          <div className="bubble-size-options" role="radiogroup" aria-label="气泡尺寸">
            {BUBBLE_SIZE_OPTIONS.map((option) => (
              <span
                key={option.id}
                className={`bubble-size-option${option.id === 'super' ? ' is-super' : ''}${
                  config.app.bubbleSize === option.id ? ' is-selected' : ''
                }`}
              >
                <label className="bubble-size-choice">
                  <input
                    type="radio"
                    className="bubble-size-radio"
                    name="bubble-size"
                    value={option.id}
                    checked={config.app.bubbleSize === option.id}
                    onChange={() => onSave({ bubbleSize: option.id })}
                  />
                  <span>{option.label}</span>
                </label>
                {option.id === 'super' ? (
                  <InfoTip text="侵入性极强的提醒，超超超大！" align="left" />
                ) : null}
              </span>
            ))}
          </div>
        </FormRow>
      </Section>

      <Section title="桌宠显示">
        <FormRow label="始终置顶" hint="桌宠始终显示在普通窗口上方" htmlFor="setting-always-on-top">
          <Toggle
            id="setting-always-on-top"
            ariaLabel="始终置顶"
            checked={config.app.alwaysOnTop}
            onChange={(checked) => onSave({ alwaysOnTop: checked })}
          />
        </FormRow>

        <FormRow
          label="抚摸效果"
          hint="左键点击桌宠时播放 Q 弹反馈"
          htmlFor="setting-bounce-animation"
        >
          <Toggle
            id="setting-bounce-animation"
            ariaLabel="抚摸效果"
            checked={config.app.bounceAnimation}
            onChange={(checked) => onSave({ bounceAnimation: checked })}
          />
        </FormRow>

        <FormRow label="缩放比例" hint="只影响桌面显示大小，不改变原图" htmlFor="setting-pet-scale">
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
        </FormRow>
      </Section>

      <Section
        title="桌宠形象"
        description="支持 15MB 内的 PNG/JPEG，透明底 PNG 效果最佳。"
        actions={
          <Button variant="secondary" onClick={onImportImage}>
            选择图片
          </Button>
        }
      >
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
      </Section>
    </>
  )
}
