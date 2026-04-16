import React, { Component, ReactNode } from 'react';
import './styles.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));
  }

  handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleFullReset = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isCritical = this.state.errorCount >= 3;

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">
              {isCritical ? '🚨' : '⚠️'}
            </div>
            <h2>{isCritical ? 'Critical Error' : 'Something went wrong'}</h2>
            <p>
              {isCritical 
                ? 'Multiple errors detected. Please refresh the page.'
                : 'An unexpected error occurred. Try again or refresh the page.'}
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="error-details">
                <h3>Error Details:</h3>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
                <p>Error count: {this.state.errorCount}</p>
              </div>
            )}
            <div className="error-actions">
              {!isCritical && (
                <button className="btn btn-toolbar" onClick={this.handleReset}>
                  Try Again
                </button>
              )}
              <button className="btn btn-primary-action" onClick={this.handleFullReset}>
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
