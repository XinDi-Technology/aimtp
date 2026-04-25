import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';

const handleError = (error: Error, source?: string) => {
  console.error(`[Aimtp] Error in ${source || 'unknown'}:`, error);
  console.error('[Aimtp] Error stack:', error?.stack);

  // Paged.js 渲染错误不应销毁整个页面，仅记录日志
  // 这些错误通常来自第三方库的 DOM 遍历，不影响应用整体框架
  const pagedJsErrorPatterns = [
    'nextSibling', 'previousSibling', 'childNodes',
    'findEndToken', 'checkUnderflowAfterResize',
    'querySelector is not a function',
  ];
  if (pagedJsErrorPatterns.some(p => error?.message?.includes(p))) {
    console.warn('[Aimtp] Paged.js DOM traversal error suppressed. Preview may be incomplete.');
    return;
  }

  // 非第三方库的致命错误，仍需替换页面
  document.body.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; background: #f5f5f5;">
      <h1 style="color: #dc2626; margin-bottom: 20px;">Application Error</h1>
      <p style="color: #666; max-width: 600px; text-align: center;">
        Failed to initialize the application. Please try restarting.
      </p>
      <pre style="margin-top: 20px; padding: 15px; background: #1a1a1a; color: #f5f5f5; border-radius: 8px; max-width: 600px; overflow-x: auto; font-size: 14px;">
        ${error?.stack || error?.message || 'Unknown error'}
      </pre>
    </div>
  `;
};

window.addEventListener('error', (event) => {
  console.error('[Aimtp] Global error handler caught:', event.error);
  handleError(event.error, 'global error handler');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Aimtp] Unhandled promise rejection:', event.reason);
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
} catch (error) {
  console.error('[Aimtp] Fatal error during initialization:', error);
  handleError(error instanceof Error ? error : new Error(String(error)), 'initialization');
}