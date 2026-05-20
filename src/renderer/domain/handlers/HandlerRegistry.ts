/**
 * HandlerRegistry — Handler 注册管理
 *
 * 管理 Paged.js Handler 的注册和注销。
 * PagedJsAdapter 在 layout() 中调用 HandlerRegistry 注册所有 Handler。
 *
 * 用法：
 *   const registry = HandlerRegistry.getInstance();
 *   registry.register(HeaderFooterHandler);
 *   registry.register(AnotherHandler);
 *   // ... later in PagedJsAdapter.layout():
 *   const handlerClasses = registry.getAllHandlerClasses();
 */

import type { AimtpHandler } from './AimtpHandler';

type HandlerConstructor = new (...args: unknown[]) => AimtpHandler;

export class HandlerRegistry {
  private static instance: HandlerRegistry | null = null;
  private handlerClasses: HandlerConstructor[] = [];

  private constructor() {}

  /** 获取单例实例 */
  static getInstance(): HandlerRegistry {
    if (!HandlerRegistry.instance) {
      HandlerRegistry.instance = new HandlerRegistry();
    }
    return HandlerRegistry.instance;
  }

  /** 注册一个 Handler 类 */
  register(handlerClass: HandlerConstructor): void {
    if (this.handlerClasses.includes(handlerClass)) {
      console.warn('[HandlerRegistry] Handler already registered, skipping:', handlerClass.name);
      return;
    }
    this.handlerClasses.push(handlerClass);
  }

  /** 注销一个 Handler 类 */
  unregister(handlerClass: HandlerConstructor): void {
    const index = this.handlerClasses.indexOf(handlerClass);
    if (index !== -1) {
      this.handlerClasses.splice(index, 1);
    }
  }

  /** 获取所有已注册的 Handler 类 */
  getAllHandlerClasses(): HandlerConstructor[] {
    return [...this.handlerClasses];
  }

  /** 清除所有已注册的 Handler 类 */
  clearAll(): void {
    this.handlerClasses = [];
  }

  /** 获取已注册的 Handler 数量 */
  get count(): number {
    return this.handlerClasses.length;
  }
}

/** 便捷导出：全局单例 */
export const handlerRegistry = HandlerRegistry.getInstance();
