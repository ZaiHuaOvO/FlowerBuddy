import type {
  DescribeSiteTimeSeriesDataRequest,
  DescribeSiteTimeSeriesDataRequestFields
} from '@alicloud/esa20240910'
import type { RuntimeOptions } from '@darabonba/typescript'
import type { EsaTraffic, ModuleActionResult } from '../../../shared/api'
import { AppError } from '../../shared/errors'

/**
 * The SDK is CommonJS; electron-vite's interop may expose the module object as
 * `default`, so accept both `default` and `default.default` shapes.
 */
type EsaClientConstructor = new (config: unknown) => unknown
type EsaConfigConstructor = new (options: {
  accessKeyId: string
  accessKeySecret: string
}) => { endpoint: string }
type EsaRequestConstructor = new (options: {
  siteId: string
  startTime: string
  endTime: string
  fields: DescribeSiteTimeSeriesDataRequestFields[]
}) => DescribeSiteTimeSeriesDataRequest
type EsaRequestFieldsConstructor = new (options: {
  fieldName: string
  dimension: string[]
}) => DescribeSiteTimeSeriesDataRequestFields
type EsaRuntimeOptionsConstructor = new (options: {
  connectTimeout: number
  readTimeout: number
}) => RuntimeOptions

interface EsaSdkClasses {
  Client: EsaClientConstructor
  Config: EsaConfigConstructor
  Request: EsaRequestConstructor
  RequestFields: EsaRequestFieldsConstructor
  RuntimeOptions: EsaRuntimeOptionsConstructor
}

function pickExport<T>(module: Record<string, unknown>, name: string): T | undefined {
  const direct = module[name]
  if (direct !== undefined) {
    return direct as T
  }
  const fallback = module.default
  if (fallback && typeof fallback === 'object') {
    return (fallback as Record<string, unknown>)[name] as T | undefined
  }
  return undefined
}

let esaSdkPromise: Promise<EsaSdkClasses> | null = null

async function loadEsaSdk(): Promise<EsaSdkClasses> {
  esaSdkPromise ??= Promise.all([
    import('@alicloud/esa20240910'),
    import('@alicloud/openapi-core'),
    import('@darabonba/typescript')
  ])
    .then(([esaModule, openApiModule, darabonbaModule]) => {
      const esaExports = esaModule as unknown as Record<string, unknown>
      const openApiExports = openApiModule as unknown as Record<string, unknown>
      const darabonbaExports = darabonbaModule as unknown as Record<string, unknown>

      const defaultExport = esaExports.default
      const clientCandidate =
        typeof defaultExport === 'function'
          ? defaultExport
          : (defaultExport as { default?: unknown } | undefined)?.default
      const request = pickExport<EsaRequestConstructor>(
        esaExports,
        'DescribeSiteTimeSeriesDataRequest'
      )
      const requestFields = pickExport<EsaRequestFieldsConstructor>(
        esaExports,
        'DescribeSiteTimeSeriesDataRequestFields'
      )
      const openApiUtil = pickExport<{ Config?: unknown }>(openApiExports, '$OpenApiUtil')
      const runtimeOptions = pickExport<EsaRuntimeOptionsConstructor>(
        darabonbaExports,
        'RuntimeOptions'
      )
      const config = openApiUtil?.Config

      if (
        typeof clientCandidate !== 'function' ||
        !request ||
        !requestFields ||
        typeof config !== 'function' ||
        !runtimeOptions
      ) {
        throw new AppError('REMOTE_SERVICE_ERROR', 'ESA SDK 初始化失败')
      }

      return {
        Client: clientCandidate as EsaClientConstructor,
        Config: config as EsaConfigConstructor,
        Request: request,
        RequestFields: requestFields,
        RuntimeOptions: runtimeOptions
      }
    })
    .catch((error: unknown) => {
      esaSdkPromise = null
      throw error
    })
  return esaSdkPromise
}

/** Public endpoints documented for ESA 2024-09-10. */
const ESA_ENDPOINT = 'esa.cn-hangzhou.aliyuncs.com'
const CONNECT_TIMEOUT_MS = 5000
const READ_TIMEOUT_MS = 15000

interface EsaSummarizedEntry {
  fieldName?: string
  value?: unknown
}

export interface EsaResponseBodyLike {
  summarizedData?: EsaSummarizedEntry[]
  samplingRate?: number
  interval?: number
  startTime?: string
  endTime?: string
}

export interface EsaClientLike {
  describeSiteTimeSeriesDataWithOptions(
    request: DescribeSiteTimeSeriesDataRequest,
    runtime: RuntimeOptions
  ): Promise<{ body?: EsaResponseBodyLike }>
}

export type EsaClientFactory = (credentials: {
  accessKeyId: string
  accessKeySecret: string
}) => EsaClientLike

export interface EsaTrafficInput {
  accessKeyId: string
  accessKeySecret: string
  siteId: string
  now?: (() => Date) | undefined
  clientFactory?: EsaClientFactory | undefined
}

function createEsaClient(
  sdk: EsaSdkClasses,
  credentials: { accessKeyId: string; accessKeySecret: string }
): EsaClientLike {
  const config = new sdk.Config(credentials)
  config.endpoint = ESA_ENDPOINT
  return new sdk.Client(config) as unknown as EsaClientLike
}

/** Local natural day: 00:00 in the user's timezone converted to UTC ISO. */
export function todayRangeUtc(now: Date): { startTime: string; endTime: string } {
  const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = now.getTime() <= startLocal.getTime() ? new Date(startLocal.getTime() + 1000) : now
  return {
    startTime: startLocal.toISOString(),
    endTime: end.toISOString()
  }
}

function isNetworkError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } }).cause
  const code = cause?.code ?? (error as { code?: string }).code ?? ''
  return [
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'UND_ERR_CONNECT_TIMEOUT'
  ].includes(code)
}

function mapEsaError(error: unknown): AppError {
  const record = error as {
    code?: unknown
    statusCode?: unknown
  }
  const code = typeof record.code === 'string' ? record.code : ''
  const status = typeof record.statusCode === 'number' ? record.statusCode : undefined

  if (/InvalidAccessKeyId|SignatureDoesNotMatch|InvalidSecurityToken|Unauthorized/i.test(code)) {
    return new AppError('AUTH_REQUIRED', 'ESA AccessKey 无效或签名失败', {
      cause: error
    })
  }
  if (/Forbidden|Ram\.|NoPermission|PermissionDenied/i.test(code) || status === 403) {
    return new AppError('PERMISSION_DENIED', 'ESA 凭据缺少读取该站点流量的权限，请检查 RAM 授权', {
      cause: error
    })
  }
  if (/Throttling|FlowControl/i.test(code) || status === 429) {
    return new AppError('RATE_LIMITED', 'ESA 请求过于频繁，请稍后重试', {
      retryable: true,
      cause: error
    })
  }
  if (/InvalidSiteId|InvalidParameter|MissingParameter|InvalidTime/i.test(code) || status === 400) {
    return new AppError('INVALID_INPUT', 'SiteId 或查询时间范围不合法', {
      cause: error
    })
  }
  if (status !== undefined && status >= 500) {
    return new AppError('REMOTE_SERVICE_ERROR', 'ESA 服务暂时不可用', {
      retryable: true,
      cause: error
    })
  }
  if (isNetworkError(error)) {
    return new AppError('NETWORK_ERROR', '无法连接阿里云 ESA 服务，请检查网络', {
      retryable: true,
      cause: error
    })
  }
  return new AppError('REMOTE_SERVICE_ERROR', 'ESA 查询失败，请稍后重试', {
    cause: error
  })
}

/**
 * Queries today's Traffic aggregate through the official ESA SDK.
 * The AccessKey is only used to build the SDK client and is never logged.
 */
export async function fetchEsaTraffic(input: EsaTrafficInput): Promise<EsaTraffic> {
  if (!input.accessKeyId.trim() || !input.accessKeySecret.trim()) {
    throw new AppError('NOT_CONFIGURED', '请先在设置中填写 ESA AccessKey')
  }
  if (!input.siteId.trim()) {
    throw new AppError('NOT_CONFIGURED', '请先在设置中填写 ESA SiteId')
  }

  const now = input.now?.() ?? new Date()
  const { startTime, endTime } = todayRangeUtc(now)

  let response: { body?: EsaResponseBodyLike }
  try {
    const sdk = await loadEsaSdk()
    const credentials = {
      accessKeyId: input.accessKeyId,
      accessKeySecret: input.accessKeySecret
    }
    const client = input.clientFactory
      ? input.clientFactory(credentials)
      : createEsaClient(sdk, credentials)
    const request = new sdk.Request({
      siteId: input.siteId.trim(),
      startTime,
      endTime,
      fields: [
        new sdk.RequestFields({
          fieldName: 'Traffic',
          dimension: ['ALL']
        })
      ]
    })
    response = await client.describeSiteTimeSeriesDataWithOptions(
      request,
      new sdk.RuntimeOptions({
        connectTimeout: CONNECT_TIMEOUT_MS,
        readTimeout: READ_TIMEOUT_MS
      })
    )
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    throw mapEsaError(error)
  }

  const body = response.body
  if (!body || !Array.isArray(body.summarizedData)) {
    throw new AppError('INVALID_RESPONSE', 'ESA 未返回时序汇总数据')
  }

  const trafficEntries = body.summarizedData.filter((entry) => entry.fieldName === 'Traffic')
  if (trafficEntries.length === 0) {
    throw new AppError('INVALID_RESPONSE', 'ESA 响应中缺少 Traffic 聚合值')
  }

  let bytes = 0
  for (const entry of trafficEntries) {
    const value = Number(entry.value)
    if (!Number.isFinite(value)) {
      throw new AppError('INVALID_RESPONSE', 'ESA Traffic 聚合值不是有效数字')
    }
    bytes += value
  }

  const samplingRate =
    typeof body.samplingRate === 'number' && Number.isFinite(body.samplingRate)
      ? body.samplingRate
      : null

  return {
    bytes,
    samplingRate,
    intervalSeconds: typeof body.interval === 'number' ? body.interval : null,
    startTime: typeof body.startTime === 'string' ? body.startTime : startTime,
    endTime: typeof body.endTime === 'string' ? body.endTime : endTime,
    fetchedAt: now.toISOString()
  }
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let value = Math.max(0, bytes)
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  const digits = index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[index]}`
}

export function formatTrafficResult(traffic: EsaTraffic): ModuleActionResult {
  const end = new Date(traffic.endTime)
  const time = Number.isNaN(end.getTime())
    ? ''
    : end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const sampling =
    traffic.samplingRate === null
      ? '官方未提供采样率；统计可能有延迟，不等同于精确账单。'
      : `采样率 ${traffic.samplingRate}%；统计可能有延迟，不等同于精确账单。`

  return {
    state: 'success',
    message: `今日流量（截至 ${time}）\n${formatBytes(traffic.bytes)}\n${sampling}`
  }
}
