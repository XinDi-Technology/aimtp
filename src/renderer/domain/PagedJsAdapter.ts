/**
 * PagedJsAdapter — Paged.js 适配层（模块化 API 模式，方案C: IIFE 注入）
 *
 * 重构说明（迭代2）：
 * - 从 polyfill 注入模式 → 模块化 API 模式（Previewer 类）
 * - 采用方案C：将 pagedjs ESM 打包为 IIFE 注入 iframe，确保 Paged.js 在正确的 window 上下文中运行
 * - 不再使用 ?raw 导入 polyfill JS 文本
 * - 不再使用轮询检测 PagedPolyfill 全局变量
 * - 使用 Previewer 类实例化和 preview() 调用
 * - 通过 Previewer 事件系统监听分页进度
 * - 页眉页脚在 preview 结束后由 injectHeaderFooterDom() 直接注入 DOM（不走 Paged.js Handler）
 */

import type { LayoutEngine } from './LayoutEngine';
import type { LayoutDOM, LayoutDOMMetadata, LayoutDOMProvenance } from './LayoutDOM';
import type { Flow } from 'pagedjs';
import type { HeaderFooterConfig, FrontMatter } from './handlers/AimtpHandler';
import pagedJsIifeCode from '../assets/vendor/pagedjs.iife.js?raw';

const FONT_READY_TIMEOUT = 5000;
const DOCUMENT_READY_TIMEOUT = 2000;
const PAGEDJS_READY_TIMEOUT = 10000;
const IMAGE_READY_TIMEOUT = 5000; // 等待图片加载的超时上限，避免个别图片卡住整个预览
/**
 * 图片块高相对「内容区高度」保留的安全余量（px）。
 *
 * Paged.js 判定 break-inside:avoid 的块「放不下」时，既不留在当前页也不进下一页，
 * 图片会整段消失。早期用 0.95 的比例折扣规避（A4/20mm 下 971px → 922px，
 * 纵向白丢 8%）。消失的诱因是「块高 + 段边距 > 页面可用高度」：
 * 整页模式下段边距已归零，这里只需覆盖亚像素取整（内容区高常是 971.34px 这类值），
 * 4px 足够安全，浪费从 8% 降到约 0.4%。
 * 不要改成 0：内容区高与 Paged.js 可用高度都带小数，零余量会重新触发图片消失。
 */
const IMAGE_FIT_SAFE_PX = 4;
/** 极端设置（超大边距/段间距）下的 max-height 下限，避免算出负值使整条声明失效 */
const MIN_IMAGE_MAX_HEIGHT_PX = 60;
/** CSS 绝对长度换算：1mm = 96/25.4 px */
const MM_TO_PX = 96 / 25.4;
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
  createPreviewer: () => PreviewerInstance;
}

export class PagedJsAdapter implements LayoutEngine {
  private disposed = false;
  private progressCallback: LayoutProgressCallback | null = null;
  private handlerConfig: HeaderFooterConfig | null = null;
  private frontMatter: FrontMatter | null = null;

  /** 设置进度回调 */
  onProgress(callback: LayoutProgressCallback): void {
    this.progressCallback = callback;
  }

  /** 配置页眉页脚（在 layout 前调用） */
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

    // 1.4. 等待所有图片加载完成后再分页，并顺手给图片补上内联样式与固有尺寸。
    // doc.write() 写入的 <img>（尤其是远程图片）在 previewer.preview() 执行时通常尚未加载，
    // 此时浏览器按 0 高度参与排版，图片会被误判为"放得下"而留在当前页；
    // 待加载完成撑开真实高度后溢出页面底部，表现为图片没有换到下一页。
    // 等待上限为 IMAGE_READY_TIMEOUT，超时后仍会继续分页，不会阻塞预览。
    // 该方法内部还会调用 applyImageSizing()，原因见其注释（避免图片跨页时被 Paged.js 丢弃）。
    await this.waitForImages(doc);

    // 1.4b. 图片段落补一条内联 break-inside（供浏览器/打印分支）。
    this.protectImageBlocks(doc);

    // 1.4c. 在「相邻的图片段落」之间插入零高度分隔块。
    // 实测：图片之间只要有文字就能正常显示，紧挨着则后续段落整段丢失。
    this.separateAdjacentImageBlocks(doc);

    // 1.4d. 分页前把超高图片压到一页内（写内联 max-height）。
    // 必须放在 waitForImages 之后：段落 margin 的实测值要在 CSS 应用后读取，
    // 且此时图片固有尺寸已知，父元素高度已按真实图片尺寸完成布局。
    this.applyImagePageFit(doc);

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

    // 2. Inject pagedjs IIFE into iframe
    this.emitProgress('injecting');
    this.injectPagedJsIife(doc);

    // 3. Wait for __pagedjs bridge to be available
    const bridge = await this.waitForPagedJsBridge(iframe);

    // 4. 注：自定义 Paged.js Handler 机制已移除（历史上从未注册过任何 Handler）。
    //    页眉页脚由 injectHeaderFooterDom() 在 preview 结束后直接注入 DOM 实现。

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
      // [PAGEDJS_WORKAROUND] Guard replaced elements in findOverflow width assignment.
      // Paged.js sets childNode.width = getComputedStyle(childNode).width on every
      // child of check.parentElement. Two problems:
      // 1) SVG elements (rect, text, etc.) have a readonly .width getter, throwing
      //    "Cannot set property width of #<SVGRectElement>".
      // 2) IMG/CANVAS/VIDEO/AUDIO/IFRAME/EMBED/OBJECT have an unsigned-long width IDL
      //    attribute: assigning a CSS px string ("612px") converts via ToNumber → NaN
      //    → 0, and a detached node yields "" → 0 as well. The width attribute gets
      //    clobbered to 0 → the image renders as a 0-width box and disappears
      //    (observed as 63917.60001_014.png width="0" height="383").
      // Replaced elements must keep their intrinsic sizing: applyImageSizing() writes
      // width/height attributes pre-pagination and preview.css max-width/max-height
      // rescale them correctly in the new page context.
      .replace(
        /(Array\.from\((\w+)\.parentElement\.children\)\.forEach\((\w+)=>\{)\3\.width=getComputedStyle\(\3\)\.width\}/,
        '$1if(!($3 instanceof SVGElement)&&!/^(img|canvas|video|audio|iframe|embed|object|picture)$/i.test($3.tagName)){$3.width=getComputedStyle($3).width}}'
      )
      // [PAGEDJS_WORKAROUND] 1.7. Replaced elements (IMG/SVG/VIDEO/CANVAS etc.) can
      // never become the overflow start. startOfNewOverflow descends into childless
      // leaves, but only HTMLBRElement picks up its own rect there (layout.js
      // L993-999), so an <img> keeps intrinsicBottom/Right = 0 → the L1011
      // "not overflowing" check is always true → the walk skips past the img.
      // A break-inside:avoid image paragraph is therefore never moved to the next
      // page as a whole: it stays stranded on the current page (clipped), the next
      // page misses it, and the page wrapper div is left with residual
      // data-split-to="undefined" / data-overflow-tagged="true" attributes.
      // Let intrinsic-sized replaced elements pick up their own rect like <br>,
      // so overflow detection and the avoid-break-inside relocation work.
      .replace(
        /else (\w+) instanceof HTMLBRElement&&\((\w+)=(\w+)\.right,(\w+)=(\w+)\.bottom\)/,
        'else ($1 instanceof HTMLBRElement||/^(img|picture|video|audio|canvas|iframe|embed|object|svg)$/i.test($1.tagName))&&($2=$3.right,$4=$3.bottom)'
      )
      // [PAGEDJS_WORKAROUND] 1.8. indexOfTextNode (via createOverflow) unconditionally
      // reads previousSibling.dataset.ref, assuming an element sibling. When pagedjs
      // splits a text node at the overflow boundary (long CJK paragraphs break
      // mid-text), previousSibling is another TEXT node — .dataset is undefined →
      // "Cannot read properties of undefined (reading 'ref')". Route non-element
      // siblings to the letters-counting path (correct for split nodes: it locates
      // the original full text node in source and computes the split offset).
      .replace(
        /if\((\w+)\.previousSibling\)\{let (\w+)=(\w+)\.querySelector\(`\[data-ref='\$\{\1\.previousSibling\.dataset\.ref\}'\]`\)/,
        (_m, node: string, refVar: string, parentVar: string) =>
          `if(${node}.previousSibling&&${node}.previousSibling.nodeType===1){let ${refVar}=${parentVar}.querySelector(\`[data-ref='\${${node}.previousSibling.dataset.ref}']\`)`
      )
      // [PAGEDJS_WORKAROUND] 1.9. Neutralize checkUnderflowAfterResize().
      //
      // addResizeObserver() registers a ResizeObserver that calls
      // checkUnderflowAfterResize() whenever the page wrapper SHRINKS — which is
      // exactly what happens when images/fonts finish loading late, or the preview
      // area is resized. Its body calls findEndToken(), which throws
      // "Cannot read properties of undefined (reading 'nextSibling')" (TODO S6).
      //
      // The throw escapes from inside the ResizeObserver callback, i.e. in the
      // middle of the pagination run, and aborts it: everything after the first
      // page is silently missing. Observed symptom: consecutive images render only
      // the first one, and swapping in identical small images changes nothing —
      // because the failure is the aborted layout, not image sizing or breaking.
      //
      // Safe to remove: dist registers an EMPTY underflow callback upstream —
      // `n.onUnderflow(e=>{})` — so the endToken computed here is discarded anyway.
      // A no-op is therefore behaviour-equivalent to upstream pagedjs.
      .replace(
        /checkUnderflowAfterResize\((\w+)\)\{[^{}]*findEndToken[^{}]*\}/,
        'checkUnderflowAfterResize($1){}'
      );

    // [PAGEDJS_WORKAROUND] 1.8 sanity check: a miss means the pagedjs dist output
    // changed shape (e.g. future upstream release) and the crash guard was NOT
    // applied — behavior stays as-is (no new harm), but the crash would return.
    if (!code.includes('.previousSibling.nodeType===1')) {
      console.warn(
        '[PAGEDJS_WORKAROUND 1.8] indexOfTextNode guard 未命中，pagedjs dist 输出可能已变化',
      );
    }

    // [PAGEDJS_WORKAROUND] 1.9 sanity check: after a successful patch the only
    // caller of findEndToken(this.wrapper) is gone. Its return value was fed to an
    // empty callback, so a no-op changes nothing except removing the crash.
    if (code.includes('findEndToken(this.wrapper')) {
      console.warn(
        '[PAGEDJS_WORKAROUND 1.9] checkUnderflowAfterResize 补丁未命中，pagedjs dist 输出可能已变化',
      );
    }

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
    const margins = this.parsePageMargins(doc);
    if (!margins) return;
    const { top, right, bottom, left } = margins;

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
   * 从 author CSS 的 @page 规则解析四边 margin，原样返回带单位的字符串（如 "20mm"）。
   * 供 injectMarginCssVars() 注入 CSS 变量、以及 applyImagePageFit() 计算内容区高度复用。
   */
  private parsePageMargins(
    doc: Document,
  ): { top: string; right: string; bottom: string; left: string } | null {
    const aimtpStyle = doc.querySelector('style[data-aimtp-css]');
    if (!aimtpStyle) return null;

    const cssText = aimtpStyle.textContent || '';
    const pageMatch = cssText.match(/@page\s*\{[^}]*size[^}]*\}/);
    if (!pageMatch) return null;

    // Extract margin values from the @page rule (e.g. "25mm 22mm 25mm 22mm")
    const marginMatch = pageMatch[0].match(/margin:\s*([^;]+);/);
    if (!marginMatch) return null;

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

    return { top, right, bottom, left };
  }

  /**
   * 给「只含一张图片的块」补一条内联 break-inside: avoid。
   *
   * 注意：这里**不要**设置 data-original-break-inside="avoid"（v0.2.25 设置过，已移除）。
   * Paged.js 判断元素不可拆分读的是该属性而非 CSS：dist 中 avoidBreakInside() 只读取
   * dataset.originalBreakInside，全库没有写入它的代码；而样式表里含 break-inside 的规则
   * 会被 rulesToDisable(['breakInside', ...]) 主动禁用。
   *
   * 手动写上该属性后实测：单张图片正常，但**连续**多个图片段落中后续的块会整段丢失
   * （高度安全、加载正常的前提下仍然如此），即 Paged.js 对连续 avoid 块的搬移有问题。
   * 去掉该属性后，图片换页交给 Paged.js 对替换元素的原生处理 —— 补丁 1.7b 已让
   * img/picture/video 等元素成为溢出起点，整块换页由它负责。
   *
   * 这里只保留内联 CSS：不影响 Paged.js 的 JS 分页，仅供浏览器/打印分支使用
   * （样式表里的同类规则会被 Paged.js 禁用，内联样式不受影响）。
   */
  private protectImageBlocks(doc: Document): void {
    for (const img of doc.querySelectorAll('img')) {
      const parent = img.parentElement;
      if (!parent) continue;

      // 只处理「图片是该块唯一元素子节点」的标准形态（Markdown 图片渲染为 <p><img></p>）。
      // 不限 tagName，直接写在 <div> 里的图片同样能受益。
      if (parent.children.length !== 1 || parent.firstElementChild !== img) continue;

      parent.style.setProperty('break-inside', 'avoid');
    }
  }

  /**
   * 在「相邻的图片段落」之间插入一个零高度分隔块。
   *
   * 实测现象：图片段落之间只要有其它内容（哪怕一行文字），后续图片都能正常显示；
   * 一旦两个图片段落紧挨着（Markdown 里连续写 ![](a) ![](b)），后面的段落就会
   * 整段丢失——当前页没有、下一页也没有。高度已压到安全区、图片也已确认加载成功，
   * 仍然复现，说明 Paged.js 处理「连续相邻的原子块」时存在缺陷。
   *
   * 既然有内容间隔就能正常，就人为补上这个间隔：插入一个零高度、不占版面的块。
   * - 零高度 + line-height:0 + overflow:hidden → 视觉上不引入任何空白行
   * - 内部放一个零宽空格，避免被 Paged.js 的 lastChildCheck 当作空元素删掉
   *   （trim() 不会移除 U+200B，因此 textContent 非空）
   * - 只在「前后都是纯图片段落」时插入，正文之间的图片不受影响
   */
  private separateAdjacentImageBlocks(doc: Document): void {
    const isImageBlock = (el: Element | null): boolean =>
      !!el && el.children.length === 1 && el.firstElementChild?.tagName === 'IMG';

    // 先收集再插入：插入会改变 DOM 结构，边遍历边改容易漏
    const imageBlocks: Element[] = [];
    for (const img of doc.querySelectorAll('img')) {
      const parent = img.parentElement;
      if (!parent) continue;
      if (parent.children.length !== 1 || parent.firstElementChild !== img) continue;
      imageBlocks.push(parent);
    }

    for (const block of imageBlocks) {
      const prev = block.previousElementSibling;
      if (!isImageBlock(prev)) continue;

      const gap = doc.createElement('div');
      gap.setAttribute('data-aimtp-image-gap', '');
      gap.style.cssText =
        'height:0;margin:0;padding:0;border:0;line-height:0;overflow:hidden';
      // 零宽空格：textContent 非空，防止 lastChildCheck 把空元素删掉
      gap.appendChild(doc.createTextNode('\u200B'));
      prev.after(gap);
    }
  }

  /**
   * [PAGEDJS_WORKAROUND] 分页前给每张 <img> 写入内联 max-height（px），
   * 保证「图片高 + 所在块的外边距」不会超过一页内容区。
   *
   * 为什么必须走内联样式：preview.css 里的 img { max-height: calc(...) }
   * 要经 Paged.js 的 Polisher 读取并重写 author CSS，实测该声明会丢失
   * （嵌套 max()/calc() 尤其明显），图片于是仍按固有高度参与排版；
   * 一旦块高超过内容区，break-inside:avoid 的段落在任何一页都放不下，
   * Paged.js 既不留在当前页也不进下一页 —— 图片彻底消失。
   * 实测病例：A4 竖版 + 上下边距 20mm（内容区约 971px）下的 450x1070 与 450x986，
   * 而同文档中 450x644 的图不受影响（本就放得下）。
   *
   * 内联样式优先级最高且不经过 Polisher 重写；段落 margin 用 getComputedStyle
   * 实测，段间距 / 字号 / 容器差异全部自动适配，比模板变量更准。
   * 解析不到页面尺寸或 margin 时直接跳过，回退到 CSS 规则，不会让预览失败。
   *
   * 目标：让图片在「内容区」（纸张 − 设置的页边距）内达到理论最大尺寸，
   * 不裁切、不变形、不出血、不把一张图拆成多张。分两种处理：
   *
   * 1) 整页模式 —— 放不进内容区、且高度是约束侧的高图（绝大多数长图属于此类）：
   *    把「只含一张图片的块」改成精确的整页容器（height = 内容区高 − IMAGE_FIT_SAFE_PX、
   *    margin 归零、flex 居中），图片 max-width/max-height:100% 在容器内等比最大化。
   *    本来就放得下的小图不整页化，继续与正文同页排版。
   *    相比过去「给 <img> 写 max-height = 内容区高 × 0.95 − 段边距」：
   *      - 0.95 的比例折扣让纵向白丢 8%（971px → 922px），现在只留 4px 安全余量；
   *      - 段边距在图片独占一页时没有排版意义，过去却同样被扣掉，现在归零；
   *      - 块高仍 ≤ 页面可用高度，不会触发上面的「放不下 → 拆分 → 图片消失」。
   *    宽度方向的留白由图片自身宽高比决定，等比前提下无法再压缩。
   * 2) 其余图片（宽度受限的图、与正文混排的图、作者显式设定尺寸的图）保持原策略：
   *    写内联 max-height，但同样改用精确内容区高减去安全余量与实测段落 margin。
   */
  private applyImagePageFit(doc: Document): void {
    const images = Array.from(doc.querySelectorAll('img'));
    if (images.length === 0) return;

    const win = doc.defaultView;
    if (!win) return;

    // --paper-height-mm / --paper-width-mm 由 htmlGenerator 写入 :root
    //（@page 的 size 只有 A4/A3 纸张名，不含毫米数）
    const rootStyle = win.getComputedStyle(doc.documentElement);
    const pageHeightMm = parseFloat(rootStyle.getPropertyValue('--paper-height-mm'));
    const pageWidthMm = parseFloat(rootStyle.getPropertyValue('--paper-width-mm'));
    const margins = this.parsePageMargins(doc);
    const marginTopMm = margins ? parseFloat(margins.top) : NaN;
    const marginBottomMm = margins ? parseFloat(margins.bottom) : NaN;
    const marginLeftMm = margins ? parseFloat(margins.left) : NaN;
    const marginRightMm = margins ? parseFloat(margins.right) : NaN;

    if (
      !Number.isFinite(pageHeightMm) ||
      !Number.isFinite(marginTopMm) ||
      !Number.isFinite(marginBottomMm)
    ) {
      console.warn(
        '[PagedJsAdapter] 无法解析页面尺寸或页边距，跳过图片高度适配（回退到 preview.css 的 max-height）',
      );
      return;
    }

    const contentHeightPx = (pageHeightMm - marginTopMm - marginBottomMm) * MM_TO_PX;
    // 内容区宽度只用于判定「高度是否成为约束的一侧」；解析不到时退化为只用高度判定
    const hasWidthMm =
      Number.isFinite(pageWidthMm) &&
      Number.isFinite(marginLeftMm) &&
      Number.isFinite(marginRightMm);
    const contentWidthPx = hasWidthMm
      ? (pageWidthMm - marginLeftMm - marginRightMm) * MM_TO_PX
      : NaN;

    if (!(contentHeightPx > MIN_IMAGE_MAX_HEIGHT_PX)) return;

    for (const img of images) {
      const parent = img.parentElement;
      if (!parent) continue;

      if (this.tryFitImageBlockToPage(img, parent, contentHeightPx, contentWidthPx)) {
        continue;
      }

      const parentStyle = win.getComputedStyle(parent);
      const blockMarginPx =
        (parseFloat(parentStyle.marginTop) || 0) + (parseFloat(parentStyle.marginBottom) || 0);

      const maxHeightPx = Math.max(
        MIN_IMAGE_MAX_HEIGHT_PX,
        contentHeightPx - IMAGE_FIT_SAFE_PX - blockMarginPx,
      );

      // 作者/模板已显式设置更小的 max-height 时取较小值，避免覆盖其意图
      const declaredPx = parseFloat(img.style.maxHeight);
      img.style.maxHeight =
        Number.isFinite(declaredPx) && declaredPx > 0
          ? `${Math.round(Math.min(declaredPx, maxHeightPx))}px`
          : `${Math.round(maxHeightPx)}px`;
    }
  }

  /**
   * 把「只含一张图片、确实需要缩小、且高度是约束侧」的块改造成精确的整页容器，
   * 让图片在内容区内等比缩放到理论最大（不裁切、不变形、不出血）。
   *
   * 返回 false 表示不适用（宽度受限的图、本来就放得下的小图、非纯图片块、
   * 作者显式设定尺寸、固有尺寸未知等），调用方回退到写内联 max-height 的旧路径。
   *
   * 只在 P/DIV 上生效：TD/TH/LI 等容器被强行指定高度会破坏表格与列表结构。
   */
  private tryFitImageBlockToPage(
    img: HTMLImageElement,
    parent: HTMLElement,
    contentHeightPx: number,
    contentWidthPx: number,
  ): boolean {
    if (parent.tagName !== 'P' && parent.tagName !== 'DIV') return false;
    // 只处理「图片是该块唯一元素子节点」的标准形态（Markdown 图片渲染为 <p><img></p>）
    if (parent.children.length !== 1 || parent.firstElementChild !== img) return false;
    // 作者/模板已显式指定尺寸时尊重其意图，不改写容器
    if (/\b(width|height)\s*:/i.test(img.getAttribute('style') ?? '')) return false;
    // 固有尺寸未知（未加载完成或加载失败）时无法判定哪一侧是约束，交给旧路径
    if (!(img.naturalWidth > 0) || !(img.naturalHeight > 0)) return false;

    // 等比放入内容区的缩放比：取宽、高两侧约束的较小者
    const scaleByWidth = Number.isFinite(contentWidthPx)
      ? contentWidthPx / img.naturalWidth
      : Number.POSITIVE_INFINITY;
    const scale = Math.min(scaleByWidth, contentHeightPx / img.naturalHeight);
    const fittedHeightPx = img.naturalHeight * scale;

    // 只有「放不进内容区、必须缩小」的图才整页化。小图（scale ≥ 1）本来就能与正文同页，
    // 整页化只会白占一页，且 max-width/max-height 不会把图放大，结果是大页里居中一张小图。
    if (!(scale < 1)) return false;

    // 高度不是约束侧（宽度受限）时图片放不满一页，剩余空间留给后续正文，不整页化
    if (!(fittedHeightPx >= contentHeightPx - IMAGE_FIT_SAFE_PX)) return false;

    const blockHeightPx = Math.max(
      MIN_IMAGE_MAX_HEIGHT_PX,
      contentHeightPx - IMAGE_FIT_SAFE_PX,
    );

    parent.style.setProperty('height', `${blockHeightPx.toFixed(2)}px`);
    // border-box：主题若给段落加了 padding，高度也要把它算进去，避免块实际占位超出一页
    parent.style.setProperty('box-sizing', 'border-box');
    // 独占一页时上下外边距没有排版意义，却会挤占可用高度导致 Paged.js 判定放不下
    parent.style.setProperty('margin', '0');
    parent.style.setProperty('display', 'flex');
    parent.style.setProperty('align-items', 'center');
    parent.style.setProperty('justify-content', 'center');
    parent.style.setProperty('break-inside', 'avoid');
    parent.setAttribute('data-aimtp-page-image', '');

    // 图片在整页容器内等比最大化：两个方向都只受容器约束，比例由浏览器保持不变
    img.style.setProperty('display', 'block');
    img.style.setProperty('margin', '0 auto');
    img.style.setProperty('width', 'auto');
    img.style.setProperty('height', 'auto');
    img.style.setProperty('max-width', '100%');
    img.style.setProperty('max-height', '100%');
    img.style.setProperty('object-fit', 'contain');

    this.appendTailSentinel(parent);

    return true;
  }

  /**
   * [PAGEDJS_WORKAROUND] 给「末位整页图片块」补一个零高度后继哨兵。
   *
   * Paged.js 的 tagAndCreateOverflowRange() 收尾有一段向上标记溢出的循环：
   *   for (; !v.nextElementSibling && v !== i; ) v = v.parentElement, v.dataset.overflowTagged = !0;
   * 拆分溢出时 v 从图片块出发，只要它没有后继兄弟节点，就会一路把
   * data-overflow-tagged 打到「页内容容器」上；被打标记的容器与其克隆体随后被当作
   * "已被 range 抽空的溢出残留"清理掉，表现为图片在当前页和下一页都不显示。
   * 实测：三张连续图片（正常图 → 超长图 → 450x986），末位那张丢失；把顺序调成
   * 让该图不在末位则三张都正常 —— 触发条件是「末位 + 满页块」，与高度比例无关
   * （这也是 v0.2.36~v0.2.38 反复调整适配比例都无效的原因）。
   *
   * 补上哨兵后，上面的循环在图片块这一级就停下，页内容容器不会被污染。
   * 哨兵写法沿用 separateAdjacentImageBlocks() 已验证的形态：零高度不占版面、
   * 不会多排一页（Paged.js 的 firstOverflowingChild() 会跳过 0 高度元素），
   * 内部放 U+200B 使其 textContent 非空，避免被 lastChildCheck() 当空元素删除。
   */
  private appendTailSentinel(block: HTMLElement): void {
    // 已有后继兄弟时循环本就不会向上走，不必插入
    if (block.nextElementSibling) return;

    const doc = block.ownerDocument;
    const sentinel = doc.createElement('div');
    sentinel.setAttribute('data-aimtp-image-tail', '');
    sentinel.style.cssText =
      'height:0;margin:0;padding:0;border:0;line-height:0;overflow:hidden';
    sentinel.appendChild(doc.createTextNode('\u200B'));
    block.after(sentinel);
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
   *
   * Image-only paragraphs are deliberately left untouched:
   * - <img> is display:block, so ANY text node inside the <p> (ZWS included)
   *   forms a line box sized by the block strut, i.e. a visible blank line
   *   above the image. No inline wrapper avoids it; only a nested block with
   *   line-height:0 would, which would break the `> img:only-child` selector.
   * - lastChildCheck() only drops such a <p> when it is overflow-tagged AND
   *   has already been emptied by range extraction, where dropping it is the
   *   correct behaviour (its content lives on the next page).
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
        const bridge = iframe.contentWindow?.__pagedjs;
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

  /**
   * 等待 iframe 内所有 <img> 加载完成（或失败），使 Paged.js 分页时能拿到图片真实固有尺寸。
   *
   * 已加载完成（含加载失败）的图片直接跳过；未完成的等待 load / error 事件。
   * 单张图片不会阻塞整体流程：用 allSettled 收集结果，并叠加 IMAGE_READY_TIMEOUT 超时兜底，
   * 避免个别慢速或损坏的远程图片把预览卡死。
   */
  private waitForImages(doc: Document): Promise<void> {
    const images = Array.from(doc.querySelectorAll('img'));
    // 没有图片时直接返回，避免无谓地创建定时器
    if (images.length === 0) return Promise.resolve();

    // 单个图片的等待：无论成功加载还是加载失败都 resolve，绝不让调用方 reject
    const waitOne = (img: HTMLImageElement): Promise<void> => {
      // img.complete 为 true 表示已加载完成或已失败（如地址无效），两种情况都无需再等
      if (img.complete) return Promise.resolve();

      return new Promise<void>((resolve) => {
        // load / error 共用一个回调：先解绑两个监听防止重复触发，再放行
        const onSettled = () => {
          img.removeEventListener('load', onSettled);
          img.removeEventListener('error', onSettled);
          resolve();
        };
        img.addEventListener('load', onSettled);
        img.addEventListener('error', onSettled);
      });
    };

    // allSettled：等所有图片有结果（不因个别失败而中断）；
    // race + 定时器：整体等待不超过 IMAGE_READY_TIMEOUT，超时后照常进入分页
    return Promise.race([
      Promise.allSettled(images.map(waitOne)).then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, IMAGE_READY_TIMEOUT)),
    ]).then(() => {
      // 图片已就绪（或等待超时）后统一补写内联尺寸。
      // 必须放在"等图片"之后：天然宽高要等解码完成才拿得到；
      // 统一在这里遍历，是为了让成功、失败、超时三条路径的收尾逻辑保持一致。
      for (const img of images) {
        this.applyImageSizing(img);
      }
    });
  }

  /**
   * [PAGEDJS_WORKAROUND] 给 <img> 补上内联样式与确定尺寸，避免跨页时被 Paged.js 丢弃。
   *
   * 背景：Paged.js 的 UndisplayedFilter.removable() 会依据元素自身的 style.display 判断
   * 是否"不可见"，没有 style 属性的元素容易被误判并打上 data-undisplayed，
   * 克隆页面时被跳过，最终表现为"图片代码在 DOM 里、但两页都不显示"。
   * 上面 1.6 的补丁只给 SVG 子元素补了 display:inline，漏掉了 <img>：
   * Markdown 渲染出的图片是裸的 <img src="…" alt="">，不带 style 属性。
   *
   * 因此这里在分页前：
   *   1) 写入内联 display:block（已有 display 声明则不覆盖）；
   *   2) 把图片固有宽高回填为 width/height 属性，让 Paged.js 测量时有确定尺寸。
   * 注意：属性尺寸只提供固有宽高，实际显示仍受 preview.css 的 max-width:100% / max-height
   * 约束按比例缩放，不会放大图片；加载失败（naturalWidth 为 0）时不写尺寸，避免生成 0×0。
   */
  private applyImageSizing(img: HTMLImageElement): void {
    // 读取现有 style 属性；没有则用空串占位，便于下面统一拼装
    const styleAttr = img.getAttribute('style') ?? '';
    // 仅在作者未声明 display 时补写，避免覆盖模板或 Markdown 里已有的显示方式
    if (!/\bdisplay\s*:/i.test(styleAttr)) {
      // 已有其它内联样式时追加在末尾（分号分隔），保持原有声明不丢失
      img.setAttribute('style', styleAttr ? `${styleAttr}; display:block` : 'display:block');
    }

    // naturalWidth/naturalHeight 为 0 表示图片尚未解码成功（加载中或加载失败），
    // 此时写尺寸属性只会得到 0×0，反而让图片彻底不可见，因此直接跳过
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      // 尊重 Markdown/HTML 中显式写出的尺寸，只用固有尺寸填补缺失的一侧；
      // 同时提供 width 与 height 可让浏览器得到宽高比，配合 CSS 约束等比缩放
      if (!img.hasAttribute('width')) {
        img.setAttribute('width', String(img.naturalWidth));
      }
      if (!img.hasAttribute('height')) {
        img.setAttribute('height', String(img.naturalHeight));
      }
    }
  }

  private waitForFonts(doc: Document): Promise<void> {
    return new Promise((resolve) => {
      try {
        doc.fonts?.ready.then(resolve);
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
      iframe.contentWindow?.addEventListener(
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
