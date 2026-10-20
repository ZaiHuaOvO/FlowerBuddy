import type { MenuActionSummary, ModuleSummary } from '../../shared/api'

export const MEMO_NEW_ACTION_ID = 'memo:new'

/** Reuses the Alt+A flow so the menu action and shortcut cannot drift apart. */
export function withMemoNewAction(
  actions: MenuActionSummary[],
  modules: ModuleSummary[]
): MenuActionSummary[] {
  const memo = modules.find((module) => module.id === 'memo')
  if (!memo?.enabled || !memo.configured) {
    return actions
  }
  return [
    {
      id: MEMO_NEW_ACTION_ID,
      label: '新建备忘录',
      moduleId: 'memo'
    },
    ...actions
  ]
}
