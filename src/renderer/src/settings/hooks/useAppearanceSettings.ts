import { useEffect, useRef, useState } from 'react'
import type { PublicConfig } from '../../../../shared/api'
import { toMessage } from '../utils/formatters'
import type { SettingsApi } from '../types'

interface Options {
  api: SettingsApi | undefined
  config: PublicConfig
  setConfig: (config: PublicConfig) => void
  flash: (message: string) => void
  setError: (message: string) => void
}

export function useAppearanceSettings({ api, config, setConfig, flash, setError }: Options) {
  const [scaleDraft, setScaleDraft] = useState(config.pet.scale)
  const scaleTimer = useRef<number | null>(null)

  useEffect(() => {
    setScaleDraft(config.pet.scale)
  }, [config.pet.scale])

  useEffect(() => {
    return () => {
      if (scaleTimer.current !== null) {
        window.clearTimeout(scaleTimer.current)
        scaleTimer.current = null
      }
    }
  }, [])

  async function commitScale(value: number): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      const next = await api.savePetSettings({ scale: value })
      setConfig(next)
      setScaleDraft(next.pet.scale)
      flash('已保存')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  function handleScaleChange(value: number): void {
    setScaleDraft(value)
    if (scaleTimer.current !== null) {
      window.clearTimeout(scaleTimer.current)
    }
    scaleTimer.current = window.setTimeout(() => {
      scaleTimer.current = null
      void commitScale(value)
    }, 200)
  }

  function handleScaleCommit(): void {
    if (scaleTimer.current !== null) {
      window.clearTimeout(scaleTimer.current)
      scaleTimer.current = null
    }
    void commitScale(scaleDraft)
  }

  async function importImage(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      const next = await api.importPetImage()
      if (next) {
        setConfig(next)
        setScaleDraft(next.pet.scale)
        flash('已导入新形象')
      }
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  async function resetPosition(): Promise<void> {
    if (!api) {
      return
    }
    setError('')
    try {
      setConfig(await api.resetPetPosition())
      flash('已重置位置')
    } catch (cause) {
      setError(toMessage(cause))
    }
  }

  return {
    scaleDraft,
    handleScaleChange,
    handleScaleCommit,
    importImage,
    resetPosition
  }
}
