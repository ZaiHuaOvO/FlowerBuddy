import { z } from 'zod'
import type { AppSettingsPatch, ModuleId, PetSettingsPatch } from '../../shared/api'
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

export const menuActionSchema = z.enum(['demo:success', 'demo:error'])

export type ModuleEnabledInput = z.infer<typeof moduleEnabledInputSchema>
export type MenuAction = z.infer<typeof menuActionSchema>

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
