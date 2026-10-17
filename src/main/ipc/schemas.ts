import { z } from 'zod'
import type {
  AppSettingsPatch,
  DateEventInput,
  DateEventPatch,
  ModuleId,
  PetSettingsPatch,
  WebsiteCheckInput,
  WebsiteCheckPatch
} from '../../shared/api'
import { parseIsoDate } from '../modules/dates/dates-compute'
import { isHttpUrl } from '../modules/website-check/website-types'
import { AppError } from '../shared/errors'

export const appSettingsPatchSchema = z
  .object({
    alwaysOnTop: z.boolean().optional(),
    bounceAnimation: z.boolean().optional(),
    bubbleDurationMs: z.number().int().min(1500).max(30000).optional()
  })
  .strict()

export const petSettingsPatchSchema = z
  .object({
    scale: z.number().min(0.5).max(2).optional()
  })
  .strict()

export const moduleIdSchema = z.enum(['dates', 'gmail', 'esa', 'deepseek', 'website-check'])

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

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => parseIsoDate(value) !== null, '日期不合法')

const dateEventInputSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    date: isoDateSchema,
    recurrence: z.enum(['none', 'yearly']),
    category: z.enum(['birthday', 'anniversary', 'overtime', 'custom']),
    notifyDaysBefore: z.array(z.number().int().min(0).max(365)).max(10).optional()
  })
  .strict()

const dateEventPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    date: isoDateSchema.optional(),
    recurrence: z.enum(['none', 'yearly']).optional(),
    category: z.enum(['birthday', 'anniversary', 'overtime', 'custom']).optional(),
    notifyDaysBefore: z.array(z.number().int().min(0).max(365)).max(10).optional(),
    enabled: z.boolean().optional()
  })
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

const dateUpdateInputSchema = z
  .object({ id: z.string().uuid(), patch: dateEventPatchSchema })
  .strict()

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

export {
  dateEventInputSchema,
  dateEventPatchSchema,
  dateUpdateInputSchema,
  deepSeekKeyInputSchema,
  esaCredentialsInputSchema,
  idEnabledInputSchema,
  idInputSchema,
  refreshIntervalInputSchema,
  websiteInputSchema,
  websitePatchSchema,
  websiteUpdateInputSchema
}

export type ModuleEnabledInput = z.infer<typeof moduleEnabledInputSchema>
export type MenuAction = z.infer<typeof menuActionSchema>
export type IdInput = z.infer<typeof idInputSchema>
export type IdEnabledInput = z.infer<typeof idEnabledInputSchema>
export type DateEventUpdateInput = { id: string; patch: DateEventPatch }
export type WebsiteUpdateInput = { id: string; patch: WebsiteCheckPatch }

export function parseDateEventInput(raw: unknown): DateEventInput {
  return parseInput(dateEventInputSchema, raw) as DateEventInput
}

export function parseDateEventPatch(raw: unknown): DateEventPatch {
  return parseInput(dateEventPatchSchema, raw) as DateEventPatch
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
