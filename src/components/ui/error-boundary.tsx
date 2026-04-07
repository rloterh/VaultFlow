"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
            Something went wrong
          </h3>
          <p className="mt-1 max-w-sm text-sm text-neutral-500">
            An unexpected error occurred. Please try again.
          </p>
          {this.state.error && (
            <pre className="mt-4 max-w-md overflow-auto rounded-lg bg-neutral-100 p-3 text-left text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {this.state.error.message}
            </pre>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
