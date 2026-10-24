import { OmniChatConfig, ChatMessage } from "./types";
import { WIDGET_STYLES } from "./styles";
import { parseMarkdown } from "./markdown";
import { ChatCore } from "./chat-core";
import { DEFAULT_AN_LOGO } from "./logo-base64";

export class OmniChatElement extends HTMLElement {
  private config!: OmniChatConfig;
  private shadow: ShadowRoot;
  private chatCore!: ChatCore;
  private isOpen: boolean = false;
  private isExpanded: boolean = false;

  private static chartJsPromise: Promise<any> | null = null;
  private chartInstances = new Map<string, any>();

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
  }

  init(config: OmniChatConfig) {
    this.config = {
      appTitle: "AI Assistant",
      appSubtitle: "Hỗ trợ nghiệp vụ & Báo cáo dữ liệu",
      themeColor: "#7c3aed",
      position: "bottom-right",
      ...config,
    };
    this.chatCore = new ChatCore(
      this.config,
      () => this.render(),
      (msg) => this.updateTimerUI(msg)
    );
    this.render();

    // Tự động đồng bộ thông tin tên ứng dụng, lời chào và gợi ý từ OmniRoute Hub theo microsoftClientKey
    const clientKey = config.microsoftClientKey || config.appId;
    if (clientKey) {
      const hubUrl = (
        config.orchestratorUrl ||
        (typeof window !== "undefined" && (window as any).__OMNI_ORCHESTRATOR_URL__) ||
        "http://localhost:20128"
      ).replace(/\/$/, "");

      fetch(`${hubUrl}/api/orchestrator/apps?microsoftClientKey=${encodeURIComponent(clientKey)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.Data) {
            const data = json.Data;
            if (data.name) this.config.appTitle = data.name;
            if (data.welcomeMessage && this.chatCore) {
              const msgs = this.chatCore.getMessages();
              if (msgs.length === 1 && msgs[0].id === "welcome") {
                msgs[0].text = data.welcomeMessage;
              }
            }
            if (Array.isArray(data.quickSuggestions) && data.quickSuggestions.length > 0) {
              this.config.quickSuggestions = data.quickSuggestions;
            }
            this.render();
          }
        })
        .catch(() => {});
    }
  }

  toggleOpen() {
    this.isOpen = !this.isOpen;
    this.render();
    if (this.isOpen) {
      setTimeout(() => {
        const textarea = this.shadow.querySelector<HTMLTextAreaElement>(".omni-textarea");
        textarea?.focus();
        this.scrollToBottom();
      }, 100);
    }
  }

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
    this.render();
  }

  scrollToBottom() {
    const el = this.shadow.querySelector(".omni-messages");
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  private getResolvedLogo(): string | null {
    const raw = this.config?.logoUrl;
    if (raw) {
      if (raw === "logo_an.png" || raw === "/logo_an.png" || raw.includes("logo_an")) {
        return DEFAULT_AN_LOGO;
      }
      if (
        raw.startsWith("http://") ||
        raw.startsWith("https://") ||
        raw.startsWith("data:") ||
        raw.startsWith("/")
      ) {
        return raw;
      }
      return `/${raw}`;
    }
    const title = (this.config?.appTitle || "").toLowerCase();
    const sub = (this.config?.appSubtitle || "").toLowerCase();
    if (
      title.includes("anpos") ||
      sub.includes("anpos") ||
      title.includes("an") ||
      sub.includes("an")
    ) {
      return DEFAULT_AN_LOGO;
    }
    return null;
  }

  private render() {
    const messages = this.chatCore ? this.chatCore.getMessages() : [];
    const attachments = this.chatCore ? this.chatCore.getAttachments() : [];
    const reportApiUrl = this.config?.reportApiUrl || "";
    const resolvedLogo = this.getResolvedLogo();

    this.shadow.innerHTML = `
      <style>${WIDGET_STYLES}</style>
      <div class="omni-widget ${this.config?.position || "bottom-right"}">
        <!-- Floating Launcher Button -->
        <button class="omni-launcher ${this.isOpen ? "open" : ""}" title="Mở trợ lý AI">
          ${
            this.isOpen
              ? `
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          `
              : `
            <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 3.58-9 8 0 1.68.59 3.24 1.63 4.54L3 21l5.72-1.56C9.9 19.78 10.92 20 12 20c4.97 0 9-3.58 9-8s-4.03-8-9-8zm-4 9.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
          `
          }
        </button>

        <!-- Hidden File Input -->
        <input type="file" class="omni-file-input" style="display:none;" multiple />

        <!-- Chat Window -->
        <div class="omni-window ${this.isOpen ? "open" : ""} ${this.isExpanded ? "expanded" : "compact"}">
          <!-- Header -->
          <div class="omni-header">
            <div class="omni-header-info">
              <div class="omni-avatar">
                ${
                  resolvedLogo
                    ? `
                  <img src="${resolvedLogo}" class="omni-avatar-img" alt="Logo" />
                `
                    : `
                  <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.72V7h2a7 7 0 0 1 7 7v1a2 2 0 0 1-2 2h-1v1a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-1H5a2 2 0 0 1-2-2v-1a7 7 0 0 1 7-7h2V5.72c-.6-.34-1-.98-1-1.72a2 2 0 0 1 2-2z"/></svg>
                `
                }
                <span class="omni-status-dot"></span>
              </div>
              <div class="omni-title-group">
                <div class="omni-title">${this.config?.appTitle || "AI Assistant"}</div>
                <div class="omni-subtitle">${this.config?.appSubtitle || "Hỗ trợ nghiệp vụ & Báo cáo"}</div>
              </div>
            </div>
            <div class="omni-header-actions">
              <button class="omni-icon-btn btn-expand" title="${this.isExpanded ? "Thu nhỏ" : "Mở rộng"}">
                <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              </button>
              <button class="omni-icon-btn btn-clear" title="Làm mới cuộc trò chuyện">
                <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
              <button class="omni-icon-btn btn-close" title="Đóng">
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          </div>

          <!-- Messages Area -->
          <div class="omni-messages">
            ${messages.map((msg) => this.renderMessage(msg, reportApiUrl, resolvedLogo)).join("")}
          </div>

          <!-- Input Area -->
          <div class="omni-input-container">
            ${
              this.config?.quickSuggestions && this.config.quickSuggestions.length > 0
                ? `
              <div class="omni-suggestions">
                ${this.config.quickSuggestions.map((s) => `<button class="omni-suggestion-chip" data-suggestion="${this.escapeHtml(s)}">${this.escapeHtml(s)}</button>`).join("")}
              </div>
            `
                : ""
            }

            ${
              attachments.length > 0
                ? `
              <div class="omni-attachments-preview">
                ${attachments
                  .map(
                    (att, i) => `
                  <div class="omni-attachment-chip">
                    <span>📎 ${this.escapeHtml(att.name)}</span>
                    <button data-remove-att="${i}">✕</button>
                  </div>
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }

            <div class="omni-input-row">
              <button class="omni-attach-btn" title="Đính kèm tệp">
                <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6H9v9.5a3 3 0 0 0 6 0V5a4 4 0 0 0-8 0v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
              </button>
              <textarea class="omni-textarea" placeholder="Hỏi AI về doanh thu, hóa đơn hoặc yêu cầu báo cáo..." rows="1"></textarea>
              <button class="omni-send-btn" title="Gửi câu hỏi">
                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.scrollToBottom();
    this.initActiveCharts();
  }

  private ensureChartJsLoaded(): Promise<any> {
    if ((window as any).Chart) {
      return Promise.resolve((window as any).Chart);
    }
    if (OmniChatElement.chartJsPromise) {
      return OmniChatElement.chartJsPromise;
    }
    OmniChatElement.chartJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
      script.async = true;
      script.onload = () => resolve((window as any).Chart);
      script.onerror = () => {
        const fallback = document.createElement("script");
        const orchestratorUrl = this.config.orchestratorUrl || "http://localhost:20128";
        fallback.src = `${orchestratorUrl.replace(/\/$/, "")}/chart.umd.min.js`;
        fallback.onload = () => resolve((window as any).Chart);
        fallback.onerror = (e) => {
          OmniChatElement.chartJsPromise = null;
          reject(e);
        };
        document.head.appendChild(fallback);
      };
      document.head.appendChild(script);
    });
    return OmniChatElement.chartJsPromise;
  }

  private initActiveCharts() {
    const messages = this.chatCore ? this.chatCore.getMessages() : [];
    for (const msg of messages) {
      const hasChart = !!(
        msg.reportTable?.chartSpec &&
        msg.reportTable.chartSpec.chartType &&
        msg.reportTable.chartSpec.chartType !== "none"
      );
      if (hasChart && msg.activeView !== "table") {
        this.initChart(msg);
      }
    }
  }

  private async initChart(msg: ChatMessage) {
    if (!msg.reportTable?.chartSpec || !msg.reportTable.data?.length) return;
    const canvas = this.shadow.querySelector<HTMLCanvasElement>(`#chart-canvas-${msg.id}`);
    if (!canvas) return;

    if (this.chartInstances.has(msg.id)) {
      try {
        this.chartInstances.get(msg.id)?.destroy();
      } catch {}
      this.chartInstances.delete(msg.id);
    }

    try {
      const Chart = await this.ensureChartJsLoaded();
      const spec = msg.reportTable.chartSpec;
      const rawType = (spec.chartType || "column").toLowerCase();
      let chartType: any = "bar";
      if (rawType === "pie") chartType = "pie";
      else if (rawType === "doughnut") chartType = "doughnut";
      else if (rawType === "line") chartType = "line";
      else if (rawType === "bar" || rawType === "column") chartType = "bar";

      const categoryCol = spec.categoryColumn || msg.reportTable.columns[0];
      const valueCols =
        spec.valueColumns && spec.valueColumns.length > 0
          ? spec.valueColumns
          : msg.reportTable.columns.filter((c) => c !== categoryCol);

      const labels = msg.reportTable.data.map((r) => String(r[categoryCol] ?? ""));
      const colors = [
        "#6366f1",
        "#3b82f6",
        "#10b981",
        "#f59e0b",
        "#ec4899",
        "#8b5cf6",
        "#06b6d4",
        "#14b8a6",
        "#f97316",
        "#64748b",
      ];

      const datasets = valueCols.map((vCol, idx) => {
        const data = msg.reportTable!.data.map((r) => {
          const val = r[vCol];
          return typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "")) || 0;
        });
        const isPie = chartType === "pie" || chartType === "doughnut";
        return {
          label: vCol,
          data,
          backgroundColor: isPie ? colors : colors[idx % colors.length],
          borderColor: isPie ? "#ffffff" : colors[idx % colors.length],
          borderWidth: isPie ? 2 : 1,
          borderRadius: chartType === "bar" ? 4 : 0,
        };
      });

      const isPie = chartType === "pie" || chartType === "doughnut";
      const firstDataset = datasets[0];
      const totalPieValue = (firstDataset?.data || []).reduce(
        (acc: number, curr: any) => acc + (Number(curr) || 0),
        0
      );

      const datalabelsPlugin = {
        id: "customDataLabelsPlugin",
        afterDatasetsDraw(chartInstance: any) {
          const { ctx } = chartInstance;
          chartInstance.data.datasets.forEach((dataset: any, i: number) => {
            const meta = chartInstance.getDatasetMeta(i);
            if (!meta || meta.hidden) return;

            const datasetTotal = dataset.data.reduce(
              (acc: number, curr: any) => acc + (Number(curr) || 0),
              0
            );

            meta.data.forEach((element: any, index: number) => {
              const rawVal = Number(dataset.data[index]) || 0;
              if (rawVal <= 0) return;

              ctx.save();

              if (chartInstance.config.type === "pie" || chartInstance.config.type === "doughnut") {
                const pct = datasetTotal > 0 ? ((rawVal / datasetTotal) * 100).toFixed(1) : "0";
                if (Number(pct) >= 3) {
                  const pos = element.tooltipPosition();
                  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillStyle = "#ffffff";
                  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                  ctx.shadowBlur = 4;
                  ctx.fillText(`${pct}%`, pos.x, pos.y);
                }
              } else if (chartInstance.config.type === "bar") {
                const isHoriz = chartInstance.options.indexAxis === "y";
                ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
                ctx.fillStyle = "#475569";
                const formatted = rawVal.toLocaleString("vi-VN");
                if (isHoriz) {
                  ctx.textAlign = "left";
                  ctx.textBaseline = "middle";
                  ctx.fillText(formatted, element.x + 6, element.y);
                } else {
                  ctx.textAlign = "center";
                  ctx.textBaseline = "bottom";
                  ctx.fillText(formatted, element.x, element.y - 4);
                }
              }
              ctx.restore();
            });
          });
        },
      };

      const chart = new Chart(canvas, {
        type: chartType,
        data: { labels, datasets },
        plugins: [datalabelsPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: isPie || datasets.length > 1,
              position: "bottom",
              labels: {
                boxWidth: 10,
                font: { size: 10.5 },
                padding: 10,
                generateLabels: (chartInstance: any) => {
                  const defaultLabels =
                    Chart.defaults.plugins.legend.labels.generateLabels(chartInstance);
                  if (isPie) {
                    return defaultLabels.map((item: any, idx: number) => {
                      const val = Number(firstDataset?.data?.[idx]) || 0;
                      const pct =
                        totalPieValue > 0 ? ((val / totalPieValue) * 100).toFixed(1) : "0";
                      const formattedVal = val.toLocaleString("vi-VN");
                      return {
                        ...item,
                        text: `${labels[idx]}: ${formattedVal} (${pct}%)`,
                      };
                    });
                  }
                  return defaultLabels;
                },
              },
            },
            tooltip: {
              callbacks: {
                label: (context: any) => {
                  const val = Number(context.raw) || 0;
                  const formatted = val.toLocaleString("vi-VN");
                  if (isPie) {
                    const pct = totalPieValue > 0 ? ((val / totalPieValue) * 100).toFixed(1) : "0";
                    return ` ${context.label}: ${formatted} (${pct}%)`;
                  }
                  return ` ${context.dataset.label || ""}: ${formatted}`;
                },
              },
            },
          },
          scales: isPie
            ? {}
            : {
                x: { ticks: { font: { size: 10 } }, grid: { display: false } },
                y: {
                  ticks: {
                    font: { size: 10 },
                    callback: (val: any) =>
                      typeof val === "number" && val >= 1000 ? val.toLocaleString("vi-VN") : val,
                  },
                  grid: { color: "#f1f5f9" },
                },
              },
        },
      });

      this.chartInstances.set(msg.id, chart);
    } catch (err) {
      console.warn("[OmniChat] Could not render chart:", err);
    }
  }

  private downloadChartImage(msgId: string): void {
    const canvas = this.shadow.querySelector<HTMLCanvasElement>(`#chart-canvas-${msgId}`);
    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      ctx.drawImage(canvas, 0, 0);
    }

    const messages = this.chatCore ? this.chatCore.getMessages() : [];
    const msg = messages.find((m) => m.id === msgId);
    const rawTitle = msg?.reportTable?.chartSpec?.title || "bieu_do";
    const cleanTitle = rawTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `${cleanTitle || "bieu_do"}_${dateSuffix}.png`;

    const link = document.createElement("a");
    link.download = filename;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }

  private updateTimerUI(msg: ChatMessage): void {
    const timerPill = this.shadow.querySelector<HTMLElement>(
      `.omni-timer-pill[data-timer-id="${msg.id}"]`
    );
    if (timerPill && msg.elapsedSeconds !== undefined) {
      timerPill.textContent = `${msg.elapsedSeconds.toFixed(1)}s`;
    }
  }

  private cleanBoilerplate(text: string): string {
    if (!text) return text;
    return text
      .replace(
        /(?:Biểu đồ|Bảng số liệu|Hệ thống đã tự động dựng)[^.\n]*(?:bên dưới|được hiển thị)[^.\n]*(\.|$)/gi,
        ""
      )
      .replace(
        /Nếu bạn cần phân tích thêm[^.\n]*(?:cho mình biết nhé|hãy cho mình biết)[^.\n]*(\.|\!|$)/gi,
        ""
      )
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();
  }

  private escapeHtml(str: string): string {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private renderMessage(
    msg: ChatMessage,
    reportApiUrl: string,
    resolvedLogo: string | null = null
  ): string {
    const isUser = msg.sender === "user";
    const hasTable = !!msg.reportTable;
    const hasChart = !!(
      msg.reportTable?.chartSpec &&
      msg.reportTable.chartSpec.chartType &&
      msg.reportTable.chartSpec.chartType !== "none"
    );
    const activeView = msg.activeView || (hasChart ? "chart" : "table");

    return `
      <div class="omni-msg-row ${isUser ? "user" : "bot"}">
        <div class="omni-msg-wrap">
          ${
            !isUser
              ? `
            <div class="omni-bot-icon">
              ${
                resolvedLogo
                  ? `
                <img src="${resolvedLogo}" class="omni-bot-logo-img" alt="AI" />
              `
                  : `
                <svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
              `
              }
            </div>
          `
              : ""
          }
          <div class="omni-msg-col">
            ${
              msg.isStreaming
                ? `
              <div class="omni-streaming-banner">
                <span class="omni-spinner"></span>
                <span>${msg.streamingStatus || "Đang suy nghĩ..."}</span>
                ${msg.elapsedSeconds !== undefined ? `<span class="omni-timer-pill" data-timer-id="${msg.id}">${msg.elapsedSeconds.toFixed(1)}s</span>` : ""}
              </div>
            `
                : ""
            }

            ${
              msg.text
                ? `
              <div class="${isUser ? "omni-bubble-user" : "omni-bubble-bot"}">
                ${isUser ? this.escapeHtml(msg.text) : parseMarkdown(this.cleanBoilerplate(msg.text), reportApiUrl, hasTable)}
              </div>
            `
                : ""
            }

            ${
              msg.attachments && msg.attachments.length > 0
                ? `
              <div class="omni-attachments-preview">
                ${msg.attachments.map((a) => `<span class="omni-attachment-chip">📎 ${this.escapeHtml(a.name)}</span>`).join("")}
              </div>
            `
                : ""
            }

            ${
              hasChart
                ? `
              <div class="omni-chart-card">
                <div class="omni-chart-header">
                  <div class="omni-chart-title">
                    <svg viewBox="0 0 24 24"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>
                    <span>${msg.reportTable?.chartSpec?.title || "Biểu đồ trực quan"}</span>
                  </div>
                  <div class="omni-chart-toolbar">
                    <div class="omni-view-toggle">
                      <button class="omni-toggle-btn ${activeView === "chart" ? "active" : ""}" data-view="chart" data-msg-id="${msg.id}">📊 Biểu đồ</button>
                      <button class="omni-toggle-btn ${activeView === "table" ? "active" : ""}" data-view="table" data-msg-id="${msg.id}">📋 Bảng</button>
                    </div>
                    ${
                      activeView === "chart"
                        ? `
                      <button class="omni-chart-download-btn" data-download-chart="${msg.id}" title="Tải ảnh biểu đồ sắc nét dạng PNG">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        <span>Tải ảnh</span>
                      </button>
                    `
                        : msg.reportTable?.downloadUrl
                          ? `
                      <a class="omni-download-btn" href="${msg.reportTable.downloadUrl.startsWith("/") ? `${reportApiUrl}${msg.reportTable.downloadUrl}` : msg.reportTable.downloadUrl}" target="_blank" rel="noopener" style="margin:0;padding:3.5px 8px;font-size:10.5px;">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        <span>Tải Excel</span>
                      </a>
                    `
                          : ""
                    }
                  </div>
                </div>
                <div class="omni-chart-body" style="${activeView === "chart" ? "" : "display:none;"}">
                  <canvas id="chart-canvas-${msg.id}" style="max-height:240px;width:100%;"></canvas>
                </div>
                <div class="omni-table-view-body" style="${activeView === "table" ? "" : "display:none;"}">
                  ${this.renderReportTable(msg.reportTable, reportApiUrl)}
                </div>
              </div>
            `
                : hasTable
                  ? this.renderReportTable(msg.reportTable, reportApiUrl)
                  : ""
            }

            ${
              !msg.isStreaming && msg.elapsedSeconds !== undefined
                ? `
              <div class="omni-msg-footer">
                <span>⏱️ Phản hồi: ${msg.elapsedSeconds.toFixed(1)}s</span>
                ${msg.reportTable?.executionTimeMs ? `<span>• ⚡ SQL: ${msg.reportTable.executionTimeMs}ms</span>` : ""}
              </div>
            `
                : ""
            }

            ${msg.heavyQuery ? this.renderHeavyQueryCard(msg) : ""}
            ${msg.plan && msg.plan.nextStepDetail && !msg.isConfirmed ? this.renderActionCard(msg) : ""}
          </div>
        </div>
      </div>
    `;
  }

  private static readonly VI_NUMBER_FORMAT = new Intl.NumberFormat("vi-VN");

  private isColumnNumeric(table: any, col: string): boolean {
    if (!col) return false;
    const lowerCol = col.toLowerCase();
    if (
      lowerCol.includes("code") ||
      lowerCol.includes("id") ||
      lowerCol.includes("status") ||
      lowerCol.includes("ngay") ||
      lowerCol.includes("date")
    ) {
      return false;
    }
    if (
      lowerCol.includes("tien") ||
      lowerCol.includes("amount") ||
      lowerCol.includes("price") ||
      lowerCol.includes("gia") ||
      lowerCol.includes("doanhthu") ||
      lowerCol.includes("revenue") ||
      lowerCol.includes("total") ||
      lowerCol.includes("soluong") ||
      lowerCol.includes("quantity") ||
      lowerCol.includes("sl")
    ) {
      return true;
    }
    if (!table?.data || table.data.length === 0) return false;
    const sample = table.data[0]?.[col];
    return (
      typeof sample === "number" ||
      (/^-?\d+(\.\d+)?$/.test(String(sample ?? "").trim()) &&
        String(sample ?? "").trim().length > 0)
    );
  }

  private formatCellValue(val: any, colName: string = ""): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "number") {
      return OmniChatElement.VI_NUMBER_FORMAT.format(val);
    }
    const str = String(val).trim();
    if (/^-?\d+(\.\d+)?$/.test(str) && str.length <= 18) {
      const lowerCol = colName.toLowerCase();
      const isCodeOrId =
        lowerCol.includes("code") ||
        lowerCol.includes("id") ||
        lowerCol.includes("status") ||
        lowerCol === "stt" ||
        lowerCol === "nam" ||
        lowerCol === "thang";
      if (isCodeOrId && str.length <= 4) {
        return str;
      }
      const num = Number(str);
      if (!isNaN(num)) return OmniChatElement.VI_NUMBER_FORMAT.format(num);
    }
    return str;
  }

  private renderReportTable(table: any, reportApiUrl: string): string {
    if (!table || !table.columns || table.columns.length === 0) return "";
    let downloadHref = table.downloadUrl || "";
    if (downloadHref && downloadHref.startsWith("/api/ai-report/download/")) {
      downloadHref = `${reportApiUrl}${downloadHref}`;
    }

    const numericCols = new Set(
      table.columns.filter((c: string) => this.isColumnNumeric(table, c))
    );

    return `
      <div class="omni-table-wrapper">
        <div style="padding:6px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:600;font-size:11px;color:#334155;">📊 Dữ liệu báo cáo (${table.rowCount || table.data.length} dòng)</span>
          ${
            downloadHref
              ? `
            <a class="omni-download-btn" href="${downloadHref}" target="_blank" rel="noopener" style="margin:0;padding:4px 8px;font-size:11px;">
              <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Tải Excel
            </a>
          `
              : ""
          }
        </div>
        <table class="omni-table">
          <thead>
            <tr>${table.columns.map((c: string) => `<th class="${numericCols.has(c) ? "text-right" : ""}">${c}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${table.data
              .map(
                (row: any) => `
              <tr>${table.columns.map((c: string) => `<td class="${numericCols.has(c) ? "text-right font-mono" : ""}">${this.formatCellValue(row[c], c)}</td>`).join("")}</tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderHeavyQueryCard(msg: ChatMessage): string {
    if (!msg.heavyQuery || msg.heavyQuery.status === "created") return "";
    const estRows = msg.heavyQuery.estimatedRows
      ? Number(msg.heavyQuery.estimatedRows).toLocaleString()
      : "lớn";
    return `
      <div class="omni-heavy-card" style="margin-top:10px;padding:12px;background:#fefce8;border:1px solid #fde047;border-radius:8px;">
        <div style="font-weight:600;font-size:12px;color:#854d0e;display:flex;align-items:center;gap:6px;">
          <span>⚡</span>
          <span>Truy vấn dữ liệu lớn (~${estRows} dòng)</span>
        </div>
        <div style="font-size:11px;color:#713f12;margin-top:6px;line-height:1.4;">
          Để bảo vệ kết nối và tránh đơ giao diện, hệ thống đề xuất đưa tác vụ này vào hàng đợi nền Hangfire.
        </div>
        <div style="margin-top:8px;">
          <button class="omni-btn-bg-job" data-msg-id="${msg.id}" style="background:#eab308;color:#0f172a;font-weight:600;font-size:11px;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <span>🚀</span>
            <span>Chuyển sang xuất nền (Hangfire)</span>
          </button>
        </div>
      </div>
    `;
  }

  private renderActionCard(msg: ChatMessage): string {
    const step = msg.plan?.nextStepDetail;
    if (!step) return "";
    const missing = step.missing_required_fields || [];

    return `
      <div class="omni-action-card" data-plan-id="${msg.plan?.planId}">
        <div class="omni-action-title">⚙️ Xác nhận: ${step.name}</div>
        ${missing
          .map(
            (f) => `
          <div class="omni-action-field">
            <label>${f}</label>
            <input type="text" data-field="${f}" placeholder="Nhập ${f}..." />
          </div>
        `
          )
          .join("")}
        <div class="omni-action-buttons">
          <button class="omni-btn-cancel">Hủy</button>
          <button class="omni-btn-confirm" data-msg-id="${msg.id}">Xác nhận thực hiện</button>
        </div>
      </div>
    `;
  }

  private bindEvents() {
    this.shadow.querySelector(".omni-launcher")?.addEventListener("click", () => this.toggleOpen());
    this.shadow.querySelector(".btn-close")?.addEventListener("click", () => this.toggleOpen());
    this.shadow.querySelector(".btn-expand")?.addEventListener("click", () => this.toggleExpand());
    this.shadow
      .querySelector(".btn-clear")
      ?.addEventListener("click", () => this.chatCore.clearMessages());

    const fileInput = this.shadow.querySelector<HTMLInputElement>(".omni-file-input");
    this.shadow
      .querySelector(".omni-attach-btn")
      ?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (!input.files) return;
      Array.from(input.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.chatCore.addAttachment({
            name: file.name,
            size: file.size,
            type: file.type,
            base64: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      });
      input.value = "";
    });

    this.shadow.querySelectorAll<HTMLButtonElement>("[data-remove-att]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-remove-att") || "0", 10);
        this.chatCore.removeAttachment(idx);
      });
    });

    const textarea = this.shadow.querySelector<HTMLTextAreaElement>(".omni-textarea");
    const sendBtn = this.shadow.querySelector<HTMLButtonElement>(".omni-send-btn");

    const handleSend = () => {
      const text = textarea?.value.trim() || "";
      if (text || this.chatCore.getAttachments().length > 0) {
        this.chatCore.sendMessage(text);
        if (textarea) textarea.value = "";
      }
    };

    sendBtn?.addEventListener("click", handleSend);
    textarea?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    this.shadow.querySelectorAll<HTMLButtonElement>(".omni-suggestion-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const text = chip.getAttribute("data-suggestion");
        if (text) this.chatCore.sendMessage(text);
      });
    });

    // Action confirmation handling
    this.shadow.querySelectorAll<HTMLButtonElement>(".omni-btn-confirm").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const card = btn.closest(".omni-action-card");
        const planId = card?.getAttribute("data-plan-id");
        const msgId = btn.getAttribute("data-msg-id");
        if (!planId) return;

        const inputs: Record<string, any> = {};
        card?.querySelectorAll<HTMLInputElement>("input[data-field]").forEach((inp) => {
          const field = inp.getAttribute("data-field");
          if (field) inputs[field] = inp.value.trim();
        });

        const targetMsg = this.chatCore.getMessages().find((m) => m.id === msgId);
        if (targetMsg) targetMsg.isConfirmed = true;

        btn.disabled = true;
        btn.textContent = "Đang thực hiện...";
        await this.chatCore.confirmPlan(planId, inputs);
      });
    });

    this.shadow.querySelectorAll<HTMLButtonElement>(".omni-btn-cancel").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".omni-action-card");
        card?.remove();
      });
    });

    this.shadow.querySelectorAll<HTMLButtonElement>(".omni-btn-bg-job").forEach((btn) => {
      btn.addEventListener("click", () => {
        const msgId = btn.getAttribute("data-msg-id");
        if (msgId) {
          btn.disabled = true;
          btn.textContent = "Đang chuyển sang Hangfire...";
          this.chatCore.triggerBackgroundJob(msgId);
        }
      });
    });

    // Download Chart Image as PNG
    this.shadow.querySelectorAll<HTMLButtonElement>("[data-download-chart]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const msgId = btn.getAttribute("data-download-chart");
        if (msgId) {
          this.downloadChartImage(msgId);
        }
      });
    });

    // View toggle between Chart and Table
    this.shadow.querySelectorAll<HTMLButtonElement>(".omni-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const msgId = btn.getAttribute("data-msg-id");
        const view = btn.getAttribute("data-view") as "chart" | "table";
        const targetMsg = this.chatCore.getMessages().find((m) => m.id === msgId);
        if (targetMsg && view) {
          targetMsg.activeView = view;
          this.render();
        }
      });
    });
  }
}
