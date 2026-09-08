/**
 * Lemon AI Autonomous Website Chatbot Widget
 * Embeddable script for Shopify, WordPress, Webflow, Wix, Next.js, and custom HTML.
 */
(function () {
  if (window.__LEMON_BOT_INITIALIZED__) return;
  window.__LEMON_BOT_INITIALIZED__ = true;

  const currentScript = document.currentScript || (function () {
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  const scriptSrc = currentScript?.src || "";
  let apiBaseUrl = window.LEMON_BOT_API_URL || "";
  if (!apiBaseUrl && scriptSrc) {
    try {
      const url = new URL(scriptSrc);
      apiBaseUrl = url.origin;
    } catch (_) {}
  }
  if (!apiBaseUrl) apiBaseUrl = window.location.origin;

  const userId = window.LEMON_BOT_USER_ID || "usr_lemon_demo";
  const theme = window.LEMON_BOT_THEME || "light";
  const brandName = window.LEMON_BOT_BRAND || "Support";

  const storageKey = `lemon_bot_${userId}_history`;
  const sessionKey = `lemon_bot_${userId}_session`;

  let sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = "sess_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem(sessionKey, sessionId);
  }

  // Load or initialize message history
  let messages = [];
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) messages = JSON.parse(saved);
  } catch (_) {}

  if (messages.length === 0) {
    messages.push({
      role: "bot",
      text: `Hello! 👋 How can I help you with ${brandName} today? Ask me anything about our services, pricing, or recommendations!`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  // Inject Styles
  const style = document.createElement("style");
  style.id = "lemon-bot-styles";
  style.textContent = `
    #lemon-bot-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #lemon-bot-bubble {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
    }
    #lemon-bot-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 28px rgba(37, 99, 235, 0.45);
    }
    #lemon-bot-window {
      position: absolute;
      bottom: 75px;
      right: 0;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 120px);
      background: ${theme === "dark" ? "#0f172a" : "#ffffff"};
      color: ${theme === "dark" ? "#f8fafc" : "#0f172a"};
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(16px) scale(0.96);
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #lemon-bot-window.open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    #lemon-bot-header {
      padding: 16px 18px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #lemon-bot-header h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #lemon-bot-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    #lemon-bot-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: ${theme === "dark" ? "#0b1329" : "#f8fafc"};
    }
    .lemon-msg {
      max-width: 82%;
      padding: 11px 15px;
      font-size: 13.5px;
      line-height: 1.45;
      border-radius: 16px;
      word-break: break-word;
    }
    .lemon-msg-bot {
      background: ${theme === "dark" ? "#1e293b" : "#ffffff"};
      color: ${theme === "dark" ? "#f1f5f9" : "#1e293b"};
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04);
    }
    .lemon-msg-user {
      background: #2563eb;
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .lemon-msg-time {
      font-size: 10px;
      opacity: 0.65;
      margin-top: 4px;
      text-align: right;
    }
    #lemon-bot-input-area {
      padding: 12px 14px;
      background: ${theme === "dark" ? "#0f172a" : "#ffffff"};
      border-top: 1px solid ${theme === "dark" ? "#1e293b" : "#e2e8f0"};
      display: flex;
      gap: 8px;
      align-items: center;
    }
    #lemon-bot-input {
      flex: 1;
      border: 1px solid ${theme === "dark" ? "#334155" : "#cbd5e1"};
      background: ${theme === "dark" ? "#1e293b" : "#ffffff"};
      color: ${theme === "dark" ? "#ffffff" : "#0f172a"};
      border-radius: 24px;
      padding: 10px 16px;
      font-size: 13.5px;
      outline: none;
    }
    #lemon-bot-input:focus {
      border-color: #2563eb;
    }
    #lemon-bot-send {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #2563eb;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    #lemon-bot-send:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }
    .lemon-typing {
      display: flex;
      gap: 4px;
      padding: 10px 14px;
      align-self: flex-start;
      background: ${theme === "dark" ? "#1e293b" : "#ffffff"};
      border-radius: 16px;
      border-bottom-left-radius: 4px;
    }
    .lemon-dot {
      width: 6px;
      height: 6px;
      background: #64748b;
      border-radius: 50%;
      animation: lemonBounce 1.2s infinite ease-in-out;
    }
    .lemon-dot:nth-child(2) { animation-delay: 0.2s; }
    .lemon-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes lemonBounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }
  `;
  document.head.appendChild(style);

  // Container
  const container = document.createElement("div");
  container.id = "lemon-bot-container";
  container.innerHTML = `
    <div id="lemon-bot-window">
      <div id="lemon-bot-header">
        <h4>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ade80;"></span>
          ${brandName} AI Assistant
        </h4>
        <button id="lemon-bot-close" aria-label="Close Chat">✕</button>
      </div>
      <div id="lemon-bot-messages"></div>
      <div id="lemon-bot-input-area">
        <input type="text" id="lemon-bot-input" placeholder="Type a message..." autocomplete="off" />
        <button id="lemon-bot-send" aria-label="Send Message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
    <div id="lemon-bot-bubble" aria-label="Open Chat">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </div>
  `;
  document.body.appendChild(container);

  const bubble = container.querySelector("#lemon-bot-bubble");
  const win = container.querySelector("#lemon-bot-window");
  const closeBtn = container.querySelector("#lemon-bot-close");
  const msgList = container.querySelector("#lemon-bot-messages");
  const input = container.querySelector("#lemon-bot-input");
  const sendBtn = container.querySelector("#lemon-bot-send");

  function renderMessages() {
    msgList.innerHTML = messages
      .map(
        (m) => `
        <div class="lemon-msg lemon-msg-${m.role}">
          <div>${m.text}</div>
          <div class="lemon-msg-time">${m.time || ""}</div>
        </div>
      `
      )
      .join("");
    msgList.scrollTop = msgList.scrollHeight;
  }

  function saveMessages() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50)));
    } catch (_) {}
  }

  let isOpen = false;
  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      win.classList.add("open");
      renderMessages();
      input.focus();
    } else {
      win.classList.remove("open");
    }
  }

  bubble.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  async function handleSend() {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    messages.push({ role: "user", text, time: nowTime });
    renderMessages();
    saveMessages();

    // Show typing indicator
    const typingElem = document.createElement("div");
    typingElem.className = "lemon-typing";
    typingElem.innerHTML = `<div class="lemon-dot"></div><div class="lemon-dot"></div><div class="lemon-dot"></div>`;
    msgList.appendChild(typingElem);
    msgList.scrollTop = msgList.scrollHeight;

    sendBtn.disabled = true;

    try {
      const res = await fetch(`${apiBaseUrl}/api/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userId, sessionId }),
      });

      const data = await res.json();
      typingElem.remove();

      const replyText = data.reply || "Thank you for reaching out! A representative will connect with you shortly.";
      messages.push({
        role: "bot",
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      typingElem.remove();
      messages.push({
        role: "bot",
        text: "Sorry, I am having trouble connecting right now. Please try again in a moment.",
        time: nowTime,
      });
    } finally {
      sendBtn.disabled = false;
      renderMessages();
      saveMessages();
    }
  }

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
})();
