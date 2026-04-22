import { useProgress } from '@/hooks/use-progress'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Zap } from 'lucide-react'

export function ProgressBar() {
  const {
    isProgressActive,
    progress,
    stageProgress,
    finalizingProgress,
    progressMessage,
    currentStage,
    stageCount,
    currentStageIndex,
  } = useProgress()

  if (!isProgressActive) {
    return null
  }

  return (
    <div className="fixed bottom-6 left-6 right-6 max-w-lg z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="border-primary/20 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        <CardContent className="p-6 space-y-4">
          {/* Header with status */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                <div className="absolute inset-0 h-5 w-5 rounded-full border-2 border-primary/20 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {progressMessage}
                </p>
                {currentStage && (
                  <p className="text-xs text-primary/70 mt-0.5 leading-tight">
                    {currentStage}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-primary tabular-nums">
                {Math.round(progress)}%
              </div>
              <div className="text-xs text-muted-foreground/70 font-medium">
                {stageCount > 0 && `Step ${Math.min(currentStageIndex + 1, stageCount)}/${stageCount}`}
              </div>
            </div>
          </div>

          {/* Main progress bar - Overall */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-muted-foreground/60 px-0.5 uppercase tracking-wider font-bold">
              <span>Overall Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="relative overflow-hidden rounded-full bg-background/50 h-2.5">
              <Progress 
                value={progress} 
                className="h-2.5"
              />
              <div 
                className="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
                style={{
                  width: `${Math.max(progress, 5)}%`,
                  animation: 'shimmer 2s infinite'
                }}
              />
            </div>
          </div>

          {/* Step progress bar - Second Bar */}
          {stageCount > 0 && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex justify-between text-[10px] text-muted-foreground/60 px-0.5 uppercase tracking-wider font-bold">
                <span>Step {Math.min(currentStageIndex + 1, stageCount)} Progress</span>
                <span>{stageProgress}%</span>
              </div>
              <div className="relative overflow-hidden rounded-full bg-background/30 h-1.5">
                <Progress 
                  value={stageProgress} 
                  className="h-1.5"
                />
              </div>
            </div>
          )}

          {/* Finalizing progress bar - Third Bar */}
          {(currentStage === 'Finalizing' || currentStageIndex === stageCount - 1) && (
            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex justify-between text-[10px] text-primary/80 px-0.5 uppercase tracking-wider font-bold">
                <span className="flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                  Real-time Finalizing
                </span>
                <span>{Math.round(finalizingProgress)}%</span>
              </div>
              <div className="relative overflow-hidden rounded-full bg-primary/10 h-2 border border-primary/20">
                <Progress 
                  value={finalizingProgress} 
                  className="h-2 bg-transparent"
                />
                <div 
                  className="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 animate-shimmer-fast"
                  style={{
                    width: `${Math.max(finalizingProgress, 10)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between text-xs text-muted-foreground/60 px-0.5">
            <span>Processing Status</span>
            <span className="font-medium text-primary/70">
              {progress < 30 ? 'Initializing' : progress < 60 ? 'Synthesizing' : progress < 85 ? 'Optimizing' : 'Finalizing Masterpiece'}
            </span>
          </div>

          {/* Stage indicator if multiple stages */}
          {stageCount > 0 && (
            <div className="flex gap-1">
              {Array.from({ length: stageCount }).map((_, idx) => (
                <div
                  key={idx}
                  className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                    idx < currentStageIndex + 1
                      ? 'bg-primary shadow-sm shadow-primary/50'
                      : idx === currentStageIndex
                        ? 'bg-primary/60 animate-pulse'
                        : 'bg-border/50'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Performance indicator */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500" />
              <span>Real-time tracking</span>
            </div>
            <div className="text-xs font-mono text-muted-foreground/50">
              {progress === 100 ? 'Complete' : `${Math.round(100 - progress)}% remaining`}
            </div>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes shimmer-fast {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        .animate-shimmer-fast {
          animation: shimmer-fast 1.5s infinite linear;
        }
      `}</style>
    </div>
  )
}
