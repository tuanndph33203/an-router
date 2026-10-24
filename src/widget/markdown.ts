export function parseMarkdown(
  text: string,
  reportApiUrl: string = "",
  hasReportTable: boolean = false
): string {
  if (!text) return "";

  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Strip chart-spec blocks (clean text display)
  html = html.replace(/```chart-spec\s*([\s\S]*?)```/gi, "");
  html = html.replace(/```chart-spec\s*([\s\S]*)$/gi, "");

  const blocks: string[] = [];

  // Code blocks (SQL, JSON, etc.)
  html = html.replace(/```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/gi, (_match, lang, code) => {
    const idx = blocks.length;
    const cleanLang = (lang || "code").toUpperCase();
    blocks.push(`
      <div style="background:#0f172a;color:#f8fafc;border-radius:8px;overflow:hidden;margin:8px 0;border:1px solid #334155;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 10px;background:#1e293b;font-size:10px;color:#94a3b8;font-family:monospace;font-weight:600;">
          <span>${cleanLang}</span>
        </div>
        <pre style="padding:8px 10px;overflow-x:auto;font-size:11px;font-family:monospace;margin:0;line-height:1.4;"><code>${code.trim()}</code></pre>
      </div>
    `);
    return `<!--BLOCK_${idx}-->`;
  });

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:#f1f5f9;color:#6d28d9;padding:2px 5px;border-radius:4px;font-size:11px;font-family:monospace;">$1</code>'
  );

  // Bold & Italic
  html = html.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^\*]+)\*/g, "<em>$1</em>");

  // Markdown Tables
  const tableRegex = /((?:\|[^\n]+\|\r?\n)+)/g;
  if (hasReportTable) {
    // Suppress raw markdown table if interactive report table is already shown
    html = html.replace(tableRegex, "");
  } else {
    html = html.replace(tableRegex, (tableBlock) => {
      const lines = tableBlock
        .trim()
        .split(/\r?\n/)
        .filter((l) => l.includes("|"));
      if (lines.length < 2) return tableBlock;

      let tableHtml = '<div class="omni-table-wrapper"><table class="omni-table">';
      let isHeader = true;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (/^[|\s:-]+$/.test(line)) {
          isHeader = false;
          continue;
        }
        const cells = line
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        tableHtml += "<tr>";
        for (const cell of cells) {
          if (isHeader) {
            tableHtml += `<th>${cell}</th>`;
          } else {
            tableHtml += `<td>${cell}</td>`;
          }
        }
        tableHtml += "</tr>";
      }
      tableHtml += "</table></div>";
      const idx = blocks.length;
      blocks.push(tableHtml);
      return `<!--BLOCK_${idx}-->`;
    });
  }

  // Download links or general links (Strictly sanitized against javascript: / data: XSS)
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (_match, label, url) => {
    let finalUrl = url.trim();
    if (finalUrl.startsWith("/api/ai-report/download/")) {
      finalUrl = `${reportApiUrl}${finalUrl}`;
    }

    // Protocol check: only allow http:, https:, mailto:, or relative paths
    const lower = finalUrl.toLowerCase();
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("data:") ||
      lower.startsWith("vbscript:") ||
      lower.startsWith("file:")
    ) {
      return `<span>${label}</span>`;
    }

    const safeHref = finalUrl.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const isDownload = finalUrl.endsWith(".xlsx") || finalUrl.includes("/api/ai-report/download/");
    if (isDownload) {
      return `<a class="omni-download-btn" href="${safeHref}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        ${label}
      </a>`;
    }
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color:#7c3aed;text-decoration:underline;font-weight:500;">${label}</a>`;
  });

  // Bullet lists
  html = html.replace(
    /\n\s*-\s+(.*)/g,
    '<li style="margin-left:16px;list-style-type:disc;">$1</li>'
  );
  html = html.replace(
    /\n\s*---\s*\n/g,
    '<hr style="margin:8px 0;border:0;border-top:1px solid #e2e8f0;" />'
  );

  // Line breaks to <br/>
  html = html.replace(/\n/g, "<br/>");

  // Restore preserved blocks
  blocks.forEach((b, idx) => {
    html = html.replace(`<!--BLOCK_${idx}-->`, b);
  });

  return html;
}
