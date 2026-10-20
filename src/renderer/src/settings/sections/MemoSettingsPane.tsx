import { Button } from '../../components/Button'
import { InfoTip } from '../../components/InfoTip'
import { ShortcutInput } from '../components/ShortcutInput'

interface Props {
  memoShortcut: string
  anchorNewMemos: boolean
  onSaveShortcut: (accelerator: string) => void
  onSaveAnchorNew: (enabled: boolean) => void
  onGoToFunction: () => void
}

export function MemoSettingsPane({
  memoShortcut,
  anchorNewMemos,
  onSaveShortcut,
  onSaveAnchorNew,
  onGoToFunction
}: Props) {
  return (
    <section className="panel">
      <div className="panel-header-row">
        <h2>备忘录设置</h2>
        <Button variant="secondary" onClick={onGoToFunction}>
          前往功能页
        </Button>
      </div>
      <div className="memo-setting-list">
        <div className="row">
          <span className="row-label">
            <span>新增快捷键</span>
            <InfoTip
              text="按下组合键后打开功能页并新建备忘录；点击右侧按钮录制，退格清除"
              align="right"
            />
          </span>
          <ShortcutInput value={memoShortcut} onSave={onSaveShortcut} />
        </div>
        <div className="row">
          <span className="row-label">
            <span>创建后锚定到桌面</span>
            <InfoTip text="新建备忘录时默认勾选“创建后锚定到桌面”" align="right" />
          </span>
          <label className="fl-switch">
            <input
              type="checkbox"
              checked={anchorNewMemos}
              onChange={(event) => onSaveAnchorNew(event.target.checked)}
            />
            <span className="fl-switch-track" aria-hidden="true" />
          </label>
        </div>
      </div>
    </section>
  )
}
