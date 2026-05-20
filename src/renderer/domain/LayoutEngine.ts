import type { LayoutDOM } from './LayoutDOM';

export interface LayoutEngine {
  layout(html: string, iframe: HTMLIFrameElement, sourceHash: string): Promise<LayoutDOM>;
  dispose(): void;
}
