import type { PublicConfig } from '../../../../shared/api'
import { Button } from '../../components/Button'
import type { useAppearanceSettings } from '../hooks/useAppearanceSettings'
import { SCALE_MAX, SCALE_MIN, SCALE_STEP } from '../utils/constants'

type AppearanceModel = ReturnType<typeof useAppearanceSettings>

interface Props {
  config: PublicConfig
  model: AppearanceModel
}

export function AppearanceSettingsTab({ config, model }: Props) {
  const { scaleDraft, handleScaleChange, handleScaleCommit, importImage, resetPosition } = model

  return (
    <section className="panel">
      <h2>外观</h2>
      <div className="appearance">
        <div className="pet-preview">
          <img src={`flowerbuddy-pet://asset/${config.pet.assetId}`} alt="当前桌宠形象" />
        </div>
        <div className="appearance-controls">
          <label className="row">
            <span>缩放 {scaleDraft.toFixed(1)}×</span>
            <input
              type="range"
              min={SCALE_MIN}
              max={SCALE_MAX}
              step={SCALE_STEP}
              value={scaleDraft}
              onChange={(event) => handleScaleChange(Number(event.target.value))}
              onPointerUp={handleScaleCommit}
              onKeyUp={handleScaleCommit}
            />
          </label>
          <div className="button-row">
            <Button variant="primary" onClick={() => void importImage()}>
              导入 PNG 图片
            </Button>
            <Button variant="secondary" onClick={() => void resetPosition()}>
              重置位置
            </Button>
          </div>
          <p className="hint">
            支持透明 PNG，最大 15 MB；图片保存在应用用户数据目录，不会上传到任何外部服务。
          </p>
        </div>
      </div>
    </section>
  )
}
