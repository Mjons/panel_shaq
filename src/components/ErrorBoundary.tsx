import React, { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    // Auto-retry once silently (handles race conditions on initial load)
    if (this.state.retryCount < 2) {
      setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          retryCount: prev.retryCount + 1,
        }));
      }, 100);
    }
  }

  render() {
    if (this.state.hasError && this.state.retryCount >= 2) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-headline font-bold text-primary">
              Something went wrong
            </h1>
            <p className="text-accent/60 text-sm">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, retryCount: 0 })}
              className="px-6 py-3 bg-primary text-background font-bold rounded-lg active:scale-95 transition-transform"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
