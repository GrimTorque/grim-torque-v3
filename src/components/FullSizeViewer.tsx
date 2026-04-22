import { X, Download, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { useEffect } from 'react'

interface FullSizeViewerProps {
  mediaUrl: string | null
  onClose: () => void
  mediaType?: 'image' | 'video'
  prompt?: string
  onDownload?: () => void
}

export function FullSizeViewer({ 
  mediaUrl, 
  onClose, 
  mediaType = 'image',
  prompt,
  onDownload 
}: FullSizeViewerProps) {
  // Move useEffect before conditional return
  useEffect(() => {
    // Only add listener if mediaUrl is present
    if (!mediaUrl) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mediaUrl, onClose])

  if (!mediaUrl) return null

  const handleCopyPrompt = () => {
    if (prompt) {
      navigator.clipboard.writeText(prompt)
      toast.success('Prompt copied to clipboard')
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-7xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Controls */}
        <div className="flex items-center justify-between mb-4 gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            {prompt && (
              <p className="text-white/80 text-xs sm:text-sm line-clamp-1">
                <span className="text-primary font-bold">Prompt:</span> {prompt}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {prompt && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCopyPrompt}
                className="rounded-lg sm:rounded-xl font-bold h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm"
                title="Copy Prompt"
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
            )}
            {onDownload && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onDownload}
                className="rounded-lg sm:rounded-xl font-bold h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm"
                title="Download"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={onClose}
              className="rounded-lg sm:rounded-xl font-bold h-8 w-8 sm:h-10 sm:w-10 p-0"
              title="Close (ESC)"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>

        {/* Media Container */}
        <div className="flex-1 min-h-0 bg-black/50 border border-border/50 overflow-hidden rounded-lg sm:rounded-2xl flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center max-h-[calc(100vh-200px)]">
            {mediaType === 'image' ? (
              <img
                src={mediaUrl}
                alt="Full Size Preview"
                className="max-w-full max-h-full object-contain"
                loading="lazy"
              />
            ) : (
              <video
                src={mediaUrl}
                controls
                className="max-w-full max-h-full object-contain"
                autoPlay
                loop
              />
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-white/60 text-xs gap-2">
          <span className="uppercase tracking-widest font-bold">
            {mediaType === 'image' ? '🖼️ Full Size Image' : '🎬 Full Size Video'}
          </span>
          <span className="text-right text-white/40">Press ESC to close</span>
        </div>
      </div>
    </div>
  )
}
