import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ModuleSummary, PublicConfig } from '../../src/shared/api'
import { MemoSettingsTab } from '../../src/renderer/src/settings/tabs/MemoSettingsTab'
import { DeepSeekSettingsTab } from '../../src/renderer/src/settings/tabs/DeepSeekSettingsTab'
import { EsaSettingsTab } from '../../src/renderer/src/settings/tabs/EsaSettingsTab'
import { GeneralSettingsTab } from '../../src/renderer/src/settings/tabs/GeneralSettingsTab'
import { ModulesSettingsTab } from '../../src/renderer/src/settings/tabs/ModulesSettingsTab'
import { WebsitesSettingsTab } from '../../src/renderer/src/settings/tabs/WebsitesSettingsTab'
import type { useMemoSettings } from '../../src/renderer/src/settings/hooks/useMemoSettings'
import type { useDeepSeekSettings } from '../../src/renderer/src/settings/hooks/useDeepSeekSettings'
import type { useEsaSettings } from '../../src/renderer/src/settings/hooks/useEsaSettings'
import type { useWebsiteSettings } from '../../src/renderer/src/settings/hooks/useWebsiteSettings'
import { createMemoDraft } from '../../src/renderer/src/settings/hooks/useMemoSettings'
import type { useIntervalReminderSettings } from '../../src/renderer/src/settings/hooks/useIntervalReminderSettings'
import { IntervalReminderSettingsTab } from '../../src/renderer/src/settings/tabs/IntervalReminderSettingsTab'
import { createReminderForm, createWebsiteForm } from '../../src/renderer/src/settings/utils/forms'

const noop = (): void => {}
const asyncNoop = async (): Promise<void> => {}

function makeConfig(): PublicConfig {
  return {
    schemaVersion: 10,
    app: {
      alwaysOnTop: true,
      bounceAnimation: true,
      bubbleDurationMs: 5000,
      launchAtLogin: false,
      bossShortcut: 'Alt+Z',
      memoShortcut: 'Alt+A',
      moduleOrder: ['memo', 'interval-reminder'],
      showPetOnStartup: true
    },
    pet: { assetId: 'default', names: {}, scale: 1, position: null },
    modules: {
      memo: { enabled: true, anchorNewMemos: false },
      intervalReminder: { enabled: true },
      esa: {
        enabled: false,
        siteId: '',
        refreshIntervalMinutes: null,
        displayRanges: { last24h: true, last7d: true, last30d: true }
      },
      deepseek: { enabled: false, refreshIntervalMinutes: null },
      websiteCheck: { enabled: false, defaultTimeoutMs: 8000 }
    }
  }
}

function moduleSummary(id: ModuleSummary['id'], name: string): ModuleSummary {
  return {
    id,
    name,
    description: `${name} description`,
    enabled: false,
    configured: false,
    implemented: true,
    status: 'not-configured',
    statusLabel: '未配置'
  }
}

const modules = [
  moduleSummary('memo', '备忘录'),
  moduleSummary('interval-reminder', '定时提醒'),
  moduleSummary('deepseek', 'DeepSeek'),
  moduleSummary('esa', 'ESA')
]

const memoModel = {
  memos: [],
  draft: createMemoDraft(),
  setDraft: noop,
  editingId: null,
  confirmDeleteId: null,
  setConfirmDeleteId: noop,
  editorOpen: false,
  busy: false,
  startNew: noop,
  startEdit: noop,
  cancelEdit: noop,
  updateReminderText: noop,
  setReminderFromPicker: noop,
  addPastedImages: asyncNoop,
  removeImage: noop,
  submit: asyncNoop,
  complete: asyncNoop,
  uncomplete: asyncNoop,
  toggleAnchorNew: noop,
  toggleAnchor: asyncNoop,
  remove: asyncNoop
} as unknown as ReturnType<typeof useMemoSettings>

const reminderModel = {
  reminders: [],
  form: createReminderForm(),
  setForm: noop,
  editingId: null,
  dialogOpen: false,
  confirmDeleteId: null,
  setConfirmDeleteId: noop,
  busy: false,
  openNew: noop,
  openEdit: noop,
  closeDialog: noop,
  changeUnit: noop,
  addRange: noop,
  updateRange: noop,
  removeRange: noop,
  submit: asyncNoop,
  toggle: asyncNoop,
  remove: asyncNoop
} as unknown as ReturnType<typeof useIntervalReminderSettings>

const websiteModel = {
  websites: [],
  form: createWebsiteForm(),
  setForm: noop,
  editingId: null,
  confirmDeleteId: null,
  setConfirmDeleteId: noop,
  checkingId: null,
  checkingAll: false,
  submit: asyncNoop,
  startEdit: noop,
  cancelEdit: noop,
  toggle: asyncNoop,
  remove: asyncNoop,
  checkOne: asyncNoop,
  checkAll: asyncNoop
} as unknown as ReturnType<typeof useWebsiteSettings>

const deepSeekModel = {
  summary: modules[2],
  keyDraft: '',
  setKeyDraft: noop,
  busy: false,
  balance: null,
  saveKey: asyncNoop,
  clearKey: asyncNoop,
  refresh: asyncNoop,
  saveRefreshInterval: asyncNoop
} as unknown as ReturnType<typeof useDeepSeekSettings>

const esaModel = {
  summary: modules[3],
  keyIdDraft: '',
  setKeyIdDraft: noop,
  keySecretDraft: '',
  setKeySecretDraft: noop,
  siteIdDraft: '',
  setSiteIdDraft: noop,
  busy: false,
  traffic: null,
  saveCredentials: asyncNoop,
  clearCredentials: asyncNoop,
  refresh: asyncNoop,
  saveRefreshInterval: asyncNoop
} as unknown as ReturnType<typeof useEsaSettings>

describe('settings tabs render', () => {
  it('renders every tab without a DOM', () => {
    const config = makeConfig()
    const render = (element: ReactElement): string => renderToStaticMarkup(element)

    const general = render(
      createElement(GeneralSettingsTab, {
        config,
        userImages: [{ assetId: '3f1c2a56-8b9d-4a1e-9f0c-123456789abc', name: '小棕' }],
        onSave: noop,
        onSavePet: noop,
        onImportImage: noop,
        onSelectAsset: asyncNoop,
        onDeleteImage: asyncNoop,
        onRenameImage: asyncNoop
      })
    )
    expect(general).toContain('<h2>常规</h2>')
    expect(general).toContain('pet-gallery')
    expect(general).toContain('再花猫猫头')
    expect(general).toContain('小棕')
    expect(
      render(
        createElement(ModulesSettingsTab, {
          modules,
          security: null,
          onToggle: noop,
          onReorder: noop
        })
      )
    ).toContain('<h2>功能管理</h2>')
    expect(
      render(
        createElement(MemoSettingsTab, {
          model: memoModel,
          memoShortcut: 'Alt+A',
          onSaveShortcut: noop
        })
      )
    ).toContain('<h2>备忘录</h2>')
    expect(render(createElement(IntervalReminderSettingsTab, { model: reminderModel }))).toContain(
      '<h2>定时提醒</h2>'
    )
    expect(render(createElement(WebsitesSettingsTab, { model: websiteModel }))).toContain(
      '<h2>网站检测</h2>'
    )
    expect(
      render(
        createElement(DeepSeekSettingsTab, { config, model: deepSeekModel, onToggleModule: noop })
      )
    ).toContain('DeepSeek 余额')
    expect(
      render(
        createElement(EsaSettingsTab, {
          config,
          model: esaModel,
          onToggleModule: noop,
          onSaveDisplayRanges: noop
        })
      )
    ).toContain('ESA 流量')
  })

  it('collapses credential forms when a module is configured', () => {
    const config = makeConfig()
    const render = (element: ReactElement): string => renderToStaticMarkup(element)
    const configured = (id: ModuleSummary['id'], name: string): ModuleSummary => ({
      ...moduleSummary(id, name),
      enabled: true,
      configured: true,
      status: 'ready',
      statusLabel: '已就绪'
    })

    const esa = render(
      createElement(EsaSettingsTab, {
        config: {
          ...config,
          modules: { ...config.modules, esa: { ...config.modules.esa, siteId: 'site-1' } }
        },
        model: { ...esaModel, summary: configured('esa', 'ESA') },
        onToggleModule: noop,
        onSaveDisplayRanges: noop
      })
    )
    expect(esa).not.toContain('AccessKey ID')
    expect(esa).not.toContain('AccessKey Secret')
    expect(esa).not.toContain('SiteId')
    expect(esa).toContain('刷新流量')
    expect(esa).toContain('重新配置')

    const deepseek = render(
      createElement(DeepSeekSettingsTab, {
        config,
        model: { ...deepSeekModel, summary: configured('deepseek', 'DeepSeek') },
        onToggleModule: noop
      })
    )
    expect(deepseek).not.toContain('API Key')
    expect(deepseek).toContain('刷新余额')
    expect(deepseek).toContain('重新配置')
  })
})
