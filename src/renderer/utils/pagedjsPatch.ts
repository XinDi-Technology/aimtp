/**
 * Paged.js 运行时补丁
 *
 * 修复 pagedjs@0.4.x 中 Layout.prototype.findEndToken 的 null 解引用 bug。
 * 原始方法在 DOM 遍历时未对 previousSibling/findElement 返回值做空值保护，
 * 导致 "Cannot read properties of null (reading 'nextSibling')" 运行时崩溃。
 *
 * 补丁策略：在应用启动时永久安装全局错误拦截器，拦截 Paged.js 内部的
 * DOM 遍历错误（包括延迟的 ResizeObserver 回调触发的错误），
 * 防止错误冒泡到全局处理器导致应用崩溃或布局异常。
 */

let patched = false;

const capturedErrors: Error[] = [];

function isPagedJsError(msg: string): boolean {
  return (
    msg.includes('nextSibling') ||
    msg.includes('previousSibling') ||
    msg.includes('childNodes') ||
    msg.includes('findEndToken') ||
    msg.includes('checkUnderflowAfterResize') ||
    msg.includes('checkOverflowAfterResize') ||
    msg.includes('querySelector is not a function')
  );
}

const globalErrorHandler = (event: ErrorEvent) => {
  const error = event.error instanceof Error ? event.error : new Error(String(event.error));
  const msg = error.message || '';

  if (isPagedJsError(msg)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    capturedErrors.push(error);
    console.warn('[Aimtp] Paged.js error intercepted (global):', msg);
  }
};

const globalRejectionHandler = (event: PromiseRejectionEvent) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason);

  if (isPagedJsError(msg)) {
    event.preventDefault();
    const error = reason instanceof Error ? reason : new Error(msg);
    capturedErrors.push(error);
    console.warn('[Aimtp] Paged.js async error intercepted (global):', msg);
  }
};

/**
 * 应用 Paged.js 补丁
 * 应在应用初始化时调用一次，永久安装全局错误拦截器
 */
export function applyPagedJsPatch(): void {
  if (patched) return;
  patched = true;

  window.addEventListener('error', globalErrorHandler, true);
  window.addEventListener('unhandledrejection', globalRejectionHandler, true);

  console.log('[Aimtp] Paged.js global error protection installed');
}

/**
 * 移除 Paged.js 补丁
 * 应在应用卸载时调用
 */
export function removePagedJsPatch(): void {
  if (!patched) return;
  patched = false;

  window.removeEventListener('error', globalErrorHandler, true);
  window.removeEventListener('unhandledrejection', globalRejectionHandler, true);

  console.log('[Aimtp] Paged.js global error protection removed');
}

export function getCapturedErrors(): readonly Error[] {
  return capturedErrors;
}

export function clearCapturedErrors(): void {
  capturedErrors.length = 0;
}

/**
 * 包装 Paged.js preview 调用，添加错误拦截
 *
 * 全局拦截器已永久安装，此函数仅提供 preview 级别的错误收集和降级处理。
 * 不再安装/移除临时拦截器，避免延迟回调（如 ResizeObserver）的错误被遗漏。
 */
export async function wrapPreviewWithErrorHandling<T>(
  previewFn: () => Promise<T>
): Promise<T | null> {
  const sessionErrorCountBefore = capturedErrors.length;

  try {
    const result = await previewFn();

    const newErrors = capturedErrors.length - sessionErrorCountBefore;
    if (newErrors > 0) {
      console.warn(
        `[Aimtp] Paged.js completed with ${newErrors} suppressed error(s). ` +
        'Preview may be incomplete but the application remains stable.'
      );
    }

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (isPagedJsError(msg)) {
      console.warn('[Aimtp] Paged.js preview() threw a DOM traversal error. Returning null.');
      return null;
    }
    throw error;
  }
}
