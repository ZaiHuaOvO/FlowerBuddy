import { z } from 'zod'
import type { DeepSeekBalance, DeepSeekBalanceInfo } from '../../../shared/api'
import { AppError } from '../../shared/errors'

const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance'
const DEFAULT_TIMEOUT_MS = 15000

const amountSchema = z.union([z.string(), z.number()])

const balanceResponseSchema = z.object({
  is_available: z.boolean(),
  balance_infos: z.array(
    z.object({
      currency: z.string().min(1),
      total_balance: amountSchema,
      granted_balance: amountSchema,
      topped_up_balance: amountSchema
    })
  )
})

export interface DeepSeekFetchOptions {
  fetchImpl?: typeof fetch | undefined
  timeoutMs?: number | undefined
  now?: (() => Date) | undefined
}

/**
 * Official endpoint: GET https://api.deepseek.com/user/balance
 * The API key is used only for the Authorization header and is never logged.
 */
export async function fetchDeepSeekBalance(
  apiKey: string,
  options: DeepSeekFetchOptions = {}
): Promise<DeepSeekBalance> {
  if (!apiKey.trim()) {
    throw new AppError('NOT_CONFIGURED', '请先在设置中填写 DeepSeek API Key')
  }

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => new Date())

  try {
    const response = await fetchImpl(DEEPSEEK_BALANCE_URL, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json'
      },
      signal: controller.signal
    })

    if (response.status === 401) {
      throw new AppError('AUTH_REQUIRED', 'DeepSeek API Key 无效或已失效')
    }
    if (response.status === 402) {
      throw new AppError('REMOTE_SERVICE_ERROR', 'DeepSeek 账户余额不足或已被限制')
    }
    if (response.status === 429) {
      throw new AppError('RATE_LIMITED', '请求过于频繁，请稍后重试', {
        retryable: true
      })
    }
    if (response.status >= 500) {
      throw new AppError('REMOTE_SERVICE_ERROR', 'DeepSeek 服务暂时不可用', {
        retryable: true
      })
    }
    if (!response.ok) {
      throw new AppError('REMOTE_SERVICE_ERROR', `DeepSeek 返回 HTTP ${response.status}`)
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new AppError('INVALID_RESPONSE', 'DeepSeek 返回了无法解析的数据')
    }

    const parsed = balanceResponseSchema.safeParse(payload)
    if (!parsed.success) {
      throw new AppError('INVALID_RESPONSE', 'DeepSeek 余额响应结构不符合预期')
    }

    const balances: DeepSeekBalanceInfo[] = parsed.data.balance_infos.map((info) => ({
      currency: info.currency,
      totalBalance: String(info.total_balance),
      grantedBalance: String(info.granted_balance),
      toppedUpBalance: String(info.topped_up_balance)
    }))

    return {
      isAvailable: parsed.data.is_available,
      balances,
      fetchedAt: now().toISOString()
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    if (controller.signal.aborted) {
      throw new AppError('TIMEOUT', '查询 DeepSeek 余额超时，请稍后重试', {
        retryable: true
      })
    }
    throw new AppError('NETWORK_ERROR', '无法连接 DeepSeek 服务，请检查网络', {
      retryable: true,
      cause: error
    })
  } finally {
    clearTimeout(timer)
  }
}

export function formatCurrencyAmount(currency: string, amount: string): string {
  const value = Number(amount)
  if (!Number.isFinite(value)) {
    return `${currency} ${amount}`
  }
  try {
    return `${currency} ${new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency
    }).format(value)}`
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}
