/**
 * Paged.js 0.5.0-beta.2 type definitions
 * Covers: Previewer, Handler, Chunker, Polisher, Flow, Page, events, and lifecycle hooks
 */
declare module 'pagedjs' {
  // ─── Core Types ───

  export interface Page {
    id: number;
    element: HTMLElement;
    position: number;
    total: number;
  }

  export interface Flow {
    total: number;
    pages: Page[];
  }

  // ─── Previewer Events ───

  export interface PreviewerPageEvent {
    page: Page;
  }

  export interface PreviewerRenderingEvent {
    pages: Page[];
  }

  export interface PreviewerRenderedEvent {
    pages: Page[];
    flow: Flow;
  }

  export interface PreviewerSizeEvent {
    width: number;
    height: number;
  }

  export interface PreviewerAtPagesEvent {
    pages: Page[];
  }

  // ─── Previewer ───

  export class Previewer {
    chunker: Chunker;
    polisher: Polisher;

    preview(
      content: string | HTMLElement | Document,
      stylesheets?: string[],
      renderTo?: HTMLElement,
    ): Promise<Flow>;

    on(event: 'page', listener: (e: PreviewerPageEvent) => void): void;
    on(event: 'rendering', listener: (e: PreviewerRenderingEvent) => void): void;
    on(event: 'rendered', listener: (e: PreviewerRenderedEvent) => void): void;
    on(event: 'size', listener: (e: PreviewerSizeEvent) => void): void;
    on(event: 'atpages', listener: (e: PreviewerAtPagesEvent) => void): void;

    off(event: 'page', listener: (e: PreviewerPageEvent) => void): void;
    off(event: 'rendering', listener: (e: PreviewerRenderingEvent) => void): void;
    off(event: 'rendered', listener: (e: PreviewerRenderedEvent) => void): void;
    off(event: 'size', listener: (e: PreviewerSizeEvent) => void): void;
    off(event: 'atpages', listener: (e: PreviewerAtPagesEvent) => void): void;

    emit(event: string, data?: unknown): void;
  }

  // ─── Handler Lifecycle Hooks ───

  export interface HandlerContext {
    chunker: Chunker;
    polisher: Polisher;
    caller: Previewer;
  }

  export class Handler {
    constructor(chunker?: Chunker, polisher?: Polisher, caller?: Previewer);
    chunker: Chunker;
    polisher: Polisher;
    caller: Previewer;

    // Previewer-level hooks
    beforePreview(content: string | HTMLElement, stylesheets?: string[]): void;
    afterPreview(flow: Flow): void;

    // Chunker-level hooks
    beforeChunker(content: string | HTMLElement): void;
    afterChunker(flow: Flow): void;

    // Page-level hooks
    beforePageLayout(pageElement: HTMLElement, breakToken?: unknown): void;
    afterPageLayout(
      pageElement: HTMLElement,
      page: Page,
      breakToken?: unknown,
    ): void;

    // Layout-level hooks
    beforeLayout(fragment: HTMLElement, page: Page): void;
    afterLayout(fragment: HTMLElement, page: Page): void;

    // Rendered hooks
    afterRendered(pages: Page[]): void;

    // Polisher-level hooks
    beforePolisher(content: string | HTMLElement): void;
    afterPolisher(): void;

    // At-page hooks
    onAtPage(page: Page): void;
  }

  // ─── Chunker ───

  export class Chunker {
    pages: Page[];
    hooks: Record<string, unknown>;

    addPage(blank?: boolean): Page;
  }

  // ─── Polisher ───

  export class Polisher {
    hooks: Record<string, unknown>;
  }

  // ─── Registration ───

  export function registerHandlers(...handlers: (typeof Handler)[]): void;
  export function initializeHandlers(
    chunker: Chunker,
    polisher: Polisher,
    caller: Previewer,
  ): void;
  export const registeredHandlers: (typeof Handler)[];
}
