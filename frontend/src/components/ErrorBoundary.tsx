'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('UI ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Something went wrong
          </h1>
          <p className="max-w-md text-sm text-gray-600">
            An unexpected error occurred. You can try reloading the page or
            return home.
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="max-w-2xl overflow-auto rounded bg-gray-900 p-4 text-left text-xs text-gray-100">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-900 hover:bg-gray-300"
            >
              Try again
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/';
              }}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Go home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
