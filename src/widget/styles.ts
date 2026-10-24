export const WIDGET_STYLES = `
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
