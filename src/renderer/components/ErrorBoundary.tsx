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
    console.error('React Error caught in getDerivedStateFromError:', error);
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
        <div className="error-boundary" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minHeight: '100vh', 
          padding: '20px',
          background: '#f5f5f5'
        }}>
          <div className="error-boundary-content" style={{
            textAlign: 'center',
            maxWidth: '600px',
            background: 'white',
            padding: '40px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <div className="error-icon" style={{ fontSize: '64px', marginBottom: '20px' }}>
              {isCritical ? '🚨' : '⚠️'}
            </div>
            <h2 style={{ 
              fontSize: '24px', 
              marginBottom: '16px', 
              color: isCritical ? '#dc2626' : '#374151' 
            }}>
              {isCritical ? 'Critical Error' : 'Something went wrong'}
            </h2>
            <p style={{ 
              marginBottom: '24px', 
              color: '#6b7280', 
              lineHeight: '1.6' 
            }}>
              {isCritical 
                ? 'Multiple errors detected. Please refresh the page.'
                : 'An unexpected error occurred. Try again or refresh the page.'}
            </p>
            {this.state.error && (
              <div className="error-details" style={{
                textAlign: 'left',
                background: '#1a1a1a',
                color: '#f5f5f5',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px',
                fontSize: '14px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                <h3 style={{ marginBottom: '12px', color: '#f5f5f5' }}>Error Details:</h3>
                <pre style={{ margin: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
            <div className="error-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {!isCritical && (
                <button 
                  className="btn btn-toolbar" 
                  onClick={this.handleReset}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Try Again
                </button>
              )}
              <button 
                className="btn btn-primary-action" 
                onClick={this.handleFullReset}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#007bff',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
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
