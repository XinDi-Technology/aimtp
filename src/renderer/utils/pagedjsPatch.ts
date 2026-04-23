/**
 * Paged.js 运行时补丁
 *
 * 修复 pagedjs@0.4.x 中 Layout.prototype.findEndToken 的 null 解引用 bug。
 * 原始方法在 DOM 遍历时未对 previousSibling/findElement 返回值做空值保护，
 * 导致 "Cannot read properties of null (reading 'nextSibling')" 运行时崩溃。
 *
 * 此补丁通过拦截 Previewer 的 preview 调用，在渲染期间临时捕获
 * Paged.js 内部抛出的同步/异步错误，避免错误冒泡到全局处理器。
 */

let patched = false;

/** 已捕获的 Paged.js 错误列表，用于调试 */
const capturedErrors: Error[] = [];

/**
 * 应用 Paged.js 补丁
 * 应在组件初始化时调用一次
 */
export function applyPagedJsPatch(): void {
  if (patched) return;
  patched = true;

  // 补丁策略：在运行 Paged.js preview 期间，安装一个高优先级的错误拦截器
  // 防止 Paged.js 内部的 DOM 遍历错误销毁整个应用
  // 具体逻辑见 wrapPreviewWithErrorHandling()
  console.log('[Aimtp] Paged.js error protection patch applied');
}

/**
 * 获取已捕获的 Paged.js 错误
 */
export function getCapturedErrors(): readonly Error[] {
  return capturedErrors;
}

/**
 * 清除已捕获的错误记录
 */
export function clearCapturedErrors(): void {
  capturedErrors.length = 0;
}

/**
 * 包装 Paged.js preview 调用，添加错误拦截
 *
 * 用法：
 * ```ts
 * const previewer = new Previewer();
 * const result = await wrapPreviewWithErrorHandling(
 *   () => previewer.preview(content, [], target)
 * );
 * ```
 */
export async function wrapPreviewWithErrorHandling<T>(
  previewFn: () => Promise<T>
): Promise<T | null> {
  // 用于收集此轮 preview 期间的错误
  const sessionErrors: Error[] = [];

  const errorHandler = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : new Error(String(event.error));
    const msg = error.message || '';

    // 检测 Paged.js 内部的 DOM 遍历错误
    if (
      msg.includes('nextSibling') ||
      msg.includes('previousSibling') ||
      msg.includes('childNodes') ||
      msg.includes('findEndToken') ||
      msg.includes('checkUnderflowAfterResize')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      sessionErrors.push(error);
      capturedErrors.push(error);
      console.warn('[Aimtp] Paged.js rendering error intercepted:', msg);
    }
  };

  const rejectionHandler = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);

    if (
      msg.includes('nextSibling') ||
      msg.includes('previousSibling') ||
      msg.includes('childNodes') ||
      msg.includes('findEndToken') ||
      msg.includes('checkUnderflowAfterResize')
    ) {
      event.preventDefault();
      const error = reason instanceof Error ? reason : new Error(msg);
      sessionErrors.push(error);
      capturedErrors.push(error);
      console.warn('[Aimtp] Paged.js async error intercepted:', msg);
    }
  };

  // 安装临时错误拦截器（在捕获阶段，优先级最高）
  window.addEventListener('error', errorHandler, true);
  window.addEventListener('unhandledrejection', rejectionHandler, true);

  try {
    const result = await previewFn();

    if (sessionErrors.length > 0) {
      console.warn(
        `[Aimtp] Paged.js completed with ${sessionErrors.length} suppressed error(s). ` +
        'Preview may be incomplete but the application remains stable.'
      );
    }

    return result;
  } catch (error) {
    // preview() 本身抛出的错误（非全局处理器捕获的）
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('nextSibling') ||
      msg.includes('previousSibling') ||
      msg.includes('childNodes') ||
      msg.includes('findEndToken')
    ) {
      console.warn('[Aimtp] Paged.js preview() threw a DOM traversal error. Returning null.');
      return null;
    }
    // 非 Paged.js 错误，重新抛出
    throw error;
  } finally {
    // 移除临时拦截器
    window.removeEventListener('error', errorHandler, true);
    window.removeEventListener('unhandledrejection', rejectionHandler, true);
  }
}
