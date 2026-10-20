import { Button } from '../../components/Button'
import { InfoTip } from '../../components/InfoTip'
import { ShortcutInput } from '../components/ShortcutInput'

interface Props {
  memoShortcut: string
  anchorNewMemos: boolean
  lineTasksEnabled: boolean
  onSaveShortcut: (accelerator: string) => void
  onSaveAnchorNew: (enabled: boolean) => void
  onSaveLineTasks: (enabled: boolean) => void
  onGoToFunction: () => void
}

export function MemoSettingsPane({
  memoShortcut,
  anchorNewMemos,
  lineTasksEnabled,
  onSaveShortcut,
  onSaveAnchorNew,
  onSaveLineTasks,
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
            <span>新建时默认锚定到桌面</span>
            <InfoTip
              text="仅作为新建备忘录的默认值；新建时可在对话框中临时修改，之后也可在备忘录列表中按条切换"
              align="right"
            />
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
        <div className="row">
          <span className="row-label">
            <span>新建时默认逐行勾选</span>
            <InfoTip
              text="仅作为新建备忘录的默认值；是否逐行显示复选框可在新建或编辑对话框中修改，也可在备忘录列表中按条切换"
              align="right"
            />
          </span>
          <label className="fl-switch">
            <input
              type="checkbox"
              checked={lineTasksEnabled}
              onChange={(event) => onSaveLineTasks(event.target.checked)}
            />
            <span className="fl-switch-track" aria-hidden="true" />
          </label>
        </div>
      </div>
    </section>
  )
}
