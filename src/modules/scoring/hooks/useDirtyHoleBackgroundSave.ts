import { useEffect, type MutableRefObject } from 'react'
import type { HoleDraftInputs, PersistedHoleState } from '@modules/scoring/domain/holeAutosave'

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

type Params = {
  saveStateRef: MutableRefObject<SaveState>
  holeDraftRef: MutableRefObject<HoleDraftInputs | null>
  persistedHoleStateRef: MutableRefObject<PersistedHoleState | null>
  activeHoleNumberRef: MutableRefObject<number>
  runHoleSave: (holeNumber: number, run: () => Promise<boolean>) => Promise<boolean>
  persistHoleDraftOnce: (options: {
    holeNumber: number
    draft: HoleDraftInputs
    persisted: PersistedHoleState
    background: boolean
  }) => Promise<boolean>
}

export function useDirtyHoleBackgroundSave({
  saveStateRef,
  holeDraftRef,
  persistedHoleStateRef,
  activeHoleNumberRef,
  runHoleSave,
  persistHoleDraftOnce,
}: Params) {
  useEffect(() => {
    const persistSnapshot = (background: boolean) => {
      const draft = holeDraftRef.current
      const persisted = persistedHoleStateRef.current
      if (!draft || !persisted) return
      void runHoleSave(activeHoleNumberRef.current, () =>
        persistHoleDraftOnce({
          holeNumber: activeHoleNumberRef.current,
          draft,
          persisted,
          background,
        }),
      )
    }

    const onOnline = () => {
      if (saveStateRef.current !== 'error' && saveStateRef.current !== 'dirty') return
      persistSnapshot(saveStateRef.current === 'dirty')
    }

    const persistDirtyInBackground = () => {
      if (saveStateRef.current !== 'dirty') return
      persistSnapshot(true)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistDirtyInBackground()
      }
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('pagehide', persistDirtyInBackground)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', persistDirtyInBackground)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [
    activeHoleNumberRef,
    holeDraftRef,
    persistHoleDraftOnce,
    persistedHoleStateRef,
    runHoleSave,
    saveStateRef,
  ])
}
