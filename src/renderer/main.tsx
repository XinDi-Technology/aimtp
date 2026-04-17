import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

console.log('Aimtp renderer process starting...');

const handleError = (error: Error, source?: string) => {
  console.error(`[Aimtp] Error in ${source || 'unknown'}:`, error);
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; background: #f5f5f5;">
      <h1 style="color: #dc2626; margin-bottom: 20px;">Application Error</h1>
      <p style="color: #666; max-width: 600px; text-align: center;">
        Failed to initialize the application. Please try restarting.
      </p>
      <pre style="margin-top: 20px; padding: 15px; background: #1a1a1a; color: #f5f5f5; border-radius: 8px; max-width: 600px; overflow-x: auto; font-size: 14px;">
        ${error.stack || error.message}
      </pre>
    </div>
  `;
};

window.addEventListener('error', (event) => {
  handleError(event.error, 'global error handler');
});

window.addEventListener('unhandledrejection', (event) => {
  handleError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), 'unhandled promise rejection');
});

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary fallback={<div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        fontSize: '18px',
        color: '#333'
      }}>Application failed to start</div>}>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  
  console.log('Aimtp renderer process started successfully');
} catch (error) {
  handleError(error instanceof Error ? error : new Error(String(error)), 'initialization');
}