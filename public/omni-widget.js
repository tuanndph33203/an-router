(() => {
  var F = Object.defineProperty;
  var N = (g, n, e) =>
    n in g ? F(g, n, { enumerable: !0, configurable: !0, writable: !0, value: e }) : (g[n] = e);
  var u = (g, n, e) => N(g, typeof n != "symbol" ? n + "" : n, e);
  var R = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #1e293b;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: inherit;
  margin: 0;
  padding: 0;
}

/* Floating Launcher */
.omni-launcher {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 52px;
  height: 52px;
  border-radius: 26px;
  background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px -4px rgba(124, 58, 237, 0.45);
  cursor: pointer;
  border: none;
  outline: none;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 999999;
  padding: 0;
}

.omni-launcher:hover {
  transform: scale(1.08);
  box-shadow: 0 12px 28px -4px rgba(124, 58, 237, 0.55);
}

.omni-launcher svg {
  width: 28px;
  height: 28px;
  fill: currentColor;
}

.omni-badge {
  position: absolute;
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background-color: #10b981;
  border: 2px solid #ffffff;
  border-radius: 50%;
}

/* Main Chat Window */
.omni-window {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  height: 580px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 40px);
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 999999;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s, transform 0.2s;
  opacity: 0;
  transform: translateY(16px) scale(0.96);
  pointer-events: none;
}

.omni-window.open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.omni-window.compact {
  width: 400px;
  height: 580px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 40px);
}

.omni-window.expanded {
  width: 680px;
  height: min(720px, calc(100vh - 40px));
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 40px);
}

@media (max-width: 640px) {
  .omni-window, .omni-window.compact, .omni-window.expanded {
    width: 100vw !important;
    height: 100vh !important;
    bottom: 0 !important;
    right: 0 !important;
    border-radius: 0 !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
  }
}

/* Header */
.omni-header {
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 55%, #7c3aed 100%);
  color: #ffffff;
  padding: 13px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  user-select: none;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.omni-header-info,
.omni-header-left {
  display: flex;
  align-items: center;
  gap: 11px;
}

.omni-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.omni-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.omni-avatar svg {
  width: 20px;
  height: 20px;
  fill: #ffffff;
}

.omni-status-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #22c55e;
  border: 2px solid #6366f1;
  box-shadow: 0 0 4px rgba(34, 197, 94, 0.6);
}

.omni-title-group,
.omni-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 1.5px;
}

.omni-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.25;
}

.omni-subtitle {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.2;
}

.omni-header-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.omni-icon-btn {
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: rgba(255, 255, 255, 0.9);
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.omni-icon-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  transform: translateY(-1px);
}

.omni-icon-btn svg {
  width: 15px;
  height: 15px;
  fill: currentColor;
}

/* Messages Area */
.omni-messages {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.omni-msg-row {
  display: flex;
  width: 100%;
}

.omni-msg-row.user {
  justify-content: flex-end;
}

.omni-msg-row.bot {
  justify-content: flex-start;
}

.omni-msg-wrap {
  display: flex;
  gap: 8px;
  max-width: 96%;
  min-width: 0;
}

.omni-bot-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: transparent;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.omni-bot-icon svg {
  width: 14px;
  height: 14px;
  fill: #ffffff;
}

.omni-bot-logo-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.omni-launcher-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.omni-msg-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
  max-width: 100%;
}

.omni-bubble-user {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: #ffffff;
  padding: 8px 13px;
  border-radius: 16px 16px 4px 16px;
  font-size: 12.5px;
  line-height: 1.45;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  word-break: break-word;
}

.omni-bubble-bot {
  background: #ffffff;
  color: #1e293b;
  padding: 10px 14px;
  border-radius: 16px 16px 16px 4px;
  font-size: 12.5px;
  line-height: 1.5;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  word-break: break-word;
  overflow-x: hidden;
  max-width: 100%;
}

.omni-streaming-banner {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.22);
  color: #4f46e5;
  font-size: 11px;
  font-weight: 500;
  width: fit-content;
}

.omni-streaming-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7c3aed;
}

@keyframes omni-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* Markdown Formatted Elements */
.omni-bubble-bot p {
  margin-bottom: 6px;
}
.omni-bubble-bot p:last-child {
  margin-bottom: 0;
}

.omni-table-wrapper {
  overflow-x: auto;
  max-width: 100%;
  margin: 8px 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.omni-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
  line-height: 1.4;
  white-space: nowrap;
}

.omni-table th {
  background: #f1f5f9;
  color: #334155;
  font-weight: 600;
  padding: 6px 10px;
  border-bottom: 1px solid #cbd5e1;
  text-align: left;
}

.omni-table td {
  padding: 5px 10px;
  border-bottom: 1px solid #f1f5f9;
  color: #475569;
}

.omni-table th.text-right,
.omni-table td.text-right {
  text-align: right;
}

.omni-table td.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.omni-table tr:hover td {
  background: #f8fafc;
}

.omni-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  color: #ffffff !important;
  font-size: 11.5px;
  font-weight: 600;
  text-decoration: none !important;
  box-shadow: 0 1px 3px rgba(5, 150, 105, 0.3);
  margin: 6px 0;
  cursor: pointer;
  border: none;
  transition: transform 0.15s, box-shadow 0.15s;
}

.omni-download-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(5, 150, 105, 0.4);
}

.omni-download-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

/* Action Plan Card (CMMS / ERP) */
.omni-action-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 10px 12px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}

.omni-action-title {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}

.omni-action-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.omni-action-field label {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

.omni-action-field input {
  padding: 6px 9px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 11.5px;
  outline: none;
}

.omni-action-field input:focus {
  border-color: #7c3aed;
}

.omni-action-buttons {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 4px;
}

.omni-btn-confirm {
  padding: 6px 14px;
  border-radius: 6px;
  background: #7c3aed;
  color: #ffffff;
  border: none;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.omni-btn-confirm:hover {
  background: #6d28d9;
}

.omni-btn-cancel {
  padding: 6px 12px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  border: none;
  font-size: 11.5px;
  cursor: pointer;
}

/* Attachment Chips */
.omni-attachments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}

.omni-attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 8px;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 11px;
  font-weight: 500;
}

.omni-attachment-chip button {
  background: transparent;
  border: none;
  color: #8b5cf6;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}

/* Input Area */
.omni-input-container {
  padding: 10px 12px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.omni-input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 6px 8px;
  transition: border-color 0.15s;
}

.omni-input-row:focus-within {
  border-color: #7c3aed;
  background: #ffffff;
}

.omni-attach-btn {
  background: transparent;
  border: none;
  color: #64748b;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.omni-attach-btn:hover {
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.08);
}

.omni-attach-btn svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.omni-textarea {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12.5px;
  font-family: inherit;
  resize: none;
  max-height: 100px;
  min-height: 22px;
  line-height: 1.4;
  color: #1e293b;
}

.omni-send-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #7c3aed;
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.1s;
}

.omni-send-btn:hover {
  background: #6d28d9;
}

.omni-send-btn svg {
  width: 14px;
  height: 14px;
  fill: #ffffff;
}

/* Quick Suggestions */
.omni-suggestions {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.omni-suggestion-chip {
  padding: 4px 9px;
  border-radius: 12px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.omni-suggestion-chip:hover {
  background: #ede9fe;
  color: #7c3aed;
  border-color: #ddd6fe;
}

/* Spinner & Live Timer */
.omni-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(99, 102, 241, 0.25);
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: omni-spin 0.75s linear infinite;
  display: inline-block;
  flex-shrink: 0;
  box-sizing: border-box;
}

.omni-spinner-mini {
  width: 10px;
  height: 10px;
  border: 1.5px solid rgba(99, 102, 241, 0.25);
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: omni-spin 0.75s linear infinite;
  display: inline-block;
}

@keyframes omni-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.omni-timer-pill {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  background: #ede9fe;
  color: #6d28d9;
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: 4px;
}

/* Live Workflow Steps */
.omni-steps-box {
  margin-top: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 11px;
}

.omni-steps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  color: #334155;
}

.omni-steps-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.omni-steps-time {
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #64748b;
  font-size: 10px;
  font-weight: normal;
}

.omni-steps-toggle-icon {
  font-size: 9px;
  color: #94a3b8;
  transition: transform 0.2s;
}

.omni-steps-list {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.omni-step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 11px;
  background: #ffffff;
  border: 1px solid #f1f5f9;
}

.omni-step-item.running {
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #5b21b6;
  font-weight: 500;
}

.omni-step-item.success {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}

.omni-step-item.error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}

.omni-step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  font-weight: bold;
}

.omni-step-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.omni-step-action {
  font-size: 9px;
  font-family: monospace;
  text-transform: uppercase;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 4px;
  border-radius: 3px;
}

.omni-msg-footer {
  margin-top: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Interactive Chart Card */
.omni-chart-card {
  margin-top: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.omni-chart-header {
  padding: 9px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.omni-chart-title {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-weight: 600;
  font-size: 12px;
  color: #1e293b;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}

.omni-chart-title svg {
  width: 15px;
  height: 15px;
  fill: #7c3aed;
  flex-shrink: 0;
  margin-top: 1px;
}

.omni-chart-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed #e2e8f0;
}

.omni-chart-body {
  position: relative;
  padding: 10px;
}

.omni-chart-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3.5px 8px;
  font-size: 10.5px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  white-space: nowrap !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.15s ease;
}

.omni-chart-download-btn:hover {
  background: #f1f5f9;
  color: #4338ca;
  border-color: #6366f1;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.2);
}

.omni-chart-download-btn svg {
  width: 12px;
  height: 12px;
  fill: #6366f1;
  flex-shrink: 0;
}

.omni-view-toggle {
  display: flex;
  align-items: center;
  background: #e2e8f0;
  padding: 2px;
  border-radius: 6px;
  gap: 2px;
}

.omni-toggle-btn {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.omni-toggle-btn.active {
  background: #ffffff;
  color: #7c3aed;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.omni-chart-body {
  padding: 10px;
  position: relative;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.omni-chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #64748b;
  font-size: 11px;
}
`;
  function j(g, n = "", e = !1) {
    if (!g) return "";
    let i = g.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    ((i = i.replace(/```chart-spec\s*([\s\S]*?)```/gi, "")),
      (i = i.replace(/```chart-spec\s*([\s\S]*)$/gi, "")));
    let t = [];
    ((i = i.replace(/```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/gi, (o, a, s) => {
      let c = t.length,
        h = (a || "code").toUpperCase();
      return (
        t.push(`
      <div style="background:#0f172a;color:#f8fafc;border-radius:8px;overflow:hidden;margin:8px 0;border:1px solid #334155;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 10px;background:#1e293b;font-size:10px;color:#94a3b8;font-family:monospace;font-weight:600;">
          <span>${h}</span>
        </div>
        <pre style="padding:8px 10px;overflow-x:auto;font-size:11px;font-family:monospace;margin:0;line-height:1.4;"><code>${s.trim()}</code></pre>
      </div>
    `),
        `<!--BLOCK_${c}-->`
      );
    })),
      (i = i.replace(
        /`([^`]+)`/g,
        '<code style="background:#f1f5f9;color:#6d28d9;padding:2px 5px;border-radius:4px;font-size:11px;font-family:monospace;">$1</code>'
      )),
      (i = i.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>")),
      (i = i.replace(/\*([^\*]+)\*/g, "<em>$1</em>")));
    let r = /((?:\|[^\n]+\|\r?\n)+)/g;
    return (
      e
        ? (i = i.replace(r, ""))
        : (i = i.replace(r, (o) => {
            let a = o
              .trim()
              .split(/\r?\n/)
              .filter((l) => l.includes("|"));
            if (a.length < 2) return o;
            let s = '<div class="omni-table-wrapper"><table class="omni-table">',
              c = !0;
            for (let l = 0; l < a.length; l++) {
              let f = a[l].trim();
              if (/^[|\s:-]+$/.test(f)) {
                c = !1;
                continue;
              }
              let m = f
                .split("|")
                .slice(1, -1)
                .map((C) => C.trim());
              s += "<tr>";
              for (let C of m) c ? (s += `<th>${C}</th>`) : (s += `<td>${C}</td>`);
              s += "</tr>";
            }
            s += "</table></div>";
            let h = t.length;
            return (t.push(s), `<!--BLOCK_${h}-->`);
          })),
      (i = i.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (o, a, s) => {
        let c = s.trim();
        c.startsWith("/api/ai-report/download/") && (c = `${n}${c}`);
        let h = c.toLowerCase();
        if (
          h.startsWith("javascript:") ||
          h.startsWith("data:") ||
          h.startsWith("vbscript:") ||
          h.startsWith("file:")
        )
          return `<span>${a}</span>`;
        let l = c.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        return c.endsWith(".xlsx") || c.includes("/api/ai-report/download/")
          ? `<a class="omni-download-btn" href="${l}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        ${a}
      </a>`
          : `<a href="${l}" target="_blank" rel="noopener noreferrer" style="color:#7c3aed;text-decoration:underline;font-weight:500;">${a}</a>`;
      })),
      (i = i.replace(
        /\n\s*-\s+(.*)/g,
        '<li style="margin-left:16px;list-style-type:disc;">$1</li>'
      )),
      (i = i.replace(
        /\n\s*---\s*\n/g,
        '<hr style="margin:8px 0;border:0;border-top:1px solid #e2e8f0;" />'
      )),
      (i = i.replace(/\n/g, "<br/>")),
      t.forEach((o, a) => {
        i = i.replace(`<!--BLOCK_${a}-->`, o);
      }),
      i
    );
  }
  var P = class {
    constructor(n, e, i) {
      u(this, "config");
      u(this, "messages", []);
      u(this, "attachments", []);
      u(this, "onUpdate");
      u(this, "activeTimers", new Map());
      u(this, "onTimerTick");
      u(this, "RETENTION_MS", 1440 * 60 * 1e3);
      ((this.config = n), (this.onUpdate = e), (this.onTimerTick = i), this.loadHistory());
    }
    getStorageKey() {
      return `omni_widget_chat_${this.config.appId || "default"}`;
    }
    isWithinRetention(n, e) {
      let i = n.timestamp ? new Date(n.timestamp).getTime() : null;
      return !!(i && !isNaN(i) && e - i <= this.RETENTION_MS);
    }
    loadHistory() {
      try {
        if (typeof window > "u" || !window.localStorage) return;
        this.cleanupExpiredHistory();
        let n = localStorage.getItem(this.getStorageKey());
        if (n) {
          let e = JSON.parse(n),
            i = Date.now(),
            t = e.filter((r) => this.isWithinRetention(r, i));
          if (t.length > 0) {
            this.messages = t.map((r) => ({
              ...r,
              timestamp: new Date(r.timestamp),
              isStreaming: !1,
              streamingStatus: void 0,
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
            "Xin ch\xE0o! T\xF4i l\xE0 Tr\u1EE3 l\xFD AI c\u1EE7a h\u1EC7 th\u1ED1ng. T\xF4i c\xF3 th\u1EC3 h\u1ED7 tr\u1EE3 b\u1EA1n tra c\u1EE9u, t\u1ED5ng h\u1EE3p d\u1EEF li\u1EC7u v\xE0 th\u1EF1c hi\u1EC7n c\xE1c nghi\u1EC7p v\u1EE5 nhanh ch\xF3ng.",
          timestamp: new Date(),
        },
      ];
    }
    saveHistory() {
      try {
        if (typeof window > "u" || !window.localStorage) return;
        let n = Date.now(),
          e = this.messages
            .filter((i) => i.id !== "welcome")
            .filter((i) => this.isWithinRetention(i, n))
            .slice(-50)
            .map((i) => {
              let { isStreaming: t, streamingStatus: r, ...o } = i;
              return o;
            });
        e.length === 0
          ? localStorage.removeItem(this.getStorageKey())
          : localStorage.setItem(this.getStorageKey(), JSON.stringify(e));
      } catch {}
    }
    cleanupExpiredHistory() {
      try {
        if (typeof window > "u" || !window.localStorage) return;
        let n = Date.now(),
          e = [],
          i = Object.keys(localStorage).filter((t) => t.startsWith("omni_widget_chat_"));
        for (let t of i) {
          let r = localStorage.getItem(t);
          if (r)
            try {
              let o = JSON.parse(r);
              if (Array.isArray(o)) {
                let a = o.filter((s) => this.isWithinRetention(s, n));
                a.length === 0
                  ? e.push(t)
                  : a.length !== o.length && localStorage.setItem(t, JSON.stringify(a));
              }
            } catch {}
        }
        for (let t of e) localStorage.removeItem(t);
      } catch {}
    }
    startTimer(n, e) {
      this.stopTimer(n.id);
      let i = setInterval(() => {
        n.isStreaming
          ? ((n.elapsedSeconds = Number(((Date.now() - e) / 1e3).toFixed(1))),
            this.onTimerTick ? this.onTimerTick(n) : this.onUpdate())
          : this.stopTimer(n.id);
      }, 100);
      this.activeTimers.set(n.id, i);
    }
    stopTimer(n) {
      let e = this.activeTimers.get(n);
      e && (clearInterval(e), this.activeTimers.delete(n));
    }
    stopAllTimers() {
      for (let n of this.activeTimers.values()) clearInterval(n);
      this.activeTimers.clear();
    }
    getMessages() {
      return this.messages;
    }
    getAttachments() {
      return this.attachments;
    }
    addAttachment(n) {
      (this.attachments.push(n), this.onUpdate());
    }
    removeAttachment(n) {
      (this.attachments.splice(n, 1), this.onUpdate());
    }
    clearMessages() {
      (this.stopAllTimers(), (this.messages = []), (this.attachments = []));
      try {
        typeof window < "u" && window.localStorage && localStorage.removeItem(this.getStorageKey());
      } catch {}
      (this.messages.push({
        id: "welcome",
        sender: "bot",
        text:
          this.config.welcomeMessage ||
          "\u0110\xE3 l\xE0m m\u1EDBi cu\u1ED9c h\u1ED9i tho\u1EA1i. T\xF4i c\xF3 th\u1EC3 h\u1ED7 tr\u1EE3 g\xEC cho b\u1EA1n?",
        timestamp: new Date(),
      }),
        this.onUpdate());
    }
    addMessage(n, e, i = {}) {
      let t = { id: `${n}_${Date.now()}`, sender: n, text: e, timestamp: new Date(), ...i };
      return (this.messages.push(t), this.saveHistory(), this.onUpdate(), t);
    }
    async resolveToken() {
      return this.config.authToken
        ? typeof this.config.authToken == "function"
          ? (await this.config.authToken()) || ""
          : this.config.authToken
        : "";
    }
    async sendMessage(n) {
      if (!n.trim() && this.attachments.length === 0) return;
      let e = [...this.attachments];
      this.attachments = [];
      let i = {
        id: "usr_" + Date.now(),
        sender: "user",
        text: n.trim(),
        timestamp: new Date(),
        attachments: e,
      };
      this.messages.push(i);
      let t = Date.now(),
        r = {
          id: "bot_" + Date.now(),
          sender: "bot",
          text: "",
          timestamp: new Date(),
          isStreaming: !0,
          streamingStatus: "\u0110ang suy ngh\u0129...",
          elapsedSeconds: 0,
          showSteps: !0,
        };
      (this.messages.push(r), this.startTimer(r, t), this.onUpdate());
      try {
        let o = await this.resolveToken(),
          a = {};
        if (this.config.getContext)
          try {
            a = await this.config.getContext();
          } catch (k) {
            console.warn("[OmniChat] Failed to get context:", k);
          }
        e.length > 0 && (a.attachments = e);
        let s = this.config.microsoftClientKey || this.config.appId || "",
          h = `${(this.config.orchestratorUrl || (typeof window < "u" && window.__OMNI_ORCHESTRATOR_URL__) || "http://localhost:20128").replace(/\/$/, "")}/api/orchestrator/chat-stream`,
          l = { "Content-Type": "application/json", "x-microsoft-client-key": s };
        (this.config.apiKey && (l["x-api-key"] = this.config.apiKey),
          a &&
            a.applicationId &&
            a.applicationId !== s &&
            (l["X-Application-Id"] = a.applicationId),
          o && (l.Authorization = `Bearer ${o}`));
        let f = await fetch(h, {
          method: "POST",
          headers: l,
          body: JSON.stringify({
            instruction: n.trim(),
            microsoftClientKey: s,
            applicationId: (a && a.applicationId) || void 0,
            context: a,
            autoExecute: !0,
          }),
        });
        if (!f.ok || !f.body) throw new Error(`HTTP ${f.status}: ${f.statusText}`);
        let m = f.body.getReader(),
          C = new TextDecoder("utf-8"),
          T = "",
          M = "message";
        for (;;) {
          let { done: k, value: p } = await m.read();
          if (k) break;
          T += C.decode(p, { stream: !0 });
          let d = T.split(`
`);
          T = d.pop() || "";
          for (let w of d) {
            let x = w.trim();
            if (!x) {
              M = "message";
              continue;
            }
            if (x.startsWith("event:")) M = x.slice(6).trim();
            else if (x.startsWith("data:")) {
              let b = x.slice(5).trim();
              if (!b || b === "[DONE]") continue;
              try {
                let v = JSON.parse(b);
                this.handleStreamEvent(r, M, v);
              } catch (v) {
                console.warn("[OmniChat] SSE Parse Error:", v);
              }
            }
          }
        }
        (this.stopTimer(r.id),
          (r.elapsedSeconds = Number(((Date.now() - t) / 1e3).toFixed(1))),
          (r.isStreaming = !1),
          (r.streamingStatus = void 0),
          this.saveHistory(),
          this.onUpdate());
      } catch (o) {
        (this.stopTimer(r.id),
          (r.elapsedSeconds = Number(((Date.now() - t) / 1e3).toFixed(1))),
          (r.isStreaming = !1),
          (r.streamingStatus = void 0),
          (r.text = `\u26A0\uFE0F Kh\xF4ng th\u1EC3 ho\xE0n th\xE0nh y\xEAu c\u1EA7u: ${o.message || "L\u1ED7i k\u1EBFt n\u1ED1i t\u1EDBi AI Hub"}`),
          this.saveHistory(),
          this.onUpdate());
      }
    }
    handleStreamEvent(n, e, i) {
      if (e === "status") ((n.streamingStatus = i.message || i.status), this.onUpdate());
      else if (e === "text_delta")
        (i.accumulated ? (n.text = i.accumulated) : i.delta && (n.text += i.delta),
          this.onUpdate());
      else if (e === "content" || e === "token")
        ((n.text += i.content || i.token || ""), this.onUpdate());
      else if (e === "plan_created" || e === "plan") {
        n.plan = i;
        let t = i.steps || i.data?.steps || [];
        ((n.liveSteps = t.map((r, o) => ({
          stepIndex: r.stepIndex !== void 0 ? Number(r.stepIndex) : o,
          name: r.name || `B\u01B0\u1EDBc ${o + 1}`,
          action: r.action,
          status: "pending",
        }))),
          this.onUpdate());
      } else if (e === "step_start") {
        n.liveSteps || (n.liveSteps = []);
        let t = i.data || i,
          r = Number(t.stepIndex),
          o = n.liveSteps.find((a) => a.stepIndex === r || a.name === t.name);
        (o
          ? ((o.status = "running"), t.action && (o.action = t.action))
          : n.liveSteps.push({
              stepIndex: isNaN(r) ? n.liveSteps.length : r,
              name: t.name || "\u0110ang th\u1EF1c thi",
              action: t.action,
              status: "running",
            }),
          (n.streamingStatus = t.name || n.streamingStatus),
          this.onUpdate());
      } else if (e === "confirmation_required" || e === "need_input")
        ((n.plan = i),
          i.botMessage && !n.text && (n.text = i.botMessage),
          n.plan && this.config.onAction && this.config.onAction(n.plan),
          this.onUpdate());
      else if (e === "step_done" || e === "result" || e === "synthesized") {
        if (n.liveSteps) {
          let r = i.data || i,
            o = Number(r.stepIndex),
            a = n.liveSteps.find(
              (s) => s.stepIndex === o || (!isNaN(o) && n.liveSteps.indexOf(s) === o)
            );
          a &&
            ((a.status = r.status === "ERROR" || i.error ? "error" : "success"),
            r.error && (a.detail = r.error));
        }
        let t = i.result || i.synthesizedData || i;
        (t &&
          t.isHeavyQuery &&
          (n.heavyQuery = {
            isHeavy: !0,
            estimatedRows: t.estimatedRows,
            sql: t.sql,
            applicationId: t.applicationId,
            summary: t.summary,
          }),
          t &&
            t.columns &&
            t.previewData &&
            ((n.reportTable = {
              columns: t.columns,
              data: t.previewData,
              rowCount: t.rowCount,
              executionTimeMs: t.executionTimeMs,
              downloadUrl: t.downloadUrl,
              downloadFileName: t.downloadFileName,
              chartSpec: t.chartSpec,
            }),
            t.chartSpec && t.chartSpec.chartType && t.chartSpec.chartType !== "none"
              ? (n.activeView = "chart")
              : (n.activeView = "table")),
          i.error &&
            !n.text &&
            (n.text = `\u26A0\uFE0F L\u1ED7i th\u1EF1c thi b\u01B0\u1EDBc: ${i.error}`),
          this.onUpdate());
      } else if (e === "report_result") {
        let t = i.data || i;
        (t &&
          t.columns &&
          t.previewData &&
          ((n.reportTable = {
            columns: t.columns,
            data: t.previewData,
            rowCount: t.rowCount,
            executionTimeMs: t.executionTimeMs,
            downloadUrl: t.downloadUrl,
            downloadFileName: t.downloadFileName,
            chartSpec: t.chartSpec,
          }),
          t.chartSpec && t.chartSpec.chartType && t.chartSpec.chartType !== "none"
            ? (n.activeView = "chart")
            : (n.activeView = "table")),
          this.onUpdate());
      } else if (e === "done") {
        (this.stopTimer(n.id),
          (n.isStreaming = !1),
          (n.streamingStatus = void 0),
          (n.elapsedSeconds = Number(((Date.now() - n.timestamp.getTime()) / 1e3).toFixed(1))));
        let t = i.synthesizedData || i.result;
        (t &&
          t.isHeavyQuery &&
          (n.heavyQuery = {
            isHeavy: !0,
            estimatedRows: t.estimatedRows,
            sql: t.sql,
            applicationId: t.applicationId,
            summary: t.summary,
          }),
          t &&
            t.columns &&
            t.previewData &&
            !n.reportTable &&
            ((n.reportTable = {
              columns: t.columns,
              data: t.previewData,
              rowCount: t.rowCount,
              executionTimeMs: t.executionTimeMs,
              downloadUrl: t.downloadUrl,
              downloadFileName: t.downloadFileName,
              chartSpec: t.chartSpec,
            }),
            t.chartSpec && t.chartSpec.chartType && t.chartSpec.chartType !== "none"
              ? (n.activeView = "chart")
              : (n.activeView = "table")),
          i.botMessage && !n.text && (n.text = i.botMessage),
          this.saveHistory(),
          this.onUpdate());
      } else
        e === "error" &&
          (this.stopTimer(n.id),
          (n.isStreaming = !1),
          (n.streamingStatus = void 0),
          (n.elapsedSeconds = Number(((Date.now() - n.timestamp.getTime()) / 1e3).toFixed(1))),
          (n.text =
            (n.text
              ? n.text +
                `

`
              : "") + `\u26A0\uFE0F ${i.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}`),
          this.saveHistory(),
          this.onUpdate());
    }
    async triggerBackgroundJob(n) {
      let e = this.messages.find((o) => o.id === n);
      if (!e || !e.heavyQuery) return;
      let i = await this.resolveToken(),
        t = {
          "Content-Type": "application/json",
          "X-Internal-Key": "dr_internal_sec_89f1a23c04b7",
        };
      i && (t.Authorization = i.startsWith("Bearer ") ? i : `Bearer ${i}`);
      let r =
        this.config.reportApiUrl ||
        (typeof window < "u" && window.__DYNAMIC_REPORT_API_URL__) ||
        "http://localhost:5001";
      try {
        let a = await (
          await fetch(`${r.replace(/\/$/, "")}/api/ai-report/create-background-job`, {
            method: "POST",
            headers: t,
            body: JSON.stringify({
              applicationId: e.heavyQuery.applicationId || this.config.appId,
              sql: e.heavyQuery.sql,
              reportName: e.heavyQuery.summary || "B\xE1o c\xE1o AI xu\u1EA5t n\u1EC1n",
            }),
          })
        ).json();
        a.success
          ? ((e.heavyQuery.status = "created"),
            (e.heavyQuery.jobId = a.jobId),
            (e.heavyQuery.hangfireJobId = a.hangfireJobId),
            this.addMessage(
              "bot",
              `\u2705 **\u0110\xE3 chuy\u1EC3n sang quy tr\xECnh xu\u1EA5t b\xE1o c\xE1o n\u1EC1n (Hangfire):**
- **M\xE3 Job:** \`${a.jobId}\`
- **M\xE3 b\xE1o c\xE1o:** \`${a.reportCode}\`
- **Tr\u1EA1ng th\xE1i:** \u0110ang x\u1EED l\xFD ng\u1EA7m trong h\xE0ng \u0111\u1EE3i \`reports\`.

Sau khi x\u1EED l\xFD xong, h\u1EC7 th\u1ED1ng s\u1EBD l\u01B0u file b\xE1o c\xE1o v\xE0o danh s\xE1ch b\xE1o c\xE1o \u0111\xE3 ho\xE0n th\xE0nh.`
            ))
          : this.addMessage(
              "bot",
              `\u26A0\uFE0F Kh\xF4ng th\u1EC3 t\u1EA1o Job n\u1EC1n: ${a.message || "L\u1ED7i kh\xF4ng x\xE1c \u0111\u1ECBnh"}`
            );
      } catch (o) {
        this.addMessage(
          "bot",
          `\u26A0\uFE0F L\u1ED7i k\u1EBFt n\u1ED1i khi t\u1EA1o Job n\u1EC1n: ${o.message || String(o)}`
        );
      }
      this.onUpdate();
    }
    async confirmPlan(n, e = {}) {
      let i = await this.resolveToken(),
        t = this.config.microsoftClientKey || this.config.appId || "",
        o = `${(this.config.orchestratorUrl || (typeof window < "u" && window.__OMNI_ORCHESTRATOR_URL__) || "http://localhost:20128").replace(/\/$/, "")}/api/orchestrator/confirm`,
        a = {};
      if (this.config.getContext)
        try {
          a = await this.config.getContext();
        } catch (c) {
          console.warn("[OmniChat] Failed to get context for confirm:", c);
        }
      let s = {
        "Content-Type": "application/json",
        "x-microsoft-client-key": t,
        "X-Application-Id": (a && a.applicationId) || t,
      };
      (this.config.apiKey && (s["x-api-key"] = this.config.apiKey),
        i && (s.Authorization = `Bearer ${i}`));
      try {
        let h = await (
          await fetch(o, {
            method: "POST",
            headers: s,
            body: JSON.stringify({
              planId: n,
              userSuppliedInputs: e,
              microsoftClientKey: t,
              applicationId: a && a.applicationId,
            }),
          })
        ).json();
        if (h.Code === 200) {
          let l = h.Data,
            f =
              l?.botMessage ||
              l?.result?.summary ||
              "\u2705 \u0110\xE3 th\u1EF1c thi k\u1EBF ho\u1EA1ch th\xE0nh c\xF4ng.",
            m = this.addMessage("bot", f);
          l?.result?.columns &&
            l?.result?.previewData &&
            ((m.reportTable = {
              columns: l.result.columns,
              data: l.result.previewData,
              rowCount: l.result.rowCount,
              executionTimeMs: l.result.executionTimeMs,
              downloadUrl: l.result.downloadUrl,
              downloadFileName: l.result.downloadFileName,
              chartSpec: l.result.chartSpec,
            }),
            l.result.chartSpec &&
            l.result.chartSpec.chartType &&
            l.result.chartSpec.chartType !== "none"
              ? (m.activeView = "chart")
              : (m.activeView = "table"),
            this.onUpdate());
        } else
          this.addMessage(
            "bot",
            `\u26A0\uFE0F L\u1ED7i x\xE1c nh\u1EADn k\u1EBF ho\u1EA1ch: ${h.Message || "Th\u1EA5t b\u1EA1i"}`
          );
        return h;
      } catch (c) {
        throw (
          this.addMessage(
            "bot",
            `\u26A0\uFE0F L\u1ED7i k\u1EBFt n\u1ED1i khi x\xE1c nh\u1EADn k\u1EBF ho\u1EA1ch: ${c.message || String(c)}`
          ),
          c
        );
      }
    }
  };
  var U =
    "data:image/png;base64,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";
  var y = class y extends HTMLElement {
    constructor() {
      super();
      u(this, "config");
      u(this, "shadow");
      u(this, "chatCore");
      u(this, "isOpen", !1);
      u(this, "isExpanded", !1);
      u(this, "chartInstances", new Map());
      this.shadow = this.attachShadow({ mode: "open" });
    }
    init(e) {
      ((this.config = {
        appTitle: "AI Assistant",
        appSubtitle: "H\u1ED7 tr\u1EE3 nghi\u1EC7p v\u1EE5 & B\xE1o c\xE1o d\u1EEF li\u1EC7u",
        themeColor: "#7c3aed",
        position: "bottom-right",
        ...e,
      }),
        (this.chatCore = new P(
          this.config,
          () => this.render(),
          (t) => this.updateTimerUI(t)
        )),
        this.render());
      let i = e.microsoftClientKey || e.appId;
      if (i) {
        let t = (
          e.orchestratorUrl ||
          (typeof window < "u" && window.__OMNI_ORCHESTRATOR_URL__) ||
          "http://localhost:20128"
        ).replace(/\/$/, "");
        fetch(`${t}/api/orchestrator/apps?microsoftClientKey=${encodeURIComponent(i)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((r) => {
            if (r?.Data) {
              let o = r.Data;
              if ((o.name && (this.config.appTitle = o.name), o.welcomeMessage && this.chatCore)) {
                let a = this.chatCore.getMessages();
                a.length === 1 && a[0].id === "welcome" && (a[0].text = o.welcomeMessage);
              }
              (Array.isArray(o.quickSuggestions) &&
                o.quickSuggestions.length > 0 &&
                (this.config.quickSuggestions = o.quickSuggestions),
                this.render());
            }
          })
          .catch(() => {});
      }
    }
    toggleOpen() {
      ((this.isOpen = !this.isOpen),
        this.render(),
        this.isOpen &&
          setTimeout(() => {
            (this.shadow.querySelector(".omni-textarea")?.focus(), this.scrollToBottom());
          }, 100));
    }
    toggleExpand() {
      ((this.isExpanded = !this.isExpanded), this.render());
    }
    scrollToBottom() {
      let e = this.shadow.querySelector(".omni-messages");
      e && (e.scrollTop = e.scrollHeight);
    }
    getResolvedLogo() {
      let e = this.config?.logoUrl;
      if (e)
        return e === "logo_an.png" || e === "/logo_an.png" || e.includes("logo_an")
          ? U
          : e.startsWith("http://") ||
              e.startsWith("https://") ||
              e.startsWith("data:") ||
              e.startsWith("/")
            ? e
            : `/${e}`;
      let i = (this.config?.appTitle || "").toLowerCase(),
        t = (this.config?.appSubtitle || "").toLowerCase();
      return i.includes("anpos") || t.includes("anpos") || i.includes("an") || t.includes("an")
        ? U
        : null;
    }
    render() {
      let e = this.chatCore ? this.chatCore.getMessages() : [],
        i = this.chatCore ? this.chatCore.getAttachments() : [],
        t = this.config?.reportApiUrl || "",
        r = this.getResolvedLogo();
      ((this.shadow.innerHTML = `
      <style>${R}</style>
      <div class="omni-widget ${this.config?.position || "bottom-right"}">
        <!-- Floating Launcher Button -->
        <button class="omni-launcher ${this.isOpen ? "open" : ""}" title="M\u1EDF tr\u1EE3 l\xFD AI">
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
                  r
                    ? `
                  <img src="${r}" class="omni-avatar-img" alt="Logo" />
                `
                    : `
                  <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.72V7h2a7 7 0 0 1 7 7v1a2 2 0 0 1-2 2h-1v1a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-1H5a2 2 0 0 1-2-2v-1a7 7 0 0 1 7-7h2V5.72c-.6-.34-1-.98-1-1.72a2 2 0 0 1 2-2z"/></svg>
                `
                }
                <span class="omni-status-dot"></span>
              </div>
              <div class="omni-title-group">
                <div class="omni-title">${this.config?.appTitle || "AI Assistant"}</div>
                <div class="omni-subtitle">${this.config?.appSubtitle || "H\u1ED7 tr\u1EE3 nghi\u1EC7p v\u1EE5 & B\xE1o c\xE1o"}</div>
              </div>
            </div>
            <div class="omni-header-actions">
              <button class="omni-icon-btn btn-expand" title="${this.isExpanded ? "Thu nh\u1ECF" : "M\u1EDF r\u1ED9ng"}">
                <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              </button>
              <button class="omni-icon-btn btn-clear" title="L\xE0m m\u1EDBi cu\u1ED9c tr\xF2 chuy\u1EC7n">
                <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
              <button class="omni-icon-btn btn-close" title="\u0110\xF3ng">
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          </div>

          <!-- Messages Area -->
          <div class="omni-messages">
            ${e.map((o) => this.renderMessage(o, t, r)).join("")}
          </div>

          <!-- Input Area -->
          <div class="omni-input-container">
            ${
              this.config?.quickSuggestions && this.config.quickSuggestions.length > 0
                ? `
              <div class="omni-suggestions">
                ${this.config.quickSuggestions.map((o) => `<button class="omni-suggestion-chip" data-suggestion="${this.escapeHtml(o)}">${this.escapeHtml(o)}</button>`).join("")}
              </div>
            `
                : ""
            }

            ${
              i.length > 0
                ? `
              <div class="omni-attachments-preview">
                ${i
                  .map(
                    (o, a) => `
                  <div class="omni-attachment-chip">
                    <span>\u{1F4CE} ${this.escapeHtml(o.name)}</span>
                    <button data-remove-att="${a}">\u2715</button>
                  </div>
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }

            <div class="omni-input-row">
              <button class="omni-attach-btn" title="\u0110\xEDnh k\xE8m t\u1EC7p">
                <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6H9v9.5a3 3 0 0 0 6 0V5a4 4 0 0 0-8 0v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
              </button>
              <textarea class="omni-textarea" placeholder="H\u1ECFi AI v\u1EC1 doanh thu, h\xF3a \u0111\u01A1n ho\u1EB7c y\xEAu c\u1EA7u b\xE1o c\xE1o..." rows="1"></textarea>
              <button class="omni-send-btn" title="G\u1EEDi c\xE2u h\u1ECFi">
                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `),
        this.bindEvents(),
        this.scrollToBottom(),
        this.initActiveCharts());
    }
    ensureChartJsLoaded() {
      return window.Chart
        ? Promise.resolve(window.Chart)
        : (y.chartJsPromise ||
            (y.chartJsPromise = new Promise((e, i) => {
              let t = document.createElement("script");
              ((t.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"),
                (t.async = !0),
                (t.onload = () => e(window.Chart)),
                (t.onerror = () => {
                  let r = document.createElement("script"),
                    o = this.config.orchestratorUrl || "http://localhost:20128";
                  ((r.src = `${o.replace(/\/$/, "")}/chart.umd.min.js`),
                    (r.onload = () => e(window.Chart)),
                    (r.onerror = (a) => {
                      ((y.chartJsPromise = null), i(a));
                    }),
                    document.head.appendChild(r));
                }),
                document.head.appendChild(t));
            })),
          y.chartJsPromise);
    }
    initActiveCharts() {
      let e = this.chatCore ? this.chatCore.getMessages() : [];
      for (let i of e)
        i.reportTable?.chartSpec &&
          i.reportTable.chartSpec.chartType &&
          i.reportTable.chartSpec.chartType !== "none" &&
          i.activeView !== "table" &&
          this.initChart(i);
    }
    async initChart(e) {
      if (!e.reportTable?.chartSpec || !e.reportTable.data?.length) return;
      let i = this.shadow.querySelector(`#chart-canvas-${e.id}`);
      if (i) {
        if (this.chartInstances.has(e.id)) {
          try {
            this.chartInstances.get(e.id)?.destroy();
          } catch {}
          this.chartInstances.delete(e.id);
        }
        try {
          let t = await this.ensureChartJsLoaded(),
            r = e.reportTable.chartSpec,
            o = (r.chartType || "column").toLowerCase(),
            a = "bar";
          o === "pie"
            ? (a = "pie")
            : o === "doughnut"
              ? (a = "doughnut")
              : o === "line"
                ? (a = "line")
                : (o === "bar" || o === "column") && (a = "bar");
          let s = r.categoryColumn || e.reportTable.columns[0],
            c =
              r.valueColumns && r.valueColumns.length > 0
                ? r.valueColumns
                : e.reportTable.columns.filter((p) => p !== s),
            h = e.reportTable.data.map((p) => String(p[s] ?? "")),
            l = [
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
            ],
            f = c.map((p, d) => {
              let w = e.reportTable.data.map((b) => {
                  let v = b[p];
                  return typeof v == "number" ? v : parseFloat(String(v).replace(/,/g, "")) || 0;
                }),
                x = a === "pie" || a === "doughnut";
              return {
                label: p,
                data: w,
                backgroundColor: x ? l : l[d % l.length],
                borderColor: x ? "#ffffff" : l[d % l.length],
                borderWidth: x ? 2 : 1,
                borderRadius: a === "bar" ? 4 : 0,
              };
            }),
            m = a === "pie" || a === "doughnut",
            C = f[0],
            T = (C?.data || []).reduce((p, d) => p + (Number(d) || 0), 0),
            M = {
              id: "customDataLabelsPlugin",
              afterDatasetsDraw(p) {
                let { ctx: d } = p;
                p.data.datasets.forEach((w, x) => {
                  let b = p.getDatasetMeta(x);
                  if (!b || b.hidden) return;
                  let v = w.data.reduce((S, L) => S + (Number(L) || 0), 0);
                  b.data.forEach((S, L) => {
                    let H = Number(w.data[L]) || 0;
                    if (!(H <= 0)) {
                      if ((d.save(), p.config.type === "pie" || p.config.type === "doughnut")) {
                        let I = v > 0 ? ((H / v) * 100).toFixed(1) : "0";
                        if (Number(I) >= 3) {
                          let E = S.tooltipPosition();
                          ((d.font = "bold 11px system-ui, -apple-system, sans-serif"),
                            (d.textAlign = "center"),
                            (d.textBaseline = "middle"),
                            (d.fillStyle = "#ffffff"),
                            (d.shadowColor = "rgba(0, 0, 0, 0.7)"),
                            (d.shadowBlur = 4),
                            d.fillText(`${I}%`, E.x, E.y));
                        }
                      } else if (p.config.type === "bar") {
                        let I = p.options.indexAxis === "y";
                        ((d.font = "bold 10px system-ui, -apple-system, sans-serif"),
                          (d.fillStyle = "#475569"));
                        let E = H.toLocaleString("vi-VN");
                        I
                          ? ((d.textAlign = "left"),
                            (d.textBaseline = "middle"),
                            d.fillText(E, S.x + 6, S.y))
                          : ((d.textAlign = "center"),
                            (d.textBaseline = "bottom"),
                            d.fillText(E, S.x, S.y - 4));
                      }
                      d.restore();
                    }
                  });
                });
              },
            },
            k = new t(i, {
              type: a,
              data: { labels: h, datasets: f },
              plugins: [M],
              options: {
                responsive: !0,
                maintainAspectRatio: !1,
                plugins: {
                  legend: {
                    display: m || f.length > 1,
                    position: "bottom",
                    labels: {
                      boxWidth: 10,
                      font: { size: 10.5 },
                      padding: 10,
                      generateLabels: (p) => {
                        let d = t.defaults.plugins.legend.labels.generateLabels(p);
                        return m
                          ? d.map((w, x) => {
                              let b = Number(C?.data?.[x]) || 0,
                                v = T > 0 ? ((b / T) * 100).toFixed(1) : "0",
                                S = b.toLocaleString("vi-VN");
                              return { ...w, text: `${h[x]}: ${S} (${v}%)` };
                            })
                          : d;
                      },
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: (p) => {
                        let d = Number(p.raw) || 0,
                          w = d.toLocaleString("vi-VN");
                        if (m) {
                          let x = T > 0 ? ((d / T) * 100).toFixed(1) : "0";
                          return ` ${p.label}: ${w} (${x}%)`;
                        }
                        return ` ${p.dataset.label || ""}: ${w}`;
                      },
                    },
                  },
                },
                scales: m
                  ? {}
                  : {
                      x: { ticks: { font: { size: 10 } }, grid: { display: !1 } },
                      y: {
                        ticks: {
                          font: { size: 10 },
                          callback: (p) =>
                            typeof p == "number" && p >= 1e3 ? p.toLocaleString("vi-VN") : p,
                        },
                        grid: { color: "#f1f5f9" },
                      },
                    },
              },
            });
          this.chartInstances.set(e.id, k);
        } catch (t) {
          console.warn("[OmniChat] Could not render chart:", t);
        }
      }
    }
    downloadChartImage(e) {
      let i = this.shadow.querySelector(`#chart-canvas-${e}`);
      if (!i) return;
      let t = document.createElement("canvas");
      ((t.width = i.width), (t.height = i.height));
      let r = t.getContext("2d");
      r && ((r.fillStyle = "#ffffff"), r.fillRect(0, 0, t.width, t.height), r.drawImage(i, 0, 0));
      let c = (
          (this.chatCore ? this.chatCore.getMessages() : []).find((m) => m.id === e)?.reportTable
            ?.chartSpec?.title || "bieu_do"
        )
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, ""),
        h = new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        l = `${c || "bieu_do"}_${h}.png`,
        f = document.createElement("a");
      ((f.download = l), (f.href = t.toDataURL("image/png")), f.click());
    }
    updateTimerUI(e) {
      let i = this.shadow.querySelector(`.omni-timer-pill[data-timer-id="${e.id}"]`);
      i && e.elapsedSeconds !== void 0 && (i.textContent = `${e.elapsedSeconds.toFixed(1)}s`);
    }
    cleanBoilerplate(e) {
      return (
        e &&
        e
          .replace(
            /(?:Biểu đồ|Bảng số liệu|Hệ thống đã tự động dựng)[^.\n]*(?:bên dưới|được hiển thị)[^.\n]*(\.|$)/gi,
            ""
          )
          .replace(
            /Nếu bạn cần phân tích thêm[^.\n]*(?:cho mình biết nhé|hãy cho mình biết)[^.\n]*(\.|\!|$)/gi,
            ""
          )
          .replace(
            /\n\s*\n\s*\n/g,
            `

`
          )
          .trim()
      );
    }
    escapeHtml(e) {
      return e
        ? e
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
        : "";
    }
    renderMessage(e, i, t = null) {
      let r = e.sender === "user",
        o = !!e.reportTable,
        a = !!(
          e.reportTable?.chartSpec &&
          e.reportTable.chartSpec.chartType &&
          e.reportTable.chartSpec.chartType !== "none"
        ),
        s = e.activeView || (a ? "chart" : "table");
      return `
      <div class="omni-msg-row ${r ? "user" : "bot"}">
        <div class="omni-msg-wrap">
          ${
            r
              ? ""
              : `
            <div class="omni-bot-icon">
              ${
                t
                  ? `
                <img src="${t}" class="omni-bot-logo-img" alt="AI" />
              `
                  : `
                <svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
              `
              }
            </div>
          `
          }
          <div class="omni-msg-col">
            ${
              e.isStreaming
                ? `
              <div class="omni-streaming-banner">
                <span class="omni-spinner"></span>
                <span>${e.streamingStatus || "\u0110ang suy ngh\u0129..."}</span>
                ${e.elapsedSeconds !== void 0 ? `<span class="omni-timer-pill" data-timer-id="${e.id}">${e.elapsedSeconds.toFixed(1)}s</span>` : ""}
              </div>
            `
                : ""
            }

            ${
              e.text
                ? `
              <div class="${r ? "omni-bubble-user" : "omni-bubble-bot"}">
                ${r ? this.escapeHtml(e.text) : j(this.cleanBoilerplate(e.text), i, o)}
              </div>
            `
                : ""
            }

            ${
              e.attachments && e.attachments.length > 0
                ? `
              <div class="omni-attachments-preview">
                ${e.attachments.map((c) => `<span class="omni-attachment-chip">\u{1F4CE} ${this.escapeHtml(c.name)}</span>`).join("")}
              </div>
            `
                : ""
            }

            ${
              a
                ? `
              <div class="omni-chart-card">
                <div class="omni-chart-header">
                  <div class="omni-chart-title">
                    <svg viewBox="0 0 24 24"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>
                    <span>${e.reportTable?.chartSpec?.title || "Bi\u1EC3u \u0111\u1ED3 tr\u1EF1c quan"}</span>
                  </div>
                  <div class="omni-chart-toolbar">
                    <div class="omni-view-toggle">
                      <button class="omni-toggle-btn ${s === "chart" ? "active" : ""}" data-view="chart" data-msg-id="${e.id}">\u{1F4CA} Bi\u1EC3u \u0111\u1ED3</button>
                      <button class="omni-toggle-btn ${s === "table" ? "active" : ""}" data-view="table" data-msg-id="${e.id}">\u{1F4CB} B\u1EA3ng</button>
                    </div>
                    ${
                      s === "chart"
                        ? `
                      <button class="omni-chart-download-btn" data-download-chart="${e.id}" title="T\u1EA3i \u1EA3nh bi\u1EC3u \u0111\u1ED3 s\u1EAFc n\xE9t d\u1EA1ng PNG">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        <span>T\u1EA3i \u1EA3nh</span>
                      </button>
                    `
                        : e.reportTable?.downloadUrl
                          ? `
                      <a class="omni-download-btn" href="${e.reportTable.downloadUrl.startsWith("/") ? `${i}${e.reportTable.downloadUrl}` : e.reportTable.downloadUrl}" target="_blank" rel="noopener" style="margin:0;padding:3.5px 8px;font-size:10.5px;">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        <span>T\u1EA3i Excel</span>
                      </a>
                    `
                          : ""
                    }
                  </div>
                </div>
                <div class="omni-chart-body" style="${s === "chart" ? "" : "display:none;"}">
                  <canvas id="chart-canvas-${e.id}" style="max-height:240px;width:100%;"></canvas>
                </div>
                <div class="omni-table-view-body" style="${s === "table" ? "" : "display:none;"}">
                  ${this.renderReportTable(e.reportTable, i)}
                </div>
              </div>
            `
                : o
                  ? this.renderReportTable(e.reportTable, i)
                  : ""
            }

            ${
              !e.isStreaming && e.elapsedSeconds !== void 0
                ? `
              <div class="omni-msg-footer">
                <span>\u23F1\uFE0F Ph\u1EA3n h\u1ED3i: ${e.elapsedSeconds.toFixed(1)}s</span>
                ${e.reportTable?.executionTimeMs ? `<span>\u2022 \u26A1 SQL: ${e.reportTable.executionTimeMs}ms</span>` : ""}
              </div>
            `
                : ""
            }

            ${e.heavyQuery ? this.renderHeavyQueryCard(e) : ""}
            ${e.plan && e.plan.nextStepDetail && !e.isConfirmed ? this.renderActionCard(e) : ""}
          </div>
        </div>
      </div>
    `;
    }
    isColumnNumeric(e, i) {
      if (!i) return !1;
      let t = i.toLowerCase();
      if (
        t.includes("code") ||
        t.includes("id") ||
        t.includes("status") ||
        t.includes("ngay") ||
        t.includes("date")
      )
        return !1;
      if (
        t.includes("tien") ||
        t.includes("amount") ||
        t.includes("price") ||
        t.includes("gia") ||
        t.includes("doanhthu") ||
        t.includes("revenue") ||
        t.includes("total") ||
        t.includes("soluong") ||
        t.includes("quantity") ||
        t.includes("sl")
      )
        return !0;
      if (!e?.data || e.data.length === 0) return !1;
      let r = e.data[0]?.[i];
      return (
        typeof r == "number" ||
        (/^-?\d+(\.\d+)?$/.test(String(r ?? "").trim()) && String(r ?? "").trim().length > 0)
      );
    }
    formatCellValue(e, i = "") {
      if (e == null) return "";
      if (typeof e == "number") return y.VI_NUMBER_FORMAT.format(e);
      let t = String(e).trim();
      if (/^-?\d+(\.\d+)?$/.test(t) && t.length <= 18) {
        let r = i.toLowerCase();
        if (
          (r.includes("code") ||
            r.includes("id") ||
            r.includes("status") ||
            r === "stt" ||
            r === "nam" ||
            r === "thang") &&
          t.length <= 4
        )
          return t;
        let a = Number(t);
        if (!isNaN(a)) return y.VI_NUMBER_FORMAT.format(a);
      }
      return t;
    }
    renderReportTable(e, i) {
      if (!e || !e.columns || e.columns.length === 0) return "";
      let t = e.downloadUrl || "";
      t && t.startsWith("/api/ai-report/download/") && (t = `${i}${t}`);
      let r = new Set(e.columns.filter((o) => this.isColumnNumeric(e, o)));
      return `
      <div class="omni-table-wrapper">
        <div style="padding:6px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:600;font-size:11px;color:#334155;">\u{1F4CA} D\u1EEF li\u1EC7u b\xE1o c\xE1o (${e.rowCount || e.data.length} d\xF2ng)</span>
          ${
            t
              ? `
            <a class="omni-download-btn" href="${t}" target="_blank" rel="noopener" style="margin:0;padding:4px 8px;font-size:11px;">
              <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              T\u1EA3i Excel
            </a>
          `
              : ""
          }
        </div>
        <table class="omni-table">
          <thead>
            <tr>${e.columns.map((o) => `<th class="${r.has(o) ? "text-right" : ""}">${o}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${e.data
              .map(
                (o) => `
              <tr>${e.columns.map((a) => `<td class="${r.has(a) ? "text-right font-mono" : ""}">${this.formatCellValue(o[a], a)}</td>`).join("")}</tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
    }
    renderHeavyQueryCard(e) {
      return !e.heavyQuery || e.heavyQuery.status === "created"
        ? ""
        : `
      <div class="omni-heavy-card" style="margin-top:10px;padding:12px;background:#fefce8;border:1px solid #fde047;border-radius:8px;">
        <div style="font-weight:600;font-size:12px;color:#854d0e;display:flex;align-items:center;gap:6px;">
          <span>\u26A1</span>
          <span>Truy v\u1EA5n d\u1EEF li\u1EC7u l\u1EDBn (~${e.heavyQuery.estimatedRows ? Number(e.heavyQuery.estimatedRows).toLocaleString() : "l\u1EDBn"} d\xF2ng)</span>
        </div>
        <div style="font-size:11px;color:#713f12;margin-top:6px;line-height:1.4;">
          \u0110\u1EC3 b\u1EA3o v\u1EC7 k\u1EBFt n\u1ED1i v\xE0 tr\xE1nh \u0111\u01A1 giao di\u1EC7n, h\u1EC7 th\u1ED1ng \u0111\u1EC1 xu\u1EA5t \u0111\u01B0a t\xE1c v\u1EE5 n\xE0y v\xE0o h\xE0ng \u0111\u1EE3i n\u1EC1n Hangfire.
        </div>
        <div style="margin-top:8px;">
          <button class="omni-btn-bg-job" data-msg-id="${e.id}" style="background:#eab308;color:#0f172a;font-weight:600;font-size:11px;padding:6px 12px;border:none;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <span>\u{1F680}</span>
            <span>Chuy\u1EC3n sang xu\u1EA5t n\u1EC1n (Hangfire)</span>
          </button>
        </div>
      </div>
    `;
    }
    renderActionCard(e) {
      let i = e.plan?.nextStepDetail;
      if (!i) return "";
      let t = i.missing_required_fields || [];
      return `
      <div class="omni-action-card" data-plan-id="${e.plan?.planId}">
        <div class="omni-action-title">\u2699\uFE0F X\xE1c nh\u1EADn: ${i.name}</div>
        ${t
          .map(
            (r) => `
          <div class="omni-action-field">
            <label>${r}</label>
            <input type="text" data-field="${r}" placeholder="Nh\u1EADp ${r}..." />
          </div>
        `
          )
          .join("")}
        <div class="omni-action-buttons">
          <button class="omni-btn-cancel">H\u1EE7y</button>
          <button class="omni-btn-confirm" data-msg-id="${e.id}">X\xE1c nh\u1EADn th\u1EF1c hi\u1EC7n</button>
        </div>
      </div>
    `;
    }
    bindEvents() {
      (this.shadow
        .querySelector(".omni-launcher")
        ?.addEventListener("click", () => this.toggleOpen()),
        this.shadow.querySelector(".btn-close")?.addEventListener("click", () => this.toggleOpen()),
        this.shadow
          .querySelector(".btn-expand")
          ?.addEventListener("click", () => this.toggleExpand()),
        this.shadow
          .querySelector(".btn-clear")
          ?.addEventListener("click", () => this.chatCore.clearMessages()));
      let e = this.shadow.querySelector(".omni-file-input");
      (this.shadow.querySelector(".omni-attach-btn")?.addEventListener("click", () => e?.click()),
        e?.addEventListener("change", (o) => {
          let a = o.target;
          a.files &&
            (Array.from(a.files).forEach((s) => {
              let c = new FileReader();
              ((c.onload = () => {
                this.chatCore.addAttachment({
                  name: s.name,
                  size: s.size,
                  type: s.type,
                  base64: c.result,
                });
              }),
                c.readAsDataURL(s));
            }),
            (a.value = ""));
        }),
        this.shadow.querySelectorAll("[data-remove-att]").forEach((o) => {
          o.addEventListener("click", () => {
            let a = parseInt(o.getAttribute("data-remove-att") || "0", 10);
            this.chatCore.removeAttachment(a);
          });
        }));
      let i = this.shadow.querySelector(".omni-textarea"),
        t = this.shadow.querySelector(".omni-send-btn"),
        r = () => {
          let o = i?.value.trim() || "";
          (o || this.chatCore.getAttachments().length > 0) &&
            (this.chatCore.sendMessage(o), i && (i.value = ""));
        };
      (t?.addEventListener("click", r),
        i?.addEventListener("keydown", (o) => {
          o.key === "Enter" && !o.shiftKey && (o.preventDefault(), r());
        }),
        this.shadow.querySelectorAll(".omni-suggestion-chip").forEach((o) => {
          o.addEventListener("click", () => {
            let a = o.getAttribute("data-suggestion");
            a && this.chatCore.sendMessage(a);
          });
        }),
        this.shadow.querySelectorAll(".omni-btn-confirm").forEach((o) => {
          o.addEventListener("click", async () => {
            let a = o.closest(".omni-action-card"),
              s = a?.getAttribute("data-plan-id"),
              c = o.getAttribute("data-msg-id");
            if (!s) return;
            let h = {};
            a?.querySelectorAll("input[data-field]").forEach((f) => {
              let m = f.getAttribute("data-field");
              m && (h[m] = f.value.trim());
            });
            let l = this.chatCore.getMessages().find((f) => f.id === c);
            (l && (l.isConfirmed = !0),
              (o.disabled = !0),
              (o.textContent = "\u0110ang th\u1EF1c hi\u1EC7n..."),
              await this.chatCore.confirmPlan(s, h));
          });
        }),
        this.shadow.querySelectorAll(".omni-btn-cancel").forEach((o) => {
          o.addEventListener("click", () => {
            o.closest(".omni-action-card")?.remove();
          });
        }),
        this.shadow.querySelectorAll(".omni-btn-bg-job").forEach((o) => {
          o.addEventListener("click", () => {
            let a = o.getAttribute("data-msg-id");
            a &&
              ((o.disabled = !0),
              (o.textContent = "\u0110ang chuy\u1EC3n sang Hangfire..."),
              this.chatCore.triggerBackgroundJob(a));
          });
        }),
        this.shadow.querySelectorAll("[data-download-chart]").forEach((o) => {
          o.addEventListener("click", () => {
            let a = o.getAttribute("data-download-chart");
            a && this.downloadChartImage(a);
          });
        }),
        this.shadow.querySelectorAll(".omni-toggle-btn").forEach((o) => {
          o.addEventListener("click", () => {
            let a = o.getAttribute("data-msg-id"),
              s = o.getAttribute("data-view"),
              c = this.chatCore.getMessages().find((h) => h.id === a);
            c && s && ((c.activeView = s), this.render());
          });
        }));
    }
  };
  (u(y, "chartJsPromise", null), u(y, "VI_NUMBER_FORMAT", new Intl.NumberFormat("vi-VN")));
  var A = y;
  customElements.get("omni-chat-box") || customElements.define("omni-chat-box", A);
  var z = null,
    O = {
      init(g) {
        let n = document.querySelector("omni-chat-box");
        return (
          n || ((n = document.createElement("omni-chat-box")), document.body.appendChild(n)),
          n.init(g),
          (z = n),
          n
        );
      },
      open() {
        z && z.toggleOpen();
      },
      close() {
        z && z.toggleOpen();
      },
      toggle() {
        z && z.toggleOpen();
      },
    };
  window.OmniChat = O;
  if (typeof document < "u") {
    let g = document.currentScript || document.querySelector("script[data-app-id]");
    if (g) {
      let n = g.getAttribute("data-app-id");
      n &&
        O.init({
          appId: n,
          apiKey: g.getAttribute("data-api-key") || void 0,
          appTitle: g.getAttribute("data-app-title") || void 0,
          orchestratorUrl: g.getAttribute("data-orchestrator-url") || void 0,
          reportApiUrl: g.getAttribute("data-report-api-url") || void 0,
        });
    }
  }
})();
