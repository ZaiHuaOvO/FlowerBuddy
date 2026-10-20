import { z } from 'zod'
import { MAX_PET_NAME_LENGTH } from '../../shared/api'
import type {
  AppSettingsPatch,
  IntervalReminderInput,
  IntervalReminderPatch,
  MemoInput,
  MemoPatch,
  ModuleId,
  PetSettingsPatch,
  WebsiteCheckInput,
  WebsiteCheckPatch
} from '../../shared/api'
import { PET_PRESET_IDS } from '../../shared/pet-presets'
import { isHttpUrl } from '../modules/website-check/website-types'
import { AppError } from '../shared/errors'

export const moduleIdSchema = z.enum([
  'memo',
  'interval-reminder',
  'esa',
  'deepseek',
  'website-check'
])

export const appSettingsPatchSchema = z
  .object({
    alwaysOnTop: z.boolean().optional(),
    bossShortcut: z.string().trim().max(64).optional(),
    bounceAnimation: z.boolean().optional(),
    bubbleDurationMs: z.number().int().min(1000).max(30000).optional(),
    launchAtLogin: z.boolean().optional(),
    memoShortcut: z.string().trim().max(64).optional(),
    moduleOrder: z.array(moduleIdSchema).max(5).optional(),
    showPetOnStartup: z.boolean().optional()
  })
  .strict()

export const petSettingsPatchSchema = z
  .object({
    scale: z.number().min(0.5).max(2).optional()
  })
  .strict()

export const petAssetSelectionSchema = z
  .object({
    assetId: z.union([z.enum(PET_PRESET_IDS), z.string().uuid()])
  })
  .strict()

export const petImageIdSchema = z
  .object({
    assetId: z.string().uuid()
  })
  .strict()

export const petRenameInputSchema = z
  .object({
    assetId: z.string().uuid(),
    name: z.string().trim().max(MAX_PET_NAME_LENGTH)
  })
  .strict()

export const moduleEnabledInputSchema = z
  .object({
    moduleId: moduleIdSchema,
    enabled: z.boolean()
  })
  .strict()

export const menuActionSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9-]+:[a-z0-9-]+$/)

const memoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => Number.isFinite(Date.parse(value)), '提醒时间不合法')

const memoImageSchema = z
  .object({
    id: z.string().uuid(),
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096)
  })
  .strict()

const memoInputSchema = z
  .object({
    text: z.string().max(20000),
    images: z.array(memoImageSchema).max(9),
    reminderAt: memoTimestampSchema.nullable()
  })
  .strict()

const memoPatchSchema = z
  .object({
    text: z.string().max(20000).optional(),
    images: z.array(memoImageSchema).max(9).optional(),
    reminderAt: memoTimestampSchema.nullable().optional()
  })
  .strict()

const memoImageBytesSchema = z
  .object({
    data: z.custom<ArrayBuffer | Uint8Array>(
      (value) => value instanceof ArrayBuffer || ArrayBuffer.isView(value),
      '图片数据不合法'
    )
  })
  .strict()

const memoAnchorNewInputSchema = z.object({ enabled: z.boolean() }).strict()

const externalLinkSchema = z.object({ link: z.enum(['author', 'repository', 'issues']) }).strict()

const bubbleDismissInputSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/)
  })
  .strict()
const bubbleHeightInputSchema = z.object({ height: z.number().min(0).max(2000) }).strict()

const reminderTimeSchema = z.string().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, '时间格式应为 HH:mm')

const reminderRangeSchema = z
  .object({ start: reminderTimeSchema, end: reminderTimeSchema })
  .strict()
  .refine((range) => range.start !== range.end, '开始和结束时间不能相同')

const intervalReminderInputSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    text: z.string().trim().min(1).max(500),
    enabled: z.boolean().optional(),
    intervalMinutes: z.number().int().min(1).max(1440),
    ranges: z.array(reminderRangeSchema).max(6),
    randomEnabled: z.boolean(),
    randomJitterMinutes: z.number().int().min(0).max(120)
  })
  .strict()

const intervalReminderPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    text: z.string().trim().min(1).max(500).optional(),
    enabled: z.boolean().optional(),
    intervalMinutes: z.number().int().min(1).max(1440).optional(),
    ranges: z.array(reminderRangeSchema).max(6).optional(),
    randomEnabled: z.boolean().optional(),
    randomJitterMinutes: z.number().int().min(0).max(120).optional()
  })
  .strict()

const intervalReminderUpdateInputSchema = z
  .object({ id: z.string().uuid(), patch: intervalReminderPatchSchema })
  .strict()

const memoDiscardImagesSchema = z.object({ ids: z.array(z.string().uuid()).max(20) }).strict()

const memoAnchoredInputSchema = z.object({ id: z.string().uuid(), anchored: z.boolean() }).strict()

const memoLockedInputSchema = z.object({ id: z.string().uuid(), locked: z.boolean() }).strict()

const memoCardIgnoreMouseInputSchema = z
  .object({ id: z.string().uuid(), ignore: z.boolean() })
  .strict()

const memoCardResizeInputSchema = z
  .object({ id: z.string().uuid(), edge: z.enum(['nw', 'ne', 'sw', 'se']) })
  .strict()

const memoCardFitHeightInputSchema = z
  .object({ id: z.string().uuid(), height: z.number().min(0).max(2000) })
  .strict()

const idInputSchema = z.object({ id: z.string().uuid() }).strict()

const idEnabledInputSchema = z.object({ id: z.string().uuid(), enabled: z.boolean() }).strict()

const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => isHttpUrl(value), '仅支持 http/https URL')

const websiteInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    url: httpUrlSchema,
    timeoutMs: z.number().int().min(3000).max(30000),
    pollingIntervalMinutes: z.number().int().min(1).max(60).nullable(),
    enabled: z.boolean().optional()
  })
  .strict()

const websitePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    url: httpUrlSchema.optional(),
    timeoutMs: z.number().int().min(3000).max(30000).optional(),
    pollingIntervalMinutes: z.number().int().min(1).max(60).nullable().optional(),
    enabled: z.boolean().optional()
  })
  .strict()

const memoUpdateInputSchema = z.object({ id: z.string().uuid(), patch: memoPatchSchema }).strict()

const websiteUpdateInputSchema = z
  .object({ id: z.string().uuid(), patch: websitePatchSchema })
  .strict()

const deepSeekKeyInputSchema = z.object({ apiKey: z.string().trim().min(1).max(512) }).strict()

const esaCredentialsInputSchema = z
  .object({
    accessKeyId: z.string().trim().min(1).max(128),
    accessKeySecret: z.string().trim().min(1).max(256),
    siteId: z.string().trim().min(1).max(128)
  })
  .strict()

const esaDisplayRangesSchema = z
  .object({
    last24h: z.boolean(),
    last7d: z.boolean(),
    last30d: z.boolean()
  })
  .strict()
  .refine((ranges) => ranges.last24h || ranges.last7d || ranges.last30d, '至少选择一项流量范围')

const refreshIntervalInputSchema = z
  .object({
    moduleId: z.enum(['deepseek', 'esa']),
    minutes: z.number().int().min(5).max(60).nullable()
  })
  .strict()

export {
  bubbleDismissInputSchema,
  bubbleHeightInputSchema,
  deepSeekKeyInputSchema,
  esaCredentialsInputSchema,
  esaDisplayRangesSchema,
  externalLinkSchema,
  idEnabledInputSchema,
  idInputSchema,
  intervalReminderInputSchema,
  intervalReminderUpdateInputSchema,
  memoAnchorNewInputSchema,
  memoAnchoredInputSchema,
  memoCardIgnoreMouseInputSchema,
  memoCardResizeInputSchema,
  memoCardFitHeightInputSchema,
  memoDiscardImagesSchema,
  memoImageBytesSchema,
  memoInputSchema,
  memoLockedInputSchema,
  memoPatchSchema,
  memoUpdateInputSchema,
  refreshIntervalInputSchema,
  websiteInputSchema,
  websitePatchSchema,
  websiteUpdateInputSchema
}

export type ModuleEnabledInput = z.infer<typeof moduleEnabledInputSchema>
export type MenuAction = z.infer<typeof menuActionSchema>
export type IdInput = z.infer<typeof idInputSchema>
export type IdEnabledInput = z.infer<typeof idEnabledInputSchema>
export type MemoUpdateInput = { id: string; patch: MemoPatch }
export type IntervalReminderUpdateInput = { id: string; patch: IntervalReminderPatch }
export type IntervalReminderCreateInput = IntervalReminderInput
export type WebsiteUpdateInput = { id: string; patch: WebsiteCheckPatch }

export function parseMemoInput(raw: unknown): MemoInput {
  return parseInput(memoInputSchema, raw) as MemoInput
}

export function parseMemoPatch(raw: unknown): MemoPatch {
  return parseInput(memoPatchSchema, raw) as MemoPatch
}

export function parseWebsiteInput(raw: unknown): WebsiteCheckInput {
  return parseInput(websiteInputSchema, raw) as WebsiteCheckInput
}

export function parseWebsitePatch(raw: unknown): WebsiteCheckPatch {
  return parseInput(websitePatchSchema, raw) as WebsiteCheckPatch
}

export function parseInput<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new AppError('INVALID_INPUT', '输入参数不合法', { cause: result.error })
  }
  return result.data
}

export function parseModuleId(raw: unknown): ModuleId {
  return parseInput(moduleIdSchema, raw)
}

export function parseAppSettingsPatch(raw: unknown): AppSettingsPatch {
  return parseInput(appSettingsPatchSchema, raw) as AppSettingsPatch
}

export function parsePetSettingsPatch(raw: unknown): PetSettingsPatch {
  return parseInput(petSettingsPatchSchema, raw) as PetSettingsPatch
}
