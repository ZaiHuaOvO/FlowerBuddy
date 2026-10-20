import { Button } from '../../components/Button'
import { FormRow } from '../components/FormRow'
import { PageHeader } from '../components/PageHeader'
import { Section } from '../components/Section'
import { ShortcutInput } from '../components/ShortcutInput'
import { Toggle } from '../components/Toggle'

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
    <>
      <PageHeader
        title="备忘录设置"
        description="快捷键与新建备忘录的默认行为。"
        actions={
          <Button variant="secondary" onClick={onGoToFunction}>
            前往功能页
          </Button>
        }
      />

      <Section title="新建默认值">
        <FormRow label="新增快捷键" hint="点击后按下组合键；退格清除">
          <ShortcutInput value={memoShortcut} onSave={onSaveShortcut} />
        </FormRow>

        <FormRow
          label="新建时默认锚定到桌面"
          hint="只影响新建的备忘，之后可在列表中逐条切换"
          htmlFor="memo-anchor-default"
        >
          <Toggle
            id="memo-anchor-default"
            ariaLabel="新建时默认锚定到桌面"
            checked={anchorNewMemos}
            onChange={onSaveAnchorNew}
          />
        </FormRow>

        <FormRow
          label="新建时默认逐行打勾"
          hint="每行前显示勾选框；只影响新建的备忘"
          htmlFor="memo-line-default"
        >
          <Toggle
            id="memo-line-default"
            ariaLabel="新建时默认逐行打勾"
            checked={lineTasksEnabled}
            onChange={onSaveLineTasks}
          />
        </FormRow>
      </Section>
    </>
  )
}
