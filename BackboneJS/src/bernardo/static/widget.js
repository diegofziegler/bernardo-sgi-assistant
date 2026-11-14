(function () {
    if (window.__BernardoInitialized) return;
    window.__BernardoInitialized = true;

    const BASE_URL = "__BERNARDO_BASE_URL__";
    const STORAGE_KEY = "bernardo_sgi_thread_id";
    const DISMISSED_ALERT_KEY = "bernardo_dismissed_alert_id";

    function getThreadId() {
        if (window.SGI_USER_ID) {
            return `sgi_user_${window.SGI_USER_ID}`;
        }
        let tid = localStorage.getItem(STORAGE_KEY);
        if (!tid) {
            tid = "sgi_" + crypto.randomUUID().replace(/-/g, "");
            localStorage.setItem(STORAGE_KEY, tid);
        }
        return tid;
    }

    const threadId = getThreadId();

    const host = document.createElement("div");
    host.id = "bernardo-sgi-host";
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    const robotSvg = `
        <svg viewBox="0 0 64 64" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="32" y1="6" x2="32" y2="14" stroke="#93C5FD" stroke-width="3" stroke-linecap="round"/>
            <circle cx="32" cy="5" r="3.5" fill="#60A5FA"/>
            <rect x="12" y="14" width="40" height="36" rx="10" fill="#1E293B" stroke="#60A5FA" stroke-width="2.5"/>
            <rect x="7" y="26" width="5" height="12" rx="2.5" fill="#3B82F6"/>
            <rect x="52" y="26" width="5" height="12" rx="2.5" fill="#3B82F6"/>
            <circle cx="24" cy="29" r="4.5" fill="#38BDF8"/>
            <circle cx="40" cy="29" r="4.5" fill="#38BDF8"/>
            <circle cx="25" cy="28" r="1.5" fill="#FFFFFF"/>
            <circle cx="41" cy="28" r="1.5" fill="#FFFFFF"/>
            <rect x="22" y="39" width="20" height="4" rx="2" fill="#94A3B8"/>
        </svg>
    `;

    shadow.innerHTML = `
        <style>
            :host {
                all: initial;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .wrapper {
                position: fixed;
                bottom: 22px;
                right: 22px;
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }
            .proactive-bubble {
                background: #ffffff;
                color: #1e293b;
                padding: 12px 24px 12px 14px;
                border-radius: 12px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.18);
                border: 1px solid #e2e8f0;
                border-left: 4px solid #3b82f6;
                font-size: 13px;
                line-height: 1.4;
                margin-bottom: 10px;
                max-width: 275px;
                cursor: pointer;
                animation: fadeIn 0.35s ease;
                position: relative;
            }
            .proactive-bubble.severity-maintenance {
                background: #fffbeb;
                border-color: #fde68a;
                border-left: 4px solid #f59e0b;
                color: #78350f;
            }
            .proactive-bubble.severity-critical {
                background: #fef2f2;
                border-color: #fecaca;
                border-left: 4px solid #ef4444;
                color: #7f1d1d;
            }
            .proactive-title {
                font-weight: 700;
                display: block;
                margin-bottom: 3px;
            }
            .proactive-close {
                position: absolute;
                top: 6px;
                right: 8px;
                font-size: 12px;
                opacity: 0.65;
                cursor: pointer;
            }
            .proactive-close:hover {
                opacity: 1;
            }
            .launcher {
                position: relative;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
                border: 2px solid #3b82f6;
                box-shadow: 0 8px 20px rgba(15, 23, 42, 0.35);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s ease;
            }
            .launcher:hover {
                transform: scale(1.07);
            }
            .alert-dot {
                position: absolute;
                top: -2px;
                right: -2px;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #ef4444;
                border: 2px solid #ffffff;
                display: none;
                animation: pulse 1.5s infinite;
            }
            .chat-window {
                width: 380px;
                height: 530px;
                background: #ffffff;
                border-radius: 14px;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
                border: 1px solid #cbd5e1;
                display: none;
                flex-direction: column;
                overflow: hidden;
                margin-bottom: 12px;
            }
            .chat-window.open {
                display: flex;
            }
            .header {
                background: #0f172a;
                color: #f8fafc;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .header-info {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .header-title {
                font-weight: 600;
                font-size: 15px;
            }
            .header-sub {
                font-size: 11px;
                color: #93c5fd;
            }
            .close-btn {
                background: transparent;
                border: none;
                color: #cbd5e1;
                font-size: 18px;
                cursor: pointer;
            }
            .chat-alert-banner {
                display: none;
                padding: 10px 14px;
                font-size: 12.5px;
                line-height: 1.35;
                border-bottom: 1px solid #e2e8f0;
            }
            .chat-alert-banner.severity-info {
                background: #eff6ff;
                color: #1e40af;
            }
            .chat-alert-banner.severity-maintenance {
                background: #fffbeb;
                color: #92400e;
            }
            .chat-alert-banner.severity-critical {
                background: #fef2f2;
                color: #991b1b;
            }
            .messages {
                flex: 1;
                padding: 14px;
                overflow-y: auto;
                background: #f8fafc;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .msg {
                max-width: 84%;
                padding: 10px 13px;
                border-radius: 10px;
                font-size: 13.5px;
                line-height: 1.45;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            .msg.user {
                background: #1d4ed8;
                color: #ffffff;
                align-self: flex-end;
                border-bottom-right-radius: 2px;
            }
            .msg.assistant {
                background: #ffffff;
                color: #1e293b;
                border: 1px solid #e2e8f0;
                align-self: flex-start;
                border-bottom-left-radius: 2px;
            }
            .input-bar {
                display: flex;
                padding: 10px;
                background: #ffffff;
                border-top: 1px solid #e2e8f0;
                gap: 8px;
            }
            .input-bar input {
                flex: 1;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 9px 12px;
                font-size: 13.5px;
                outline: none;
            }
            .input-bar input:focus {
                border-color: #2563eb;
            }
            .input-bar button {
                background: #1d4ed8;
                color: #ffffff;
                border: none;
                border-radius: 8px;
                padding: 0 14px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
            }
            .input-bar button:disabled {
                background: #94a3b8;
                cursor: not-allowed;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulse {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                70% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
        </style>

        <div class="wrapper">
            <div class="chat-window" id="chatWindow">
                <div class="header">
                    <div class="header-info">
                        ${robotSvg}
                        <div>
                            <div class="header-title">Bernardo</div>
                            <div class="header-sub">Soporte Inteligente • SGI</div>
                        </div>
                    </div>
                    <button class="close-btn" id="closeBtn" title="Cerrar">✕</button>
                </div>
                <div class="chat-alert-banner" id="chatAlertBanner"></div>
                <div class="messages" id="messagesBox"></div>
                <div class="input-bar">
                    <input type="text" id="chatInput" placeholder="Preguntame sobre SGI..." />
                    <button id="sendBtn">Enviar</button>
                </div>
            </div>

            <div class="proactive-bubble" id="proactiveBubble">
                <span class="proactive-close" id="closeProactive">✕</span>
                <div id="proactiveContent">
                    👋 ¡Hola! Soy <strong>Bernardo</strong>. ¿Necesitás ayuda con algún módulo o proceso de <strong>SGI</strong>?
                </div>
            </div>

            <button class="launcher" id="launcherBtn" title="Hablar con Bernardo">
                <span class="alert-dot" id="alertDot"></span>
                ${robotSvg}
            </button>
        </div>
    `;

    const chatWindow = shadow.getElementById("chatWindow");
    const launcherBtn = shadow.getElementById("launcherBtn");
    const closeBtn = shadow.getElementById("closeBtn");
    const proactiveBubble = shadow.getElementById("proactiveBubble");
    const proactiveContent = shadow.getElementById("proactiveContent");
    const closeProactive = shadow.getElementById("closeProactive");
    const chatAlertBanner = shadow.getElementById("chatAlertBanner");
    const alertDot = shadow.getElementById("alertDot");
    const messagesBox = shadow.getElementById("messagesBox");
    const chatInput = shadow.getElementById("chatInput");
    const sendBtn = shadow.getElementById("sendBtn");

    let historyLoaded = false;
    let currentAlertId = null;

    function addBubble(role, text) {
        const div = document.createElement("div");
        div.className = `msg ${role}`;
        div.textContent = text;
        messagesBox.appendChild(div);
        messagesBox.scrollTop = messagesBox.scrollHeight;
        return div;
    }

	async function checkGlobalAlerts() {
        try {
            const res = await fetch(`${BASE_URL}/api/bernardo/alerts/active`);
            if (!res.ok) return;
            const data = await res.json();

            if (data.has_alert && data.alert) {
                const { id, title, message, severity } = data.alert;
                currentAlertId = id;

                // Mostrar banner interno en la ventana de chat
                chatAlertBanner.className = `chat-alert-banner severity-${severity}`;
                chatAlertBanner.innerHTML = `<strong>⚠️ ${title}:</strong> ${message}`;
                chatAlertBanner.style.display = "block";
                alertDot.style.display = "block";

                // Mostrar burbuja proactiva si el usuario no la descartó aún
                const dismissedId = sessionStorage.getItem(DISMISSED_ALERT_KEY);
                if (dismissedId !== id && !chatWindow.classList.contains("open")) {
                    proactiveBubble.className = `proactive-bubble severity-${severity}`;
                    const icon = severity === "critical" ? "🚨" : severity === "maintenance" ? "🛠️" : "ℹ️";
                    proactiveContent.innerHTML = `<span class="proactive-title">${icon} ${title}</span>${message}`;
                    proactiveBubble.style.display = "block";
                }
            } else {
                currentAlertId = null;
                chatAlertBanner.style.display = "none";
                alertDot.style.display = "none";
                proactiveBubble.style.display = "none"; // <--- ¡Esta es la línea que faltaba agregar!
            }
        } catch (e) {
            // Silencioso si el servidor no responde temporalmente
        }
    }

    async function loadHistory() {
        if (historyLoaded) return;
        historyLoaded = true;
        try {
            const res = await fetch(`${BASE_URL}/api/bernardo/history/${encodeURIComponent(threadId)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(m => addBubble(m.role, m.content));
                    return;
                }
            }
        } catch (e) {
            console.warn("Bernardo: no se pudo cargar historial previo.", e);
        }
        addBubble("assistant", "¡Hola! Soy Bernardo, tu asistente de soporte para SGI. ¿En qué puedo ayudarte hoy?");
    }

    function toggleChat(forceOpen = null) {
        const isOpen = forceOpen !== null ? forceOpen : !chatWindow.classList.contains("open");
        if (isOpen) {
            chatWindow.classList.add("open");
            proactiveBubble.style.display = "none";
            loadHistory();
            chatInput.focus();
        } else {
            chatWindow.classList.remove("open");
        }
    }

    launcherBtn.addEventListener("click", () => toggleChat());
    closeBtn.addEventListener("click", () => toggleChat(false));
    proactiveBubble.addEventListener("click", (e) => {
        if (e.target !== closeProactive) toggleChat(true);
    });
    closeProactive.addEventListener("click", (e) => {
        e.stopPropagation();
        proactiveBubble.style.display = "none";
        if (currentAlertId) {
            sessionStorage.setItem(DISMISSED_ALERT_KEY, currentAlertId);
        }
    });

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = "";
        chatInput.disabled = true;
        sendBtn.disabled = true;

        addBubble("user", text);
        const botBubble = addBubble("assistant", "Pensando...");

        try {
            const response = await fetch(`${BASE_URL}/api/bernardo/chat/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    thread_id: threadId,
                    idioma_destino: "es"
                })
            });

            if (!response.ok) throw new Error("Error HTTP " + response.status);

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullReply = "";
            botBubble.textContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunkText = decoder.decode(value, { stream: true });
                const lines = chunkText.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;
                        const evt = JSON.parse(jsonStr);
                        if (evt.type === "chunk") {
                            fullReply += evt.content;
                            botBubble.textContent = fullReply;
                            messagesBox.scrollTop = messagesBox.scrollHeight;
                        } else if (evt.type === "error") {
                            botBubble.textContent = evt.content;
                        }
                    }
                }
            }
        } catch (err) {
            botBubble.textContent = "No pude conectarme con el servidor de Bernardo. Verificá que el servicio esté activo.";
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    sendBtn.addEventListener("click", sendMessage);
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    // Verificar alertas al iniciar y cada 45 segundos
    checkGlobalAlerts();
    setInterval(checkGlobalAlerts, 45000);
})();