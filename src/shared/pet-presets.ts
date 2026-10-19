export const PET_PRESET_IDS = [
  'default',
  'preset-flower-cat',
  'preset-cat-pair',
  'preset-schoolgirl'
] as const

export type PetPresetId = (typeof PET_PRESET_IDS)[number]

export interface PetPreset {
  id: PetPresetId
  label: string
}

export const PET_PRESETS: readonly PetPreset[] = [
  { id: 'default', label: '再花猫猫头' },
  { id: 'preset-flower-cat', label: '方长猫猫头' },
  { id: 'preset-cat-pair', label: '贴贴猫猫头' },
  { id: 'preset-schoolgirl', label: '粉毛猫娘' }
]

export function isPetPresetId(value: string): value is PetPresetId {
  return (PET_PRESET_IDS as readonly string[]).includes(value)
}

export function petPresetLabel(id: string): string | null {
  return PET_PRESETS.find((preset) => preset.id === id)?.label ?? null
}
