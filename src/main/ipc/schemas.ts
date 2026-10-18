import { z } from 'zod'
import type {
  AppSettingsPatch,
  MemoInput,
  MemoPatch,
  ModuleId,
  PetSettingsPatch,
  WebsiteCheckInput,
  WebsiteCheckPatch
} from '../../shared/api'
import { isHttpUrl } from '../modules/website-check/website-types'
import { AppError } from '../shared/errors'

export const moduleIdSchema = z.enum(['memo', 'gmail', 'esa', 'deepseek', 'website-check'])

export const appSettingsPatchSchema = z
  .object({
    alwaysOnTop: z.boolean().optional(),
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

const bubbleDismissInputSchema = z.object({ id: z.string().uuid() }).strict()
const bubbleHeightInputSchema = z.object({ height: z.number().min(0).max(2000) }).strict()

const memoDiscardImagesSchema = z.object({ ids: z.array(z.string().uuid()).max(20) }).strict()

const memoAnchoredInputSchema = z.object({ id: z.string().uuid(), anchored: z.boolean() }).strict()

const memoCardResizeInputSchema = z
  .object({ id: z.string().uuid(), edge: z.enum(['nw', 'ne', 'sw', 'se']) })
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

const refreshIntervalInputSchema = z
  .object({
    moduleId: z.enum(['deepseek', 'esa']),
    minutes: z.number().int().min(5).max(60).nullable()
  })
  .strict()

const gmailClientInputSchema = z
  .object({
    clientId: z.string().trim().min(1).max(256),
    clientSecret: z.string().trim().min(1).max(256)
  })
  .strict()

const gmailSettingsPatchSchema = z
  .object({
    pollIntervalMinutes: z.number().int().min(1).max(15).optional(),
    notifyNewMail: z.boolean().optional(),
    hideSubject: z.boolean().optional()
  })
  .strict()

export {
  bubbleDismissInputSchema,
  bubbleHeightInputSchema,
  deepSeekKeyInputSchema,
  esaCredentialsInputSchema,
  gmailClientInputSchema,
  gmailSettingsPatchSchema,
  idEnabledInputSchema,
  idInputSchema,
  memoAnchorNewInputSchema,
  memoAnchoredInputSchema,
  memoCardResizeInputSchema,
  memoDiscardImagesSchema,
  memoImageBytesSchema,
  memoInputSchema,
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
