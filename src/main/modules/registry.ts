import type { ModuleDefinition } from './types'

interface PlaceholderDescriptor {
  id: ModuleDefinition['id']
  name: string
  description: string
  requiresCredentials: boolean
  implemented: boolean
}

function createPlaceholderModule(descriptor: PlaceholderDescriptor): ModuleDefinition {
  const isConfigured = (): boolean => !descriptor.requiresCredentials
  return {
    ...descriptor,
    isConfigured,
    getStatus: () => {
      if (!isConfigured()) {
        return 'not-configured'
      }
      return descriptor.implemented ? 'ready' : 'not-implemented'
    },
    start: () => {},
    stop: () => {}
  }
}

/**
 * Static registry only. No code is loaded from the filesystem, so enabling a
 * module can never execute arbitrary plugin code.
 */
export function createModuleRegistry(): ModuleDefinition[] {
  return [
    createPlaceholderModule({
      id: 'dates',
      name: '特殊日期',
      description: '生日、纪念日与倒计时提醒',
      requiresCredentials: false,
      implemented: false
    }),
    createPlaceholderModule({
      id: 'gmail',
      name: 'Gmail 提醒',
      description: '新邮件通知，需要 Google OAuth 授权',
      requiresCredentials: true,
      implemented: false
    }),
    createPlaceholderModule({
      id: 'esa',
      name: 'ESA 流量',
      description: '阿里云 ESA 今日流量，需要只读 AccessKey',
      requiresCredentials: true,
      implemented: false
    }),
    createPlaceholderModule({
      id: 'deepseek',
      name: 'DeepSeek 余额',
      description: '账户余额查询，需要 API Key',
      requiresCredentials: true,
      implemented: false
    }),
    createPlaceholderModule({
      id: 'website-check',
      name: '网站检测',
      description: '从本机检查 HTTP(S) 可用性',
      requiresCredentials: false,
      implemented: false
    })
  ]
}
