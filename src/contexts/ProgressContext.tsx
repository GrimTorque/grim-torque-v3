import React, { createContext, useContext, useState, useCallback } from 'react'

interface ProgressState {
  isProgressActive: boolean
  progress: number
  stageProgress: number // New field for current stage progress
  finalizingProgress: number // New field for real-time finalizing progress
  progressMessage: string
  estimatedTime: number
  currentStage: string | null
  stageCount: number
  currentStageIndex: number
}

interface ProgressContextType extends ProgressState {
  startProgress: (
    message: string,
    estimatedTime: number,
    options?: { stageCount?: number }
  ) => void
  updateProgress: (
    percentage: number,
    message?: string,
    stageInfo?: { currentStage: string; stageIndex: number; stageCount: number; stageProgress?: number }
  ) => void
  updateFinalizingProgress: (percentage: number) => void // New method
  incrementProgress: (amount: number, message?: string) => void
  setStageProgress: (
    stageIndex: number,
    stageCount: number,
    stageName: string,
    stageProgress: number
  ) => void
  completeProgress: () => void
  resetProgress: () => void
}

export const ProgressContext = createContext<ProgressContextType | undefined>(undefined)

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>({
    isProgressActive: false,
    progress: 0,
    stageProgress: 0,
    finalizingProgress: 0,
    progressMessage: '',
    estimatedTime: 0,
    currentStage: null,
    stageCount: 0,
    currentStageIndex: 0,
  })

  const startProgress = useCallback(
    (
      message: string,
      estimatedTime: number = 1800000,
      options?: { stageCount?: number }
    ) => {
      setState({
        isProgressActive: true,
        progress: 0,
        stageProgress: 0,
        finalizingProgress: 0,
        progressMessage: message,
        estimatedTime,
        currentStage: null,
        stageCount: options?.stageCount || 0,
        currentStageIndex: 0,
      })
    },
    []
  )

  const updateProgress = useCallback(
    (
      percentage: number,
      message?: string,
      stageInfo?: { currentStage: string; stageIndex: number; stageCount: number; stageProgress?: number }
    ) => {
      setState((prev) => {
        const clamped = Math.min(Math.max(percentage, 0), 99)
        return {
          ...prev,
          progress: clamped,
          stageProgress: stageInfo?.stageProgress ?? prev.stageProgress,
          progressMessage: message || prev.progressMessage,
          currentStage: stageInfo?.currentStage || prev.currentStage,
          currentStageIndex: stageInfo?.stageIndex ?? prev.currentStageIndex,
          stageCount: stageInfo?.stageCount || prev.stageCount,
        }
      })
    },
    []
  )

  const updateFinalizingProgress = useCallback((percentage: number) => {
    setState((prev) => ({
      ...prev,
      finalizingProgress: Math.min(Math.max(percentage, 0), 100),
    }))
  }, [])

  const incrementProgress = useCallback((amount: number, message?: string) => {
    setState((prev) => ({
      ...prev,
      progress: Math.min(prev.progress + amount, 99),
      progressMessage: message || prev.progressMessage,
    }))
  }, [])

  const setStageProgress = useCallback(
    (
      stageIndex: number,
      stageCount: number,
      stageName: string,
      stageProgress: number
    ) => {
      setState((prev) => ({
        ...prev,
        currentStageIndex: stageIndex,
        stageCount,
        currentStage: stageName,
        progress: Math.min(Math.max(stageProgress, 0), 99),
      }))
    },
    []
  )

  const resetProgress = useCallback(() => {
    setState({
      isProgressActive: false,
      progress: 0,
      stageProgress: 0,
      finalizingProgress: 0,
      progressMessage: '',
      estimatedTime: 0,
      currentStage: null,
      stageCount: 0,
      currentStageIndex: 0,
    })
  }, [])

  const completeProgress = useCallback(() => {
    setState((prev) => ({
      ...prev,
      progress: 100,
      finalizingProgress: 100,
      progressMessage: 'Complete!',
    }))

    // Auto-reset after animation completes
    setTimeout(() => {
      resetProgress()
    }, 800)
  }, [resetProgress])

  const value: ProgressContextType = {
    ...state,
    startProgress,
    updateProgress,
    updateFinalizingProgress,
    incrementProgress,
    setStageProgress,
    completeProgress,
    resetProgress,
  }

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}