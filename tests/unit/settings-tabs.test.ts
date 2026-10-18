import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ModuleSummary, PublicConfig } from '../../src/shared/api'
import { DatesSettingsTab } from '../../src/renderer/src/settings/tabs/DatesSettingsTab'
import { DeepSeekSettingsTab } from '../../src/renderer/src/settings/tabs/DeepSeekSettingsTab'
import { EsaSettingsTab } from '../../src/renderer/src/settings/tabs/EsaSettingsTab'
import { GeneralSettingsTab } from '../../src/renderer/src/settings/tabs/GeneralSettingsTab'
import { GmailSettingsTab } from '../../src/renderer/src/settings/tabs/GmailSettingsTab'
import { ModulesSettingsTab } from '../../src/renderer/src/settings/tabs/ModulesSettingsTab'
import { WebsitesSettingsTab } from '../../src/renderer/src/settings/tabs/WebsitesSettingsTab'
import type { useDatesSettings } from '../../src/renderer/src/settings/hooks/useDatesSettings'
import type { useDeepSeekSettings } from '../../src/renderer/src/settings/hooks/useDeepSeekSettings'
import type { useEsaSettings } from '../../src/renderer/src/settings/hooks/useEsaSettings'
import type { useGmailSettings } from '../../src/renderer/src/settings/hooks/useGmailSettings'
import type { useWebsiteSettings } from '../../src/renderer/src/settings/hooks/useWebsiteSettings'
import { createDateForm, createWebsiteForm } from '../../src/renderer/src/settings/utils/forms'

const noop = (): void => {}
const asyncNoop = async (): Promise<void> => {}

function makeConfig(): PublicConfig {
  return {
    schemaVersion: 5,
    app: {
      alwaysOnTop: true,
      bounceAnimation: true,
      bubbleDurationMs: 5000,
      launchAtLogin: false,
      moduleOrder: ['dates', 'website-check'],
      showPetOnStartup: true
    },
    pet: { assetId: 'default', scale: 1, position: null },
    modules: {
      dates: { enabled: true },
      gmail: {
        enabled: false,
        pollIntervalMinutes: 3,
        notifyNewMail: true,
        hideSubject: true
      },
      esa: { enabled: false, siteId: '', refreshIntervalMinutes: null },
      deepseek: { enabled: false, refreshIntervalMinutes: null },
      websiteCheck: { enabled: true, defaultTimeoutMs: 8000 }
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
  moduleSummary('dates', '特殊日期'),
  moduleSummary('gmail', 'Gmail'),
  moduleSummary('deepseek', 'DeepSeek'),
  moduleSummary('esa', 'ESA')
]

const datesModel = {
  events: [],
  form: createDateForm(),
  setForm: noop,
  editingId: null,
  confirmDeleteId: null,
  setConfirmDeleteId: noop,
  submit: asyncNoop,
  startEdit: noop,
  cancelEdit: noop,
  toggle: asyncNoop,
  remove: asyncNoop
} as unknown as ReturnType<typeof useDatesSettings>

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

const gmailModel = {
  gmailState: null,
  summary: modules[1],
  clientIdDraft: '',
  setClientIdDraft: noop,
  clientSecretDraft: '',
  setClientSecretDraft: noop,
  busy: 'idle',
  checkResult: '',
  saveClient: asyncNoop,
  connect: asyncNoop,
  disconnect: asyncNoop,
  checkNow: asyncNoop,
  updateSettings: asyncNoop
} as unknown as ReturnType<typeof useGmailSettings>

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

    expect(
      render(
        createElement(GeneralSettingsTab, {
          config,
          onSave: noop,
          onSavePet: noop,
          onImportImage: noop
        })
      )
    ).toContain('<h2>常规</h2>')
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
    expect(render(createElement(DatesSettingsTab, { model: datesModel }))).toContain(
      '<h2>日期事件</h2>'
    )
    expect(render(createElement(WebsitesSettingsTab, { model: websiteModel }))).toContain(
      '<h2>网站检测</h2>'
    )
    expect(
      render(createElement(GmailSettingsTab, { config, model: gmailModel, onToggleModule: noop }))
    ).toContain('Gmail 新邮件')
    expect(
      render(
        createElement(DeepSeekSettingsTab, { config, model: deepSeekModel, onToggleModule: noop })
      )
    ).toContain('DeepSeek 余额')
    expect(
      render(createElement(EsaSettingsTab, { config, model: esaModel, onToggleModule: noop }))
    ).toContain('ESA 今日流量')
  })
})
