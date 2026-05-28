/**
 * PagedJsAdapter — Paged.js 适配层（模块化 API 模式，方案C: IIFE 注入）
 *
 * 重构说明（迭代2）：
 * - 从 polyfill 注入模式 → 模块化 API 模式（Previewer 类 + Handler 机制）
 * - 采用方案C：将 pagedjs ESM 打包为 IIFE 注入 iframe，确保 Paged.js 在正确的 window 上下文中运行
 * - 不再使用 ?raw 导入 polyfill JS 文本
 * - 不再使用轮询检测 PagedPolyfill 全局变量
 * - 使用 Previewer 类实例化和 preview() 调用
 * - 通过 Previewer 事件系统监听分页进度
 * - 支持 Handler 注册机制（由 HandlerRegistry 管理）
 */

import type { LayoutEngine } from './LayoutEngine';
import type { LayoutDOM, LayoutDOMMetadata, LayoutDOMProvenance } from './LayoutDOM';
import type { Flow, Page } from 'pagedjs';
import { handlerRegistry } from './handlers/HandlerRegistry';
import type { HeaderFooterConfig, FrontMatter } from './handlers/AimtpHandler';
import pagedJsIifeCode from '../assets/vendor/pagedjs.iife.js?raw';

const FONT_READY_TIMEOUT = 5000;
const DOCUMENT_READY_TIMEOUT = 2000;
const PAGEDJS_READY_TIMEOUT = 10000;
const PREVIEW_TIMEOUT = 30000; // previewer.preview() 超时 30s，防止 Paged.js 卡死

/** 分页进度回调 */
export type LayoutProgressCallback = (
  phase: 'fonts' | 'document' | 'injecting' | 'rendering' | 'page' | 'done',
  detail?: { current?: number; total?: number },
) => void;

/** Previewer 实例接口（含事件系统） */
interface PreviewerInstance {
  preview(
    content: string | HTMLElement | Document,
    stylesheets?: (string | Record<string, string>)[],
    renderTo?: HTMLElement,
  ): Promise<Flow>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}

/** __pagedjs 全局变量接口（IIFE 注入后暴露） */
interface PagedJsBridge {
  Previewer: new () => PreviewerInstance;
  Handler: new () => unknown;
  Chunker: unknown;
  Polisher: unknown;
  registerHandlers: (...handlers: unknown[]) => void;
  initializeHandlers: (...args: unknown[]) => void;
  createPreviewer: () => PreviewerInstance;
  createHandler: () => unknown;
}

export class PagedJsAdapter implements LayoutEngine {
  private disposed = false;
  private progressCallback: LayoutProgressCallback | null = null;
  private registeredHandlerConstructors: (new (...args: unknown[]) => unknown)[] = [];
  private handlerConfig: HeaderFooterConfig | null = null;
  private frontMatter: FrontMatter | null = null;

  /** 设置进度回调 */
  onProgress(callback: LayoutProgressCallback): void {
    this.progressCallback = callback;
  }

  /** 注册 Handler 类（在 layout 前调用） */
  registerHandler(handlerClass: new (...args: unknown[]) => unknown): void {
    this.registeredHandlerConstructors.push(handlerClass);
  }

  /** 清除所有已注册的 Handler 类 */
  clearHandlers(): void {
    this.registeredHandlerConstructors = [];
  }

  /** 配置页眉页脚 Handler（在 layout 前调用） */
  setHeaderFooterConfig(config: HeaderFooterConfig, frontMatter?: FrontMatter): void {
    this.handlerConfig = config;
    this.frontMatter = frontMatter ?? null;
  }

  async layout(
    html: string,
    iframe: HTMLIFrameElement,
    sourceHash: string,
  ): Promise<LayoutDOM> {
    if (this.disposed) {
      throw new Error('PagedJsAdapter has been disposed');
    }

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      throw new Error('iframe contentDocument/contentWindow is not available');
    }

    this.emitProgress('fonts');
    await this.waitForFonts(doc);

    this.emitProgress('document');
    await this.waitForDocumentReady(iframe);

    // 1. Write HTML content into iframe
    doc.open();
    doc.write(html);
    doc.close();

    // [PAGEDJS_WORKAROUND] 1.5. Protect TD/TH/LI from lastChildCheck removal.
    // pagedjs removes empty overflowTagged elements. For TD/TH/LI, this breaks
    // column structure and line numbering. Pre-insert a zero-width space so
    // textContent.trim() is never empty, even after content extraction.
    // Remove this if pagedjs upstream fully fixes lastChildCheck exclusion.
    this.protectStructuralElements(doc);

    // [PAGEDJS_WORKAROUND] 1.6. Prevent SVG child elements from being lost.
    // Three problems cause SVG elements to disappear during Paged.js layout:
    //
    // A) UndisplayedFilter drops elements with empty style.display.
    //    removable() returns true when element.style.display is "" or "none".
    //    SVG children (<rect>, <line>, <path>) often lack a style attribute, so
    //    element.style.display is "" → marked data-undisplayed → skipped in cloning.
    //    Fix: ensure ALL SVG child elements have explicit display:inline in their style.
    //
    // B) lastChildCheck() removes overflow-tagged elements with empty textContent.
    //    When Paged.js splits content across pages, tagAndCreateOverflowRange() marks
    //    elements with data-overflow-tagged. Then lastChildCheck() removes any element
    //    that has overflow-tagged AND textContent.trim()=="". SVG <rect> elements have
    //    no text content, so they get deleted.
    //    Fix: prevent SVG from being split by setting break-inside:avoid. Paged.js's
    //    avoidBreakInside() checks data-original-break-inside==="avoid" — when found,
    //    the element is treated as atomic and tagAndCreateOverflowRange() is never
    //    called on its children, so overflow-tagged is never set on them.
    //
    // C) (belt-and-suspenders) Also set data-original-break-inside directly on <svg>
    //    in case Paged.js's CSS processing doesn't convert break-inside:avoid from
    //    inline style for SVG-namespace elements.

    for (const svg of doc.querySelectorAll('svg')) {
      // Fix B: prevent SVG from being split across pages
      svg.setAttribute('data-original-break-inside', 'avoid');
      const svgStyle = svg.getAttribute('style');
      const breakInsideProp = 'break-inside:avoid';
      if (!svgStyle) {
        svg.setAttribute('style', breakInsideProp);
      } else if (!/break-inside\s*:/i.test(svgStyle)) {
        svg.setAttribute('style', `${svgStyle}; ${breakInsideProp}`);
      }

      // Fix A: ensure all SVG child elements have display:inline
      // IMPORTANT: skip elements inside <defs>. <defs> is display:none by default
      // and contains <marker>, <linearGradient>, <pattern> etc. that are only
      // rendered when referenced. Setting display:inline on <defs> children would
      // make Paged.js treat them as visible content, potentially corrupting the
      // marker definitions and breaking line-end direction indicators (dots/arrows).
      const defsEls = svg.querySelectorAll('defs');
      const defsSet = new Set<Element>();
      for (const defs of defsEls) {
        defsSet.add(defs);
        for (const desc of defs.querySelectorAll('*')) {
          defsSet.add(desc);
        }
      }
      for (const el of svg.querySelectorAll('*')) {
        if (defsSet.has(el)) continue; // skip <defs> and its descendants
        const styleAttr = el.getAttribute('style');
        if (!styleAttr) {
          el.setAttribute('style', 'display:inline');
        } else if (!/\bdisplay\s*:/i.test(styleAttr)) {
          el.setAttribute('style', `display:inline; ${styleAttr}`);
        }
      }
    }

    // [DIAG] Check SVG element counts BEFORE pagedjs
    const svgRectsBefore = doc.querySelectorAll('svg rect').length;
    const svgCirclesBefore = doc.querySelectorAll('svg circle').length;
    const svgMarkersBefore = doc.querySelectorAll('svg marker').length;
    const svgDefsBefore = doc.querySelectorAll('svg defs').length;
    const svgMarkerEndsBefore = doc.querySelectorAll('svg [marker-end]').length;
    console.log(`[DIAG] SVG BEFORE pagedjs: rect=${svgRectsBefore} circle=${svgCirclesBefore} marker=${svgMarkersBefore} defs=${svgDefsBefore} marker-end=${svgMarkerEndsBefore}`);
    // Log marker definitions
    for (const m of doc.querySelectorAll('svg marker')) {
      console.log(`[DIAG] BEFORE marker: id="${m.getAttribute('id')}" viewBox="${m.getAttribute('viewBox')}" children=${m.children.length}`);
    }
    // Log elements with marker-end (direction indicators)
    for (const el of doc.querySelectorAll('svg [marker-end]')) {
      console.log(`[DIAG] BEFORE marker-end: tag="${el.tagName}" class="${el.getAttribute('class')}" marker-end="${el.getAttribute('marker-end')}"`);
    }

    // 2. Inject pagedjs IIFE into iframe
    this.emitProgress('injecting');
    this.injectPagedJsIife(doc);

    // 3. Wait for __pagedjs bridge to be available
    const bridge = await this.waitForPagedJsBridge(iframe);

    // 4. Register Handlers from HandlerRegistry + locally registered handlers
    const allHandlerClasses = [
      ...handlerRegistry.getAllHandlerClasses(),
      ...this.registeredHandlerConstructors,
    ];
    // Deduplicate
    const uniqueHandlerClasses = [...new Set(allHandlerClasses)];
    if (uniqueHandlerClasses.length > 0) {
      const handlerInstances = uniqueHandlerClasses.map(
        (HandlerClass) => new HandlerClass(),
      );
      bridge.registerHandlers(...handlerInstances);
    }

    // 5. Inject CSS workarounds BEFORE creating the Previewer.
    //    Paged.js's Polisher reads document.stylesheets during its setup phase
    //    (triggered by either the Previewer constructor or preview()). All CSS
    //    must be in the document before that point, otherwise handlers like
    //    Footnotes won't see float:footnote / @page declarations.

    // 5a. Inject :root { --pagedjs-margin-* } from author CSS to override
    //     pagedjs base :root values, since pagedjs addMarginVars() may not
    //     set correct margin CSS variables on individual page elements.
    this.injectMarginCssVars(doc);

    // 5b. Extract @page rules and float:footnote rules from author CSS.
    //     @page rules → passed via styleInputs to preview() (must NOT pass full
    //     author CSS because pagedjs's @media handler would leak print rules).
    //     float:footnote rules → injected as a <style> tag so the Polisher
    //     discovers them via document.stylesheets and triggers the Footnotes
    //     handler's onDeclaration hook.
    const aimtpCss = doc.querySelector('style[data-aimtp-css]');
    const styleInputs: Record<string, string>[] = [];
    if (aimtpCss) {
      const cssText = aimtpCss.textContent || '';

      // Extract @page rules, including nested @footnote blocks
      // e.g. @page { @footnote { border-top: ... } }
      const pageRules = cssText.match(/@page\s*\{(?:[^{}]|\{[^{}]*\})*\}/g);

      // Extract float: footnote rules
      const footnoteRules = cssText.match(/[^{}]*\{[^}]*float\s*:\s*footnote[^}]*\}/g);

      // Inject float:footnote CSS into the document as a <style> tag.
      // Also merge it with @page rules into styleInputs so the Paged.js
      // Polisher processes it via polisher.add() — otherwise the Footnotes
      // handler's onDeclaration hook never sees the float:footnote declaration
      // and cannot register the selector.
      if (footnoteRules && footnoteRules.length > 0) {
        const footnoteStyle = doc.createElement('style');
        footnoteStyle.setAttribute('data-aimtp-footnote-css', '');
        footnoteStyle.textContent = footnoteRules.join('\n');
        doc.head.appendChild(footnoteStyle);
      }

      const allCssParts: string[] = [];
      if (pageRules && pageRules.length > 0) allCssParts.push(pageRules.join('\n'));
      if (footnoteRules && footnoteRules.length > 0) allCssParts.push(footnoteRules.join('\n'));
      if (allCssParts.length > 0) {
        styleInputs.push({ 'about:blank': allCssParts.join('\n') });
      }
    }

    // 6. Instantiate Previewer — Polisher.setup() reads stylesheets here.
    this.emitProgress('rendering');
    const previewer = bridge.createPreviewer();

    let currentPage = 0;
    let totalPages = 0;
    previewer.on('page', () => {
      currentPage++;
      totalPages = Math.max(totalPages, currentPage);
      this.emitProgress('page', { current: currentPage, total: totalPages });
    });

    // Move body children into a DocumentFragment so body is empty before preview.
    // pagedjs reads content.children while simultaneously modifying renderTo (body),
    // which can detach nodes and cause null.children errors.
    const fragment = doc.createDocumentFragment();
    while (doc.body.firstChild) {
      fragment.appendChild(doc.body.firstChild);
    }

    const flow = await Promise.race([
      previewer.preview(fragment as unknown as HTMLElement, styleInputs, doc.body),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Paged.js preview timed out after 30s')), PREVIEW_TIMEOUT),
      ),
    ]);

    // 5.5. Inject header/footer DOM after Paged.js preview completes
    if (this.handlerConfig?.enabled) {
      this.injectHeaderFooterDom(doc, flow.total);
    }

    // [DIAG] Check SVG element counts AFTER pagedjs
    const svgRectsAfter = doc.querySelectorAll('svg rect').length;
    const svgCirclesAfter = doc.querySelectorAll('svg circle').length;
    const svgMarkersAfter = doc.querySelectorAll('svg marker').length;
    const svgDefsAfter = doc.querySelectorAll('svg defs').length;
    const svgMarkerEndsAfter = doc.querySelectorAll('svg [marker-end]').length;
    console.log(`[DIAG] SVG AFTER pagedjs: rect=${svgRectsAfter} circle=${svgCirclesAfter} marker=${svgMarkersAfter} defs=${svgDefsAfter} marker-end=${svgMarkerEndsAfter}`);
    // Log surviving markers
    for (const m of doc.querySelectorAll('svg marker')) {
      console.log(`[DIAG] AFTER marker: id="${m.getAttribute('id')}" viewBox="${m.getAttribute('viewBox')}" children=${m.children.length}`);
    }
    // Log surviving elements with marker-end
    for (const el of doc.querySelectorAll('svg [marker-end]')) {
      console.log(`[DIAG] AFTER marker-end: tag="${el.tagName}" class="${el.getAttribute('class')}" marker-end="${el.getAttribute('marker-end')}"`);
    }
    // Check defs status
    for (const defs of doc.querySelectorAll('svg defs')) {
      console.log(`[DIAG] AFTER defs: style="${defs.getAttribute('style')}" data-undisplayed="${defs.dataset.undisplayed ?? ''}" children=${defs.children.length}`);
    }

    // [PAGEDJS_WORKAROUND] 5.7. Fix UndisplayedFilter mis-mark on elements.
    // Paged.js's UndisplayedFilter.removable() incorrectly marks elements as
    // data-undisplaced / data-undisplayed even when they are visible. It returns
    // true for ANY element with an inline style that does NOT set display: none
    // (e.g. <line style="stroke-dasharray:…; fill: none;">), AND for elements
    // without inline style that browsers consider "undisplayed" (e.g. Mermaid
    // <rect> elements that have no style attribute at all). This causes the
    // layout engine to skip them entirely → invisible content.
    // Fix: remove data-undisplaced/data-undisplayed unless the element's
    // computed display is actually none (i.e. inline style sets display: none).
    for (const attr of ['data-undisplaced', 'data-undisplayed'] as const) {
      for (const el of doc.querySelectorAll(`[${attr}]`)) {
        const styleAttr = el.getAttribute('style');
        if (!styleAttr || !/display\s*:\s*none/i.test(styleAttr)) {
          el.removeAttribute(attr);
        }
      }
    }

    // [PAGEDJS_WORKAROUND] 5.8. Restore id on SVG elements after Paged.js processing.
    // Paged.js's clone function (S) removes id attributes and stores them as data-id
    // to avoid duplicate IDs when splitting content across pages. This breaks:
    // 1) Mermaid CSS #id selectors (e.g. #mermaid-xxx .messageLine1 { stroke: #999 })
    //    used to override stroke="none" on line elements.
    // 2) SVG URL references: marker-start="url(#xxx)", fill="url(#gradient)", etc.
    //    When <marker id="xxx"> becomes <marker data-id="xxx">, the url(#xxx)
    //    reference can't resolve → direction indicators (dots/arrows) disappear.
    // SVG diagrams are atomic (break-inside:avoid), so restoring all ids within
    // each SVG is safe. For split elements, only restore on the first occurrence.
    const seenDataIds = new Set<string>();
    // Select ALL elements with data-id inside any <svg>, not just <svg> itself.
    // This covers <marker>, <linearGradient>, <clipPath>, <pattern>, etc. in <defs>.
    for (const el of doc.querySelectorAll('svg [data-id], svg[data-id]')) {
      const dataId = el.getAttribute('data-id');
      if (dataId && !seenDataIds.has(dataId)) {
        el.setAttribute('id', dataId);
        seenDataIds.add(dataId);
      }
    }

    // 6. Build LayoutDOM
    const metadata = this.extractMetadata(iframe, flow);
    const provenance = this.buildProvenance(sourceHash);

    return {
      document: doc,
      iframe,
      metadata,
      provenance,
    };
  }

  dispose(): void {
    this.disposed = true;
    this.progressCallback = null;
    this.registeredHandlerConstructors = [];
    this.handlerConfig = null;
    this.frontMatter = null;
  }

  // ─── Private Methods ───

  private injectHeaderFooterDom(doc: Document, totalPages: number): void {
    if (!this.handlerConfig || !this.frontMatter) return;
    const config = this.handlerConfig;
    const fm = this.frontMatter;

    const pages = doc.querySelectorAll('.pagedjs_page');
    pages.forEach((pageEl, pageIndex) => {
      const isCoverPage = pageIndex === 0 && pageEl.querySelector('.cover-page');

      if (isCoverPage && config.coverPageExempt) return;

      if (config.header && config.header.content !== 'none') {
        const headerText = this.resolveHeaderContent(config.header.content, config.header.customText, fm);
        if (headerText) {
          const marginSelector = `.pagedjs_margin-top-${config.header.alignment}`;
          const marginBox = pageEl.querySelector(marginSelector);
          if (marginBox) {
            const contentEl = marginBox.querySelector('.pagedjs_margin-content') || marginBox;
            contentEl.innerHTML = '';
            const headerDiv = doc.createElement('div');
            headerDiv.className = 'aimtp-page-header';
            headerDiv.textContent = headerText;
            headerDiv.style.textAlign = config.header.alignment;
            headerDiv.style.width = '100%';
            if (config.header.font) headerDiv.style.fontFamily = `"${config.header.font}"`;
            headerDiv.style.fontSize = config.header.fontSize || '0.8em';
            contentEl.appendChild(headerDiv);
            marginBox.classList.add('hasContent');
          }
        }
      }

      if (config.footer && config.footer.content !== 'none') {
        const footerText = this.resolveFooterContent(config.footer.content, config.footer.customText, pageIndex + 1, totalPages, fm);
        if (footerText) {
          const marginSelector = `.pagedjs_margin-bottom-${config.footer.alignment}`;
          const marginBox = pageEl.querySelector(marginSelector);
          if (marginBox) {
            const contentEl = marginBox.querySelector('.pagedjs_margin-content') || marginBox;
            contentEl.innerHTML = '';
            const footerDiv = doc.createElement('div');
            footerDiv.className = 'aimtp-page-footer';
            footerDiv.textContent = footerText;
            footerDiv.style.textAlign = config.footer.alignment;
            footerDiv.style.width = '100%';
            if (config.footer.font) footerDiv.style.fontFamily = `"${config.footer.font}"`;
            footerDiv.style.fontSize = config.footer.fontSize || '0.8em';
            contentEl.appendChild(footerDiv);
            marginBox.classList.add('hasContent');
          }
        }
      }
    });
  }

  private resolveHeaderContent(content: string, customText?: string, fm?: FrontMatter): string {
    switch (content) {
      case 'title': return fm?.title || '';
      case 'author': return fm?.author || '';
      case 'date': return fm?.date || '';
      case 'custom': return customText || '';
      default: return '';
    }
  }

  private resolveFooterContent(content: string, customText?: string, pageNum?: number, totalPages?: number, fm?: FrontMatter): string {
    switch (content) {
      case 'pageNumber': return pageNum ? String(pageNum) : '';
      case 'pageNumberTotal': return pageNum && totalPages ? `${pageNum} / ${totalPages}` : '';
      case 'title': return fm?.title || '';
      case 'author': return fm?.author || '';
      case 'date': return fm?.date || '';
      case 'custom': return customText || '';
      default: return '';
    }
  }

  private emitProgress(
    phase: 'fonts' | 'document' | 'injecting' | 'rendering' | 'page' | 'done',
    detail?: { current?: number; total?: number },
  ): void {
    this.progressCallback?.(phase, detail);
  }

  /**
   * Inject the pre-built pagedjs IIFE into the iframe's document.
   *
   * [PAGEDJS_WORKAROUND] Before injection, strip two problematic declarations
   * from pagedjs's base styles (the _h template literal):
   *
   * 1. @page { size: letter; margin: 0; }
   *    Would otherwise be the last @page in CSSOM cascade and override our A4 size.
   *
   * 2. :root { --pagedjs-margin-*: 1in }
   *    Would otherwise be the last :root in CSSOM cascade and override our margin values.
   */
  private injectPagedJsIife(doc: Document): void {
    const code = pagedJsIifeCode
      .replace(
        /@page\s*\{[^}]*size:\s*letter[^}]*margin:\s*0[^}]*\}/g,
        ''
      )
      // Remove individual pagedjs base :root margin declarations.
      // Other :root variables (--pagedjs-width, --pagedjs-bleed-*, etc.) must be preserved.
      .replace(/--pagedjs-margin-top:\s*1in;/g, '')
      .replace(/--pagedjs-margin-right:\s*1in;/g, '')
      .replace(/--pagedjs-margin-bottom:\s*1in;/g, '')
      .replace(/--pagedjs-margin-left:\s*1in;/g, '')
      // [PAGEDJS_WORKAROUND] Guard SVG elements in findOverflow width assignment.
      // Paged.js sets childNode.width = getComputedStyle(childNode).width on every
      // child of check.parentElement. SVG elements (rect, text, etc.) have a readonly
      // .width getter, throwing "Cannot set property width of #<SVGRectElement>".
      .replace(
        /(Array\.from\((\w+)\.parentElement\.children\)\.forEach\((\w+)=>\{)\3\.width=getComputedStyle\(\3\)\.width\}/,
        '$1if(!($3 instanceof SVGElement)){$3.width=getComputedStyle($3).width}}'
      );

    const scriptEl = doc.createElement('script');
    scriptEl.textContent = code;
    doc.head.appendChild(scriptEl);
  }

  /**
   * [PAGEDJS_WORKAROUND] Inject :root { --pagedjs-margin-* } using margin values
   * from the author's @page rule. This overrides any base :root values from
   * pagedjs (and works even after polisher.setup() inserts base styles, because
   * the IIFE strip removed the base :root --pagedjs-margin-* declarations).
   */
  private injectMarginCssVars(doc: Document): void {
    const aimtpStyle = doc.querySelector('style[data-aimtp-css]');
    if (!aimtpStyle) return;

    const cssText = aimtpStyle.textContent || '';
    const pageMatch = cssText.match(/@page\s*\{[^}]*size[^}]*\}/);
    if (!pageMatch) return;

    // Extract margin values from the @page rule (e.g. "25mm 22mm 25mm 22mm")
    const marginMatch = pageMatch[0].match(/margin:\s*([^;]+);/);
    if (!marginMatch) return;

    const parts = marginMatch[1].trim().split(/\s+/);
    let top: string, right: string, bottom: string, left: string;
    if (parts.length === 1) {
      top = right = bottom = left = parts[0];
    } else if (parts.length === 2) {
      top = bottom = parts[0];
      right = left = parts[1];
    } else if (parts.length === 3) {
      top = parts[0];
      right = left = parts[1];
      bottom = parts[2];
    } else {
      [top, right, bottom, left] = parts;
    }

    const style = doc.createElement('style');
    style.setAttribute('data-aimtp-margin-vars', '');
    style.textContent =
      `:root {\n` +
      `  --pagedjs-margin-top: ${top};\n` +
      `  --pagedjs-margin-right: ${right};\n` +
      `  --pagedjs-margin-bottom: ${bottom};\n` +
      `  --pagedjs-margin-left: ${left};\n` +
      `}`;
    doc.head.appendChild(style);
  }

  /**
   * [PAGEDJS_WORKAROUND] Protect TD/TH/LI from lastChildCheck removal.
   * Inserts a zero-width space ensuring textContent.trim() is non-empty
   * even after content extraction.
   *
   * Smart insertion for LI:
   * - If LI's first child is a block-level element (e.g. <p>), insert ZWS
   *   inside that block element to avoid the list marker occupying a
   *   separate line from the content.
   * - Otherwise (text node, inline element), insert ZWS before firstChild
   *   as before.
   * - TD/TH: always insert ZWS before firstChild (no list marker issue).
   */
  private protectStructuralElements(doc: Document): void {
    const blockTags = new Set(['P', 'DIV', 'UL', 'OL', 'PRE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'DL']);

    const cells = doc.querySelectorAll('td, th');
    for (const el of cells) {
      const zws = doc.createTextNode('\u200B');
      el.insertBefore(zws, el.firstChild);
    }

    const listItems = doc.querySelectorAll('li');
    for (const li of listItems) {
      const zws = doc.createTextNode('\u200B');
      const firstBlock = this.findFirstBlockChild(li, blockTags);
      if (firstBlock) {
        // First significant child is a block element: insert ZWS inside it
        firstBlock.insertBefore(zws, firstBlock.firstChild);
      } else {
        // No block child: insert ZWS before firstChild
        li.insertBefore(zws, li.firstChild);
      }
    }
  }

  /**
   * Find the first child of a parent that is a block-level element,
   * skipping over whitespace-only text nodes.
   * Returns null if no block-level child is found.
   */
  private findFirstBlockChild(parent: Element, blockTags: Set<string>): Element | null {
    for (const child of parent.childNodes) {
      if (child.nodeType === 3 /* Text */) {
        // Skip whitespace-only text nodes (newlines, spaces between tags)
        if ((child.textContent || '').trim() === '') continue;
        // Non-whitespace text node → not a block element
        return null;
      }
      if (child.nodeType === 1 /* Element */) {
        if (blockTags.has((child as Element).tagName)) {
          return child as Element;
        }
        // Non-block element → not a block child
        return null;
      }
    }
    return null;
  }

  /** Wait for the __pagedjs bridge global to be available in the iframe */
  private waitForPagedJsBridge(iframe: HTMLIFrameElement): Promise<PagedJsBridge> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const bridge = (iframe.contentWindow as any)?.__pagedjs;
        if (bridge && typeof bridge.createPreviewer === 'function') {
          resolve(bridge as PagedJsBridge);
          return;
        }
        if (Date.now() - start > PAGEDJS_READY_TIMEOUT) {
          reject(new Error('[PagedJsAdapter] __pagedjs bridge not available after timeout'));
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }

  private waitForFonts(doc: Document): Promise<void> {
    return new Promise((resolve) => {
      try {
        (doc as any).fonts?.ready?.then(resolve);
      } catch {
        // ignore
      }
      setTimeout(resolve, FONT_READY_TIMEOUT);
    });
  }

  private waitForDocumentReady(iframe: HTMLIFrameElement): Promise<void> {
    return new Promise((resolve) => {
      const doc = iframe.contentDocument;
      if (doc && doc.readyState === 'complete') {
        resolve();
        return;
      }
      (iframe.contentWindow as any)?.addEventListener?.(
        'load',
        () => resolve(),
        { once: true },
      );
      setTimeout(resolve, DOCUMENT_READY_TIMEOUT);
    });
  }

  private extractMetadata(iframe: HTMLIFrameElement, flow?: Flow): LayoutDOMMetadata {
    const doc = iframe.contentDocument;
    if (!doc) {
      return {
        totalPages: 0,
        pageSize: { width: 210, height: 297 },
        hasCoverPage: false,
        headerFooterMaterialized: false,
        cssArchitectureValid: false,
      };
    }

    // Use flow.total if available, otherwise count DOM nodes
    const pageNodes = doc.querySelectorAll('.pagedjs_page');
    const totalPages = flow?.total ?? pageNodes.length;

    const coverPage = doc.querySelector('.cover-page');
    const hasHeaderFooterDom =
      !!doc.querySelector('.aimtp-page-header') ||
      !!doc.querySelector('.aimtp-page-footer');
    const hasAimtpCss =
      !!doc.querySelector('style[data-aimtp-css]');

    return {
      totalPages,
      pageSize: { width: 210, height: 297 },
      hasCoverPage: !!coverPage,
      headerFooterMaterialized: hasHeaderFooterDom,
      cssArchitectureValid: hasAimtpCss,
    };
  }

  private buildProvenance(sourceHash: string): LayoutDOMProvenance {
    return {
      sourceHash,
      renderedAt: Date.now(),
      webContentsId: 0,
    };
  }
}
