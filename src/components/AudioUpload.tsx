import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, X, Loader2, Music } from 'lucide-react'
import { blink } from '@/lib/blink'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { AuthModal } from '@/components/AuthModal'

export interface UploadedAudio {
  id: string
  url: string
  file: File
  name: string
  timestamp: number
}

interface AudioUploadProps {
  onAudioSelect: (audio: UploadedAudio | null) => void
  disabled?: boolean
  className?: string
  currentAudio?: UploadedAudio | null
}

export function AudioUpload({
  onAudioSelect,
  disabled = false,
  className = '',
  currentAudio
}: AudioUploadProps) {
  const { isAuthenticated } = useAuth()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadAudio = async (file: File): Promise<string> => {
    try {
      const originalExtension = file.name.split('.').pop()?.toLowerCase() || 'mp3'
      const safeExtension = ['mp3', 'wav', 'm4a'].includes(originalExtension)
        ? originalExtension
        : 'mp3'

      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 9)
      const safePath = `audio/${timestamp}-${randomId}.${safeExtension}`
      const simpleName = `upload-${timestamp}.${safeExtension}`
      const cleanFile = new File([file], simpleName, { type: file.type })

      const { publicUrl } = await blink.storage.upload(cleanFile, safePath)
      return publicUrl
    } catch (error) {
      console.error('Audio upload failed:', error)
      throw error
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Audio file must be less than 10MB')
      return
    }

    setUploading(true)

    try {
      const publicUrl = await uploadAudio(file)
      
      const newAudio: UploadedAudio = {
        id: `audio-${Date.now()}`,
        url: publicUrl,
        file,
        name: file.name,
        timestamp: Date.now()
      }
      
      onAudioSelect(newAudio)
      toast.success('Audio uploaded successfully')
    } catch (error) {
      toast.error('Failed to upload audio file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    onAudioSelect(null)
  }

  const uploadButton = (
    <Button
      variant="outline"
      onClick={isAuthenticated ? () => fileInputRef.current?.click() : undefined}
      disabled={disabled || uploading}
      className="w-full h-24 border-dashed border-2 bg-background/30 hover:bg-accent/5 hover:border-primary/50 transition-all group rounded-2xl"
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Uploading Audio...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
            <Music className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-center">
            <span className="block text-sm font-bold">
              Drop audio file here
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-1 block">
              MP3, WAV, M4A (Max 10MB)
            </span>
          </div>
        </div>
      )}
    </Button>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      {!currentAudio ? (
        isAuthenticated ? uploadButton : <AuthModal trigger={uploadButton} />
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-muted border border-border/50 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Music className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{currentAudio.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ready for sync</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleRemove}
            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
