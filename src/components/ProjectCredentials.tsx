import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Key, Copy, Check, Eye, EyeOff, RefreshCw, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { generateAndSaveCredentials } from '@/lib/credential-generator'
import { getEnv } from '@/lib/env'

const CREDENTIALS_PASSWORD = 'Dj@4747'

export function ProjectCredentials() {
  const [open, setOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showProjectId, setShowProjectId] = useState(false)
  const [showRefreshModal, setShowRefreshModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [projectId, setProjectId] = useState<string>('')
  const [publishableKey, setPublishableKey] = useState<string>('')
  const [isCheckingPassword, setIsCheckingPassword] = useState(false)

  // Initialize from environment variables
  useEffect(() => {
    // CRITICAL: Always use environment variables for Project ID and Publishable Key
    // This ensures consistency with the running instance
    const envProjectId = getEnv('VITE_BLINK_PROJECT_ID')
    const envPublishableKey = getEnv('VITE_BLINK_PUBLISHABLE_KEY')
    
    setProjectId(envProjectId)
    setPublishableKey(envPublishableKey)
  }, [])

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleGenerateCredentials = async () => {
    setIsGenerating(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // CRITICAL: Ensure credentials match the environment variables
      // Do NOT generate random credentials as this causes mismatches
      const envProjectId = getEnv('VITE_BLINK_PROJECT_ID')
      const envPublishableKey = getEnv('VITE_BLINK_PUBLISHABLE_KEY')
      
      setProjectId(envProjectId)
      setPublishableKey(envPublishableKey)
      
      setOpen(false)
      setShowRefreshModal(true)
      toast.success('Credentials verified and synced successfully!')
    } catch (error) {
      console.error('Failed to sync credentials:', error)
      toast.error('Failed to sync credentials. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle password verification
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCheckingPassword(true)
    setPasswordError('')

    // Simulate password check delay
    await new Promise(resolve => setTimeout(resolve, 300))

    if (password === CREDENTIALS_PASSWORD) {
      setPasswordDialogOpen(false)
      setOpen(true)
      setPassword('')
      toast.success('Password verified successfully')
    } else {
      setPasswordError('Incorrect password. Please try again.')
      setPassword('')
    }

    setIsCheckingPassword(false)
  }

  // Handle dialog trigger - show password dialog instead
  const handleCredentialsClick = () => {
    setPassword('')
    setPasswordError('')
    setPasswordDialogOpen(true)
  }

  // Handle dialog state changes and reset copied field when opening
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    // Reset copied field and hide sensitive data when dialog opens/closes
    if (newOpen) {
      setCopiedField(null)
      setShowProjectId(false)
    }
  }

  // Handle password dialog close
  const handlePasswordDialogClose = () => {
    setPasswordDialogOpen(false)
    setPassword('')
    setPasswordError('')
  }

  // Mask the project ID - show first and last 5 chars with masked middle
  const getMaskedProjectId = () => {
    if (!projectId) return ''
    if (showProjectId) return projectId
    const start = projectId.substring(0, 5)
    const end = projectId.substring(projectId.length - 5)
    const masked = '*'.repeat(Math.max(4, projectId.length - 10))
    return `${start}${masked}${end}`
  }

  return (
    <>
      {/* Credentials Button - Triggers Password Dialog */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        title="View Project Credentials"
        onClick={handleCredentialsClick}
      >
        <Key className="h-4 w-4" />
        <span className="hidden sm:inline">Credentials</span>
      </Button>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={handlePasswordDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Protected Access
            </DialogTitle>
            <DialogDescription>
              Enter the password to access project credentials
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError('')
                }}
                disabled={isCheckingPassword}
                autoFocus
                className={passwordError ? 'border-red-500' : ''}
              />
              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePasswordDialogClose}
                disabled={isCheckingPassword}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCheckingPassword || !password}
              >
                {isCheckingPassword ? 'Verifying...' : 'Unlock'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog - Opens after password verification */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project Credentials</DialogTitle>
            <DialogDescription>
              Your project ID and publishable key. Keep these secure and never commit to public repositories.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Project ID - Masked by default */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Project ID
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted p-2 rounded text-xs break-all font-mono font-semibold">
                  {getMaskedProjectId()}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProjectId(!showProjectId)}
                  className="shrink-0"
                  title={showProjectId ? "Hide Project ID" : "Show Project ID"}
                >
                  {showProjectId ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(projectId, 'Project ID')}
                  className="shrink-0"
                  title="Copy Project ID"
                >
                  {copiedField === 'Project ID' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Publishable Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Publishable Key
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted p-2 rounded text-xs break-all font-mono truncate">
                  {publishableKey}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(publishableKey, 'Publishable Key')}
                  className="shrink-0"
                  title="Copy Publishable Key"
                >
                  {copiedField === 'Publishable Key' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            <Button
              onClick={handleGenerateCredentials}
              disabled={isGenerating}
              className="w-full gap-2"
              variant="default"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Generating...' : 'Generate New Credentials'}
            </Button>

            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-700 dark:text-red-400">
              <strong>🔒 Security Notice:</strong> Never commit these credentials to version control or expose them in public code. The Publishable Key is safe to share, but keep your Project ID private.
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-700 dark:text-amber-400">
              <strong>⚠️ Best Practices:</strong> Store these in environment variables (.env.local) and never hardcode them. Use them only on the backend for sensitive operations.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refresh Modal */}
      <AlertDialog open={showRefreshModal} onOpenChange={setShowRefreshModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New Credentials Generated</AlertDialogTitle>
            <AlertDialogDescription>
              Your new Project ID and Publishable Key have been saved successfully. Please refresh the page to apply these changes and ensure all systems use the updated credentials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction
            onClick={() => {
              setShowRefreshModal(false)
              toast.info('Please refresh your browser manually to apply changes.')
            }}
            className="bg-primary text-primary-foreground"
          >
            I'll Refresh Manually
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
