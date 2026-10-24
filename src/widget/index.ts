import { OmniChatConfig } from "./types";
import { OmniChatElement } from "./omni-chat-element";

// Register Custom Element
if (!customElements.get("omni-chat-box")) {
  customElements.define("omni-chat-box", OmniChatElement);
}

let activeInstance: OmniChatElement | null = null;

export const OmniChat = {
  init(config: OmniChatConfig): OmniChatElement {
    let el = document.querySelector<OmniChatElement>("omni-chat-box");
    if (!el) {
      el = document.createElement("omni-chat-box") as OmniChatElement;
      document.body.appendChild(el);
    }
    el.init(config);
    activeInstance = el;
    return el;
  },
  open() {
    if (activeInstance) activeInstance.toggleOpen();
  },
  close() {
    if (activeInstance) activeInstance.toggleOpen();
  },
  toggle() {
    if (activeInstance) activeInstance.toggleOpen();
  },
};

// Expose on window
(window as any).OmniChat = OmniChat;

// Auto-init via script tag data attributes
if (typeof document !== "undefined") {
  const currentScript = document.currentScript || document.querySelector("script[data-app-id]");
  if (currentScript) {
    const appId = currentScript.getAttribute("data-app-id");
    if (appId) {
      OmniChat.init({
        appId,
        apiKey: currentScript.getAttribute("data-api-key") || undefined,
        appTitle: currentScript.getAttribute("data-app-title") || undefined,
        orchestratorUrl: currentScript.getAttribute("data-orchestrator-url") || undefined,
        reportApiUrl: currentScript.getAttribute("data-report-api-url") || undefined,
      });
    }
  }
}
