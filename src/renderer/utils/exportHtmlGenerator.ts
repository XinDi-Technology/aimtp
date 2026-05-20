export function prepareExportHtml(renderedHtml: string, totalPages: number): string {
  let css = renderedHtml;

  css = css.replace(
    /@(top|bottom)-(left|center|right)\s*\{[^}]*\}/g,
    ''
  );

  css = css.replace(
    /(\.pagedjs_page\s*\{[^}]*?)max-height\s*:\s*[^;!]+!?\s*;?/g,
    '$1'
  );

  css = css.replace(
    /counter\s*\(\s*pages\s*\)/g,
    String(totalPages)
  );

  css = css.replace(
    /@page\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g,
    (_match, content) => {
      const cleaned = content.replace(/margin\s*:\s*[^;]+;?\s*/g, '');
      return `@page { ${cleaned} margin: 0; }`;
    }
  );

  css = css.replace(
    /<\/head>/,
    `<style>
.pagedjs_sheet{position:static!important;float:none!important}.pagedjs_pages,.pagedjs_page{position:static!important;display:block!important;float:none!important}
.pagedjs_pages{padding:0!important;margin:0!important;gap:0!important}
.pagedjs_page{break-after:page!important;page-break-after:always!important;margin:0!important;max-height:none!important;overflow:visible!important}
.pagedjs_page:last-child{break-after:auto!important;page-break-after:auto!important}
</style></head>`
  );

  return css;
}
