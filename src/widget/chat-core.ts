import { OmniChatConfig, ChatMessage, ChatAttachment } from "./types";

export class ChatCore {
  private config: OmniChatConfig;
  private messages: ChatMessage[] = [];
  private attachments: ChatAttachment[] = [];
  private onUpdate: () => void;

  private activeTimers = new Map<string, any>();

  private onTimerTick?: (msg: ChatMessage) => void;

  private readonly RETENTION_MS = 24 * 60 * 60 * 1000; // Tự động xóa sau 1 ngày (24 giờ)

  private getStorageKey(): string {
    return `omni_widget_chat_${this.config.appId || "default"}`;
  }

  private isWithinRetention(m: Partial<ChatMessage>, now: number): boolean {
    const t = m.timestamp ? new Date(m.timestamp).getTime() : null;
    return Boolean(t && !isNaN(t) && now - t <= this.RETENTION_MS);
  }

  private loadHistory(): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      this.cleanupExpiredHistory();
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const parsed: ChatMessage[] = JSON.parse(raw);
        const now = Date.now();
        const valid = parsed.filter((m) => this.isWithinRetention(m, now));
        if (valid.length > 0) {
          this.messages = valid.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
            isStreaming: false,
            streamingStatus: undefined,
          }));
          return;
        }
      }
    } catch {}

    this.messages = [
      {
        id: "welcome",
        sender: "bot",
        text:
          this.config.welcomeMessage ||
          `Xin chào! Tôi là Trợ lý AI của hệ thống. Tôi có thể hỗ trợ bạn tra cứu, tổng hợp dữ liệu và thực hiện các nghiệp vụ nhanh chóng.`,
        timestamp: new Date(),
      },
    ];
  }

  saveHistory(): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      const now = Date.now();
      const toSave = this.messages
        .filter((m) => m.id !== "welcome")
        .filter((m) => this.isWithinRetention(m, now))
        .slice(-50)
        .map((m) => {
          const { isStreaming, streamingStatus, ...rest } = m;
          return rest;
        });

      if (toSave.length === 0) {
        localStorage.removeItem(this.getStorageKey());
      } else {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(toSave));
      }
    } catch {}
  }

  private cleanupExpiredHistory(): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      const now = Date.now();
      const toRemove: string[] = [];
      const widgetKeys = Object.keys(localStorage).filter((k) => k.startsWith("omni_widget_chat_"));

      for (const key of widgetKeys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed: ChatMessage[] = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter((m) => this.isWithinRetention(m, now));
            if (valid.length === 0) {
              toRemove.push(key);
            } else if (valid.length !== parsed.length) {
              localStorage.setItem(key, JSON.stringify(valid));
            }
          }
        } catch {}
      }

      for (const k of toRemove) {
        localStorage.removeItem(k);
      }
    } catch {}
  }

  constructor(
    config: OmniChatConfig,
    onUpdate: () => void,
    onTimerTick?: (msg: ChatMessage) => void
  ) {
    this.config = config;
    this.onUpdate = onUpdate;
    this.onTimerTick = onTimerTick;
    this.loadHistory();
  }

  startTimer(msg: ChatMessage, startTime: number) {
    this.stopTimer(msg.id);
    const timer = setInterval(() => {
      if (msg.isStreaming) {
        msg.elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
        if (this.onTimerTick) {
          this.onTimerTick(msg);
        } else {
          this.onUpdate();
        }
      } else {
        this.stopTimer(msg.id);
      }
    }, 100);
    this.activeTimers.set(msg.id, timer);
  }

  stopTimer(msgId: string) {
    const timer = this.activeTimers.get(msgId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(msgId);
    }
  }

  stopAllTimers() {
    for (const timer of this.activeTimers.values()) {
      clearInterval(timer);
    }
    this.activeTimers.clear();
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getAttachments(): ChatAttachment[] {
    return this.attachments;
  }

  addAttachment(att: ChatAttachment) {
    this.attachments.push(att);
    this.onUpdate();
  }

  removeAttachment(index: number) {
    this.attachments.splice(index, 1);
    this.onUpdate();
  }

  clearMessages() {
    this.stopAllTimers();
    this.messages = [];
    this.attachments = [];
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(this.getStorageKey());
      }
    } catch {}
    this.messages.push({
      id: "welcome",
      sender: "bot",
      text:
        this.config.welcomeMessage || `Đã làm mới cuộc hội thoại. Tôi có thể hỗ trợ gì cho bạn?`,
      timestamp: new Date(),
    });
    this.onUpdate();
  }

  addMessage(
    sender: "user" | "bot" | "system",
    text: string,
    extra: Partial<ChatMessage> = {}
  ): ChatMessage {
    const msg: ChatMessage = {
      id: `${sender}_${Date.now()}`,
      sender,
      text,
      timestamp: new Date(),
      ...extra,
    };
    this.messages.push(msg);
    this.saveHistory();
    this.onUpdate();
    return msg;
  }

  async resolveToken(): Promise<string> {
    if (!this.config.authToken) return "";
    if (typeof this.config.authToken === "function") {
      const res = await this.config.authToken();
      return res || "";
    }
    return this.config.authToken;
  }

  async sendMessage(instruction: string) {
    if (!instruction.trim() && this.attachments.length === 0) return;

    const currentAttachments = [...this.attachments];
    this.attachments = [];

    const userMsg: ChatMessage = {
      id: "usr_" + Date.now(),
      sender: "user",
      text: instruction.trim(),
      timestamp: new Date(),
      attachments: currentAttachments,
    };
    this.messages.push(userMsg);

    const startTime = Date.now();
    const botMsg: ChatMessage = {
      id: "bot_" + Date.now(),
      sender: "bot",
      text: "",
      timestamp: new Date(),
      isStreaming: true,
      streamingStatus: "Đang suy nghĩ...",
      elapsedSeconds: 0,
      showSteps: true,
    };
    this.messages.push(botMsg);
    this.startTimer(botMsg, startTime);
    this.onUpdate();

    try {
      const token = await this.resolveToken();
      let context: Record<string, any> = {};
      if (this.config.getContext) {
        try {
          context = await this.config.getContext();
        } catch (e) {
          console.warn("[OmniChat] Failed to get context:", e);
        }
      }

      if (currentAttachments.length > 0) {
        context.attachments = currentAttachments;
      }

      const clientKey = this.config.microsoftClientKey || this.config.appId || "";
      const baseUrl =
        this.config.orchestratorUrl ||
        (typeof window !== "undefined" && (window as any).__OMNI_ORCHESTRATOR_URL__) ||
        "http://localhost:20128";
      const streamUrl = `${baseUrl.replace(/\/$/, "")}/api/orchestrator/chat-stream`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-microsoft-client-key": clientKey,
      };
      if (this.config.apiKey) {
        headers["x-api-key"] = this.config.apiKey;
      }
      if (context && context.applicationId && context.applicationId !== clientKey) {
        headers["X-Application-Id"] = context.applicationId;
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(streamUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          instruction: instruction.trim(),
          microsoftClientKey: clientKey,
          applicationId: (context && context.applicationId) || undefined,
          context,
          autoExecute: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let currentEvent = "message";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            currentEvent = "message";
            continue;
          }

          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const payload = JSON.parse(jsonStr);
              this.handleStreamEvent(botMsg, currentEvent, payload);
            } catch (err) {
              console.warn("[OmniChat] SSE Parse Error:", err);
            }
          }
        }
      }

      this.stopTimer(botMsg.id);
      botMsg.elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
      botMsg.isStreaming = false;
      botMsg.streamingStatus = undefined;
      this.saveHistory();
      this.onUpdate();
    } catch (err: any) {
      this.stopTimer(botMsg.id);
      botMsg.elapsedSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
      botMsg.isStreaming = false;
      botMsg.streamingStatus = undefined;
      botMsg.text = `⚠️ Không thể hoàn thành yêu cầu: ${err.message || "Lỗi kết nối tới AI Hub"}`;
      this.saveHistory();
      this.onUpdate();
    }
  }

  private handleStreamEvent(msg: ChatMessage, eventType: string, data: any) {
    if (eventType === "status") {
      msg.streamingStatus = data.message || data.status;
      this.onUpdate();
    } else if (eventType === "text_delta") {
      if (data.accumulated) {
        msg.text = data.accumulated;
      } else if (data.delta) {
        msg.text += data.delta;
      }
      this.onUpdate();
    } else if (eventType === "content" || eventType === "token") {
      msg.text += data.content || data.token || "";
      this.onUpdate();
    } else if (eventType === "plan_created" || eventType === "plan") {
      msg.plan = data;
      const rawSteps = data.steps || data.data?.steps || [];
      msg.liveSteps = rawSteps.map((s: any, idx: number) => ({
        stepIndex: s.stepIndex !== undefined ? Number(s.stepIndex) : idx,
        name: s.name || `Bước ${idx + 1}`,
        action: s.action,
        status: "pending",
      }));
      this.onUpdate();
    } else if (eventType === "step_start") {
      if (!msg.liveSteps) msg.liveSteps = [];
      const sData = data.data || data;
      const targetIdx = Number(sData.stepIndex);
      const found = msg.liveSteps.find((s) => s.stepIndex === targetIdx || s.name === sData.name);
      if (found) {
        found.status = "running";
        if (sData.action) found.action = sData.action;
      } else {
        msg.liveSteps.push({
          stepIndex: isNaN(targetIdx) ? msg.liveSteps.length : targetIdx,
          name: sData.name || "Đang thực thi",
          action: sData.action,
          status: "running",
        });
      }
      msg.streamingStatus = sData.name || msg.streamingStatus;
      this.onUpdate();
    } else if (eventType === "confirmation_required" || eventType === "need_input") {
      msg.plan = data;
      if (data.botMessage && !msg.text) {
        msg.text = data.botMessage;
      }
      if (msg.plan && this.config.onAction) {
        this.config.onAction(msg.plan);
      }
      this.onUpdate();
    } else if (eventType === "step_done" || eventType === "result" || eventType === "synthesized") {
      if (msg.liveSteps) {
        const sData = data.data || data;
        const targetIdx = Number(sData.stepIndex);
        const found = msg.liveSteps.find(
          (s) =>
            s.stepIndex === targetIdx ||
            (!isNaN(targetIdx) && msg.liveSteps!.indexOf(s) === targetIdx)
        );
        if (found) {
          found.status = sData.status === "ERROR" || data.error ? "error" : "success";
          if (sData.error) found.detail = sData.error;
        }
      }
      const res = data.result || data.synthesizedData || data;
      if (res && res.isHeavyQuery) {
        msg.heavyQuery = {
          isHeavy: true,
          estimatedRows: res.estimatedRows,
          sql: res.sql,
          applicationId: res.applicationId,
          summary: res.summary,
        };
      }
      if (res && res.columns && res.previewData) {
        msg.reportTable = {
          columns: res.columns,
          data: res.previewData,
          rowCount: res.rowCount,
          executionTimeMs: res.executionTimeMs,
          downloadUrl: res.downloadUrl,
          downloadFileName: res.downloadFileName,
          chartSpec: res.chartSpec,
        };
        if (res.chartSpec && res.chartSpec.chartType && res.chartSpec.chartType !== "none") {
          msg.activeView = "chart";
        } else {
          msg.activeView = "table";
        }
      }
      if (data.error && !msg.text) {
        msg.text = `⚠️ Lỗi thực thi bước: ${data.error}`;
      }
      this.onUpdate();
    } else if (eventType === "report_result") {
      const res = data.data || data;
      if (res && res.columns && res.previewData) {
        msg.reportTable = {
          columns: res.columns,
          data: res.previewData,
          rowCount: res.rowCount,
          executionTimeMs: res.executionTimeMs,
          downloadUrl: res.downloadUrl,
          downloadFileName: res.downloadFileName,
          chartSpec: res.chartSpec,
        };
        if (res.chartSpec && res.chartSpec.chartType && res.chartSpec.chartType !== "none") {
          msg.activeView = "chart";
        } else {
          msg.activeView = "table";
        }
      }
      this.onUpdate();
    } else if (eventType === "done") {
      this.stopTimer(msg.id);
      msg.isStreaming = false;
      msg.streamingStatus = undefined;
      msg.elapsedSeconds = Number(((Date.now() - msg.timestamp.getTime()) / 1000).toFixed(1));
      const res = data.synthesizedData || data.result;
      if (res && res.isHeavyQuery) {
        msg.heavyQuery = {
          isHeavy: true,
          estimatedRows: res.estimatedRows,
          sql: res.sql,
          applicationId: res.applicationId,
          summary: res.summary,
        };
      }
      if (res && res.columns && res.previewData && !msg.reportTable) {
        msg.reportTable = {
          columns: res.columns,
          data: res.previewData,
          rowCount: res.rowCount,
          executionTimeMs: res.executionTimeMs,
          downloadUrl: res.downloadUrl,
          downloadFileName: res.downloadFileName,
          chartSpec: res.chartSpec,
        };
        if (res.chartSpec && res.chartSpec.chartType && res.chartSpec.chartType !== "none") {
          msg.activeView = "chart";
        } else {
          msg.activeView = "table";
        }
      }
      if (data.botMessage && !msg.text) {
        msg.text = data.botMessage;
      }
      this.saveHistory();
      this.onUpdate();
    } else if (eventType === "error") {
      this.stopTimer(msg.id);
      msg.isStreaming = false;
      msg.streamingStatus = undefined;
      msg.elapsedSeconds = Number(((Date.now() - msg.timestamp.getTime()) / 1000).toFixed(1));
      msg.text = (msg.text ? msg.text + "\n\n" : "") + `⚠️ ${data.message || "Lỗi không xác định"}`;
      this.saveHistory();
      this.onUpdate();
    }
  }

  async triggerBackgroundJob(msgId: string) {
    const msg = this.messages.find((m) => m.id === msgId);
    if (!msg || !msg.heavyQuery) return;

    const token = await this.resolveToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-Key": "dr_internal_sec_89f1a23c04b7",
    };
    if (token) {
      headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }

    const reportBaseUrl =
      this.config.reportApiUrl ||
      (typeof window !== "undefined" && (window as any).__DYNAMIC_REPORT_API_URL__) ||
      "http://localhost:5001";

    try {
      const res = await fetch(
        `${reportBaseUrl.replace(/\/$/, "")}/api/ai-report/create-background-job`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            applicationId: msg.heavyQuery.applicationId || this.config.appId,
            sql: msg.heavyQuery.sql,
            reportName: msg.heavyQuery.summary || "Báo cáo AI xuất nền",
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        msg.heavyQuery.status = "created";
        msg.heavyQuery.jobId = data.jobId;
        msg.heavyQuery.hangfireJobId = data.hangfireJobId;
        this.addMessage(
          "bot",
          `✅ **Đã chuyển sang quy trình xuất báo cáo nền (Hangfire):**\n- **Mã Job:** \`${data.jobId}\`\n- **Mã báo cáo:** \`${data.reportCode}\`\n- **Trạng thái:** Đang xử lý ngầm trong hàng đợi \`reports\`.\n\nSau khi xử lý xong, hệ thống sẽ lưu file báo cáo vào danh sách báo cáo đã hoàn thành.`
        );
      } else {
        this.addMessage("bot", `⚠️ Không thể tạo Job nền: ${data.message || "Lỗi không xác định"}`);
      }
    } catch (err: any) {
      this.addMessage("bot", `⚠️ Lỗi kết nối khi tạo Job nền: ${err.message || String(err)}`);
    }
    this.onUpdate();
  }

  async confirmPlan(planId: string, inputs: Record<string, any> = {}) {
    const token = await this.resolveToken();
    const clientKey = this.config.microsoftClientKey || this.config.appId || "";
    const baseUrl =
      this.config.orchestratorUrl ||
      (typeof window !== "undefined" && (window as any).__OMNI_ORCHESTRATOR_URL__) ||
      "http://localhost:20128";
    const confirmUrl = `${baseUrl.replace(/\/$/, "")}/api/orchestrator/confirm`;

    let context: Record<string, any> = {};
    if (this.config.getContext) {
      try {
        context = await this.config.getContext();
      } catch (e) {
        console.warn("[OmniChat] Failed to get context for confirm:", e);
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-microsoft-client-key": clientKey,
      "X-Application-Id": (context && context.applicationId) || clientKey,
    };
    if (this.config.apiKey) {
      headers["x-api-key"] = this.config.apiKey;
    }
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(confirmUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          planId,
          userSuppliedInputs: inputs,
          microsoftClientKey: clientKey,
          applicationId: context && context.applicationId,
        }),
      });
      const result = await res.json();
      if (result.Code === 200) {
        const data = result.Data;
        const botMsgText =
          data?.botMessage || data?.result?.summary || "✅ Đã thực thi kế hoạch thành công.";
        const newMsg = this.addMessage("bot", botMsgText);
        if (data?.result?.columns && data?.result?.previewData) {
          newMsg.reportTable = {
            columns: data.result.columns,
            data: data.result.previewData,
            rowCount: data.result.rowCount,
            executionTimeMs: data.result.executionTimeMs,
            downloadUrl: data.result.downloadUrl,
            downloadFileName: data.result.downloadFileName,
            chartSpec: data.result.chartSpec,
          };
          if (
            data.result.chartSpec &&
            data.result.chartSpec.chartType &&
            data.result.chartSpec.chartType !== "none"
          ) {
            newMsg.activeView = "chart";
          } else {
            newMsg.activeView = "table";
          }
          this.onUpdate();
        }
      } else {
        this.addMessage("bot", `⚠️ Lỗi xác nhận kế hoạch: ${result.Message || "Thất bại"}`);
      }
      return result;
    } catch (err: any) {
      this.addMessage("bot", `⚠️ Lỗi kết nối khi xác nhận kế hoạch: ${err.message || String(err)}`);
      throw err;
    }
  }
}
