import { describe, expect, it } from 'vitest'
import type { MenuActionSummary, ModuleSummary } from '../../src/shared/api'
import { MEMO_NEW_ACTION_ID, withMemoNewAction } from '../../src/main/actions/menu-actions'

function moduleSummary(
  id: ModuleSummary['id'],
  enabled: boolean,
  configured: boolean
): ModuleSummary {
  return {
    id,
    name: id,
    description: '',
    enabled,
    configured,
    implemented: true,
    status: configured ? 'ready' : 'not-configured',
    statusLabel: configured ? '已就绪' : '未配置'
  }
}

const existing: MenuActionSummary[] = [
  { id: 'website-check:run', label: '检测网站', moduleId: 'website-check' }
]

describe('menu actions', () => {
  it('adds 新建备忘录 before module actions when memo is available', () => {
    const actions = withMemoNewAction(existing, [moduleSummary('memo', true, true)])
    expect(actions[0]).toEqual({
      id: MEMO_NEW_ACTION_ID,
      label: '新建备忘录',
      moduleId: 'memo'
    })
    expect(actions[1]).toEqual(existing[0])
  })

  it('hides 新建备忘录 when the memo module is disabled or missing', () => {
    expect(withMemoNewAction(existing, [moduleSummary('memo', false, true)])).toEqual(existing)
    expect(withMemoNewAction(existing, [moduleSummary('deepseek', true, true)])).toEqual(existing)
  })
})
