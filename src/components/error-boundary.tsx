'use client'

import React, { Component, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-destructive/40 bg-card">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-xs text-muted-foreground">
                An unexpected error occurred while rendering this section.
              </p>
              {this.state.error && (
                <div className="p-2.5 rounded bg-muted text-[11px] font-mono text-left overflow-auto max-h-24">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex justify-center gap-2 pt-2">
                <Button size="sm" onClick={this.handleReset} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Try Again
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
