import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from './ui/button'
import { AlertCircle, RefreshCcw } from 'lucide-react'

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card rounded-3xl p-8 text-center space-y-6 aura-glow border-destructive/20">
            <div className="h-16 w-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The application encountered an unexpected error. We've been notified and are looking into it.
              </p>
            </div>
            {this.state.error && (
              <div className="p-3 bg-muted rounded-xl text-left">
                <p className="text-[10px] font-mono text-muted-foreground break-all overflow-hidden line-clamp-2">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <Button 
              onClick={() => window.location.reload()}
              className="w-full gap-2 font-bold"
              variant="default"
            >
              <RefreshCcw className="h-4 w-4" />
              Reload Application
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
