/**
 * ============================================================
 * VMS Ultra Pro — AI Widget v3.0
 * public/js/ai-widget.js
 *
 * Features:
 * - Two-tab panel: [💬 Chat] and [⚡ Tools]
 * - Chat tab: conversational AI with history + streaming render
 * - Tools tab: structured feature runner (20+ AI features)
 * - All responses rendered via VMSRender (markdown + HTML parser)
 * - Floating FAB button with pulse ring
 * - Dark mode aware
 * ============================================================
 */

(function VmsAiWidget() {
    'use strict';

    // Only on dashboard pages
    if (!window.location.pathname.includes('dashboard') && !window.location.pathname.includes('dashbaord')) return;

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ─── Auth Token Helper ───────────────────────────────────
    function getToken() {
        return localStorage.getItem('adminToken') ||
               localStorage.getItem('deptAdminToken') ||
               localStorage.getItem('employeeToken') ||
               localStorage.getItem('securityToken') ||
               localStorage.getItem('visitorToken') || '';
    }

    // ─── Detect current user role for chat context ───────────
    function detectRole() {
        const p = window.location.pathname;
        if (p.includes('admin')) return 'Admin';
        if (p.includes('deptadmin')) return 'DeptAdmin';
        if (p.includes('employee')) return 'Employee';
        if (p.includes('security')) return 'Security';
        if (p.includes('visitor')) return 'Visitor';
        return 'Staff';
    }

    // Chat history (in-memory per session)
    const chatHistory = [];

    // ─── INIT ────────────────────────────────────────────────
    function init() {
        injectStyles();
        injectHTML();
        bindEvents();
    }

    // ─── STYLES ──────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('vms-ai-widget-css')) return;
        const s = document.createElement('style');
        s.id = 'vms-ai-widget-css';
        s.textContent = `
            /* ─── FAB Button ─────────────────────── */
            #vmsAiFab {
                position: fixed; bottom: 28px; right: 28px;
                width: 58px; height: 58px; border-radius: 50%;
                background: linear-gradient(135deg, #2563eb, #7c3aed);
                color: #fff; display: flex; align-items: center; justify-content: center;
                font-size: 1.6rem; cursor: pointer; z-index: 99998;
                box-shadow: 0 8px 28px rgba(37,99,235,0.45);
                transition: transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.2s;
                border: none; outline: none;
            }
            #vmsAiFab:hover { transform: scale(1.12); box-shadow: 0 12px 36px rgba(37,99,235,0.55); }
            #vmsAiFab .fab-pulse {
                position: absolute; width: 100%; height: 100%; border-radius: 50%;
                background: rgba(37,99,235,0.35); animation: fabPulse 2.5s ease-out infinite;
            }
            @keyframes fabPulse {
                0% { transform: scale(1); opacity: 0.7; }
                70% { transform: scale(1.7); opacity: 0; }
                100% { transform: scale(1.7); opacity: 0; }
            }

            /* ─── Panel ──────────────────────────── */
            #vmsAiPanel {
                position: fixed; top: 0; right: -430px; width: 420px; height: 100dvh;
                background: rgba(255,255,255,0.97);
                backdrop-filter: blur(20px) saturate(180%);
                border-left: 1px solid rgba(0,0,0,0.08);
                box-shadow: -8px 0 50px rgba(0,0,0,0.14);
                z-index: 99999; display: flex; flex-direction: column;
                transition: right 0.38s cubic-bezier(0.16,1,0.3,1);
                font-family: 'Plus Jakarta Sans','Segoe UI',system-ui,sans-serif;
            }
            #vmsAiPanel.open { right: 0; }
            [data-theme="dark"] #vmsAiPanel {
                background: rgba(15,23,42,0.97);
                border-left-color: rgba(255,255,255,0.07);
            }

            /* ─── Panel Header ───────────────────── */
            .vai-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 18px 20px 14px;
                background: linear-gradient(135deg, #2563eb, #7c3aed);
                color: #fff; flex-shrink: 0;
            }
            .vai-header-left { display: flex; align-items: center; gap: 10px; }
            .vai-header-icon { font-size: 1.4rem; }
            .vai-header-title { font-size: 1rem; font-weight: 800; letter-spacing: -0.2px; }
            .vai-header-sub { font-size: 11px; opacity: 0.8; margin-top: 1px; }
            .vai-close {
                background: rgba(255,255,255,0.18); border: none; color: #fff;
                width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
                display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
                transition: background 0.2s;
            }
            .vai-close:hover { background: rgba(255,255,255,0.3); }

            /* ─── Tabs ───────────────────────────── */
            .vai-tabs {
                display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
                flex-shrink: 0;
            }
            [data-theme="dark"] .vai-tabs { background: #1e293b; border-color: #334155; }
            .vai-tab {
                flex: 1; padding: 11px 8px; border: none; background: none; cursor: pointer;
                font-size: 13px; font-weight: 600; color: #64748b; display: flex;
                align-items: center; justify-content: center; gap: 6px;
                transition: all 0.2s; position: relative;
                font-family: inherit;
            }
            .vai-tab.active { color: #2563eb; background: #fff; }
            [data-theme="dark"] .vai-tab.active { color: #60a5fa; background: #0f172a; }
            .vai-tab.active::after {
                content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
                height: 2px; background: #2563eb; border-radius: 2px 2px 0 0;
            }

            /* ─── Tab Content ─────────────────────── */
            .vai-tab-content { display: none; flex: 1; overflow: hidden; flex-direction: column; }
            .vai-tab-content.active { display: flex; }

            /* ─── CHAT TAB ───────────────────────── */
            .vai-chat-messages {
                flex: 1; overflow-y: auto; padding: 16px;
                display: flex; flex-direction: column; gap: 12px;
                scroll-behavior: smooth;
            }
            .vai-chat-messages::-webkit-scrollbar { width: 4px; }
            .vai-chat-messages::-webkit-scrollbar-track { background: transparent; }
            .vai-chat-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }

            .vai-msg { display: flex; gap: 10px; align-items: flex-start; }
            .vai-msg.user { flex-direction: row-reverse; }
            .vai-msg-avatar {
                width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
                display: flex; align-items: center; justify-content: center; font-size: 1rem;
            }
            .vai-msg.ai .vai-msg-avatar { background: linear-gradient(135deg,#2563eb,#7c3aed); color:#fff; }
            .vai-msg.user .vai-msg-avatar { background: linear-gradient(135deg,#16a34a,#0d9488); color:#fff; font-size:0.9rem; }
            .vai-msg-bubble {
                max-width: 85%; padding: 10px 14px; border-radius: 16px;
                font-size: 13.5px; line-height: 1.65;
            }
            .vai-msg.user .vai-msg-bubble {
                background: linear-gradient(135deg,#2563eb,#7c3aed); color: #fff;
                border-bottom-right-radius: 4px;
            }
            .vai-msg.ai .vai-msg-bubble {
                background: #f1f5f9; color: #334155;
                border-bottom-left-radius: 4px;
                border: 1px solid #e2e8f0;
            }
            [data-theme="dark"] .vai-msg.ai .vai-msg-bubble {
                background: #1e293b; color: #e2e8f0; border-color: #334155;
            }

            /* Typing indicator */
            .vai-typing .vai-msg-bubble {
                display: flex; align-items: center; gap: 5px; padding: 12px 16px;
            }
            .vai-dot {
                width: 7px; height: 7px; border-radius: 50%;
                background: #94a3b8; animation: vaiDot 1.4s infinite ease-in-out;
            }
            .vai-dot:nth-child(2) { animation-delay: 0.2s; }
            .vai-dot:nth-child(3) { animation-delay: 0.4s; }
            @keyframes vaiDot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

            /* Chat input */
            .vai-chat-input-wrap {
                padding: 12px 16px; border-top: 1px solid #e2e8f0;
                flex-shrink: 0; display: flex; gap: 8px; align-items: flex-end;
            }
            [data-theme="dark"] .vai-chat-input-wrap { border-color: #334155; }
            .vai-chat-input {
                flex: 1; border: 1.5px solid #e2e8f0; border-radius: 12px;
                padding: 10px 14px; font-size: 13.5px; resize: none;
                font-family: inherit; max-height: 100px; min-height: 42px;
                background: #f8fafc; color: #334155; outline: none; transition: border 0.2s;
            }
            .vai-chat-input:focus { border-color: #2563eb; background: #fff; }
            [data-theme="dark"] .vai-chat-input { background: #1e293b; color: #e2e8f0; border-color: #334155; }
            [data-theme="dark"] .vai-chat-input:focus { background: #0f172a; border-color: #60a5fa; }
            .vai-chat-send {
                width: 42px; height: 42px; border-radius: 12px; border: none;
                background: linear-gradient(135deg,#2563eb,#7c3aed); color: #fff;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                font-size: 1.1rem; flex-shrink: 0; transition: transform 0.15s, opacity 0.2s;
            }
            .vai-chat-send:hover { transform: scale(1.05); }
            .vai-chat-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

            /* Chat Welcome */
            .vai-chat-welcome {
                text-align: center; padding: 30px 20px;
                display: flex; flex-direction: column; align-items: center; gap: 12px;
            }
            .vai-chat-welcome .vai-w-icon {
                width: 60px; height: 60px; border-radius: 50%;
                background: linear-gradient(135deg,#2563eb,#7c3aed);
                color: #fff; display: flex; align-items: center; justify-content: center;
                font-size: 1.8rem;
            }
            .vai-chat-welcome h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
            [data-theme="dark"] .vai-chat-welcome h3 { color: #f1f5f9; }
            .vai-chat-welcome p { font-size: 13px; color: #64748b; margin: 0; line-height: 1.6; }
            .vai-suggestions { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 4px; }
            .vai-suggestion {
                background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px;
                padding: 9px 14px; font-size: 12.5px; color: #475569; cursor: pointer;
                text-align: left; transition: all 0.2s; font-family: inherit;
            }
            [data-theme="dark"] .vai-suggestion { background: #1e293b; border-color: #334155; color: #94a3b8; }
            .vai-suggestion:hover { background: rgba(37,99,235,0.08); border-color: #2563eb; color: #2563eb; }

            /* ─── TOOLS TAB ──────────────────────── */
            .vai-tools-body {
                flex: 1; overflow-y: auto; padding: 14px 16px;
                display: flex; flex-direction: column; gap: 12px;
            }
            .vai-tools-body::-webkit-scrollbar { width: 4px; }
            .vai-tools-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }

            .vai-field-label {
                font-size: 11px; font-weight: 700; color: #64748b;
                text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;
                display: block;
            }
            .vai-select, .vai-input, .vai-textarea {
                width: 100%; border: 1.5px solid #e2e8f0; border-radius: 10px;
                padding: 9px 12px; font-size: 13px; font-family: inherit;
                background: #f8fafc; color: #334155; outline: none; transition: border 0.2s;
            }
            .vai-select:focus, .vai-input:focus, .vai-textarea:focus {
                border-color: #2563eb; background: #fff;
            }
            [data-theme="dark"] .vai-select, [data-theme="dark"] .vai-input,
            [data-theme="dark"] .vai-textarea {
                background: #1e293b; color: #e2e8f0; border-color: #334155;
            }
            [data-theme="dark"] .vai-select:focus, [data-theme="dark"] .vai-input:focus,
            [data-theme="dark"] .vai-textarea:focus { background: #0f172a; border-color: #60a5fa; }
            .vai-textarea { resize: vertical; min-height: 72px; }

            .vai-run-btn {
                width: 100%; padding: 11px; border: none; border-radius: 10px;
                background: linear-gradient(135deg,#2563eb,#7c3aed); color: #fff;
                font-size: 14px; font-weight: 700; cursor: pointer;
                display: flex; align-items: center; justify-content: center; gap: 8px;
                transition: opacity 0.2s, transform 0.15s;
                font-family: inherit; letter-spacing: 0.2px;
            }
            .vai-run-btn:hover { transform: translateY(-1px); opacity: 0.94; }
            .vai-run-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

            /* Output box */
            .vai-output-label {
                font-size: 11px; font-weight: 700; color: #64748b;
                text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;
            }
            .vai-output-box {
                border: 1.5px solid #e2e8f0; border-radius: 12px;
                background: #f8fafc; padding: 14px 16px; min-height: 80px;
                font-size: 13.5px; color: #334155; line-height: 1.65;
                max-height: 260px; overflow-y: auto;
            }
            [data-theme="dark"] .vai-output-box {
                background: #0f172a; color: #e2e8f0; border-color: #334155;
            }
            .vai-output-placeholder { color: #94a3b8; font-style: italic; font-size: 13px; }
            .vai-output-actions {
                display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;
            }
            .vai-out-btn {
                flex: 1; padding: 7px 12px; border-radius: 8px; font-size: 12px;
                font-weight: 600; cursor: pointer; display: flex; align-items: center;
                justify-content: center; gap: 5px; transition: all 0.2s; font-family: inherit;
            }
            .vai-out-btn.copy { background: rgba(37,99,235,0.1); color: #2563eb; border: 1px solid rgba(37,99,235,0.2); }
            .vai-out-btn.copy:hover { background: rgba(37,99,235,0.18); }
            .vai-out-btn.clear { background: rgba(220,38,38,0.08); color: #dc2626; border: 1px solid rgba(220,38,38,0.15); }
            .vai-out-btn.clear:hover { background: rgba(220,38,38,0.14); }
            .vai-out-btn.chat { background: rgba(124,58,237,0.1); color: #7c3aed; border: 1px solid rgba(124,58,237,0.2); }
            .vai-out-btn.chat:hover { background: rgba(124,58,237,0.18); }

            /* Params container */
            #vaiParamContainer { display: flex; flex-direction: column; gap: 8px; }

            /* Mobile responsive */
            @media (max-width: 480px) {
                #vmsAiPanel { width: 100vw; }
            }
        `;
        document.head.appendChild(s);
    }

    // ─── HTML ────────────────────────────────────────────────
    function injectHTML() {
        const role = detectRole();

        const chatSuggestions = [
            '📊 Summarize today\'s visitor activity',
            '🔐 How to handle a brute-force lockout?',
            '📅 Help me plan a department schedule',
            '📝 Write a visitor approval message'
        ];

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
        <!-- FAB -->
        <button id="vmsAiFab" title="VMS Assistant" onclick="window.vmsAiToggle()">
            <span class="fab-pulse"></span>
            <i class="bi bi-stars"></i>
        </button>

        <!-- Panel -->
        <div id="vmsAiPanel" role="dialog" aria-label="VMS AI Assistant">

            <!-- Header -->
            <div class="vai-header">
                <div class="vai-header-left">
                    <span class="vai-header-icon"><i class="bi bi-stars"></i></span>
                    <div>
                        <div class="vai-header-title">VMS Assistant</div>
                        <div class="vai-header-sub">Gemini AI · ${role} Portal</div>
                    </div>
                </div>
                <button class="vai-close" onclick="window.vmsAiClose()" title="Close">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>

            <!-- Tabs -->
            <div class="vai-tabs">
                <button class="vai-tab active" id="vaiTabChat" onclick="window.vmsAiSwitchTab('chat')">
                    <i class="bi bi-chat-dots-fill"></i> Chat
                </button>
                <button class="vai-tab" id="vaiTabTools" onclick="window.vmsAiSwitchTab('tools')">
                    <i class="bi bi-lightning-fill"></i> AI Tools
                </button>
            </div>

            <!-- ── CHAT TAB ────────────────────────────── -->
            <div class="vai-tab-content active" id="vaiChatTab">
                <div class="vai-chat-messages" id="vaiChatMessages">
                    <!-- Welcome -->
                    <div class="vai-chat-welcome" id="vaiChatWelcome">
                        <div class="vai-w-icon"><i class="bi bi-stars"></i></div>
                        <h3>Hi there! I'm VMS Assistant 👋</h3>
                        <p>Ask me anything about visitor management, security, schedules, or how to use the system.</p>
                        <div class="vai-suggestions" id="vaiSuggestions">
                            ${chatSuggestions.map(s => `<button class="vai-suggestion" onclick="window.vmsAiSendSuggestion('${s.replace(/'/g, "\\'")}')"><i class="bi bi-arrow-return-right"></i> ${s}</button>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="vai-chat-input-wrap">
                    <textarea class="vai-chat-input" id="vaiChatInput" rows="1"
                        placeholder="Ask anything about VMS…"
                        onkeydown="window.vmsAiChatKeydown(event)"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px'"
                    ></textarea>
                    <button class="vai-chat-send" id="vaiChatSend" onclick="window.vmsAiChatSend()" title="Send">
                        <i class="bi bi-send-fill"></i>
                    </button>
                </div>
            </div>

            <!-- ── TOOLS TAB ───────────────────────────── -->
            <div class="vai-tab-content" id="vaiToolsTab">
                <div class="vai-tools-body">
                    <div>
                        <span class="vai-field-label">Select AI Feature</span>
                        <select class="vai-select" id="vaiFeatureSelect" onchange="window.vmsAiRenderParams()">
                            <optgroup label="✍️ Content Generation">
                                <option value="greetingGenerator">Visitor Greeting Generator</option>
                                <option value="purposeGenerator">Purpose Statement Generator</option>
                                <option value="scheduleStatement">Schedule Statement Writer</option>
                                <option value="emailDraft">Email Draft Composer</option>
                                <option value="autoReplyDraft">Auto-Reply Template</option>
                                <option value="checkInGuide">Check-In Guide Writer</option>
                                <option value="shiftNotes">Shift Handover Notes</option>
                            </optgroup>
                            <optgroup label="📊 Analysis & Intelligence">
                                <option value="summarizeVisitor">Visitor Profile Summarizer</option>
                                <option value="riskPredictor">Security Risk Predictor</option>
                                <option value="priorityAdvisor">Task Priority Advisor</option>
                                <option value="feedbackAnalyzer">Visitor Feedback Analyzer</option>
                                <option value="sentimentAnalysis">Sentiment Scorer</option>
                                <option value="lockoutReasoning">Lockout Incident Analysis</option>
                                <option value="patternDetector">Visitor Pattern Detector</option>
                            </optgroup>
                            <optgroup label="🏢 Operations">
                                <option value="auditSummary">Security Audit Summary</option>
                                <option value="loadOptimizer">Lobby Load Optimizer</option>
                                <option value="optimizationTips">Queue Efficiency Tips</option>
                                <option value="agendaPlanner">Meeting Agenda Planner</option>
                                <option value="checkoutReminder">Checkout Reminder SMS</option>
                                <option value="emergencyProtocol">Emergency Protocol Generator</option>
                            </optgroup>
                            <optgroup label="🌍 Utility">
                                <option value="passTranslator">Pass Translator</option>
                            </optgroup>
                        </select>
                    </div>

                    <!-- Dynamic params injected here -->
                    <div id="vaiParamContainer"></div>

                    <!-- Run button -->
                    <button class="vai-run-btn" id="vaiRunBtn" onclick="window.vmsAiRunTool()">
                        <i class="bi bi-stars"></i> Generate with AI
                    </button>

                    <!-- Output -->
                    <div class="vai-output-label">AI OUTPUT</div>
                    <div class="vai-output-box" id="vaiOutputBox">
                        <span class="vai-output-placeholder">Your AI-generated result will appear here...</span>
                    </div>
                    <div class="vai-output-actions">
                        <button class="vai-out-btn copy" onclick="window.vmsAiCopyOutput()">
                            <i class="bi bi-clipboard2-fill"></i> Copy
                        </button>
                        <button class="vai-out-btn chat" onclick="window.vmsAiSendOutputToChat()">
                            <i class="bi bi-chat-dots-fill"></i> Ask Chat
                        </button>
                        <button class="vai-out-btn clear" onclick="window.vmsAiClearOutput()">
                            <i class="bi bi-trash3-fill"></i> Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;

        document.body.appendChild(wrapper.firstElementChild); // FAB
        document.body.appendChild(wrapper.lastElementChild);   // Panel

        // Init params for default selected feature
        setTimeout(window.vmsAiRenderParams, 50);
    }

    // ─── PANEL TOGGLE ────────────────────────────────────────
    window.vmsAiToggle = function() {
        const panel = document.getElementById('vmsAiPanel');
        if (panel) panel.classList.toggle('open');
    };
    window.vmsAiClose = function() {
        const panel = document.getElementById('vmsAiPanel');
        if (panel) panel.classList.remove('open');
    };

    // ─── TAB SWITCH ──────────────────────────────────────────
    window.vmsAiSwitchTab = function(tab) {
        document.querySelectorAll('.vai-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.vai-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById('vaiTab' + tab.charAt(0).toUpperCase() + tab.slice(1))?.classList.add('active');
        document.getElementById('vai' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab')?.classList.add('active');
    };

    // ─── CHAT ────────────────────────────────────────────────

    function appendMessage(role, content, isRaw) {
        const welcome = document.getElementById('vaiChatWelcome');
        if (welcome) welcome.remove();

        const msgs = document.getElementById('vaiChatMessages');
        const msg = document.createElement('div');
        msg.className = `vai-msg ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'vai-msg-avatar';
        avatar.innerHTML = role === 'ai'
            ? '<i class="bi bi-stars"></i>'
            : '<i class="bi bi-person-fill"></i>';

        const bubble = document.createElement('div');
        bubble.className = 'vai-msg-bubble vms-ai-rendered';

        if (role === 'ai' && !isRaw) {
            // Render markdown for AI responses
            if (window.VMSRender) {
                window.VMSRender(content, bubble);
            } else {
                bubble.textContent = content;
            }
        } else {
            bubble.textContent = content;
        }

        msg.appendChild(avatar);
        msg.appendChild(bubble);
        msgs.appendChild(msg);
        msgs.scrollTop = msgs.scrollHeight;
        return msg;
    }

    function showTyping() {
        const msgs = document.getElementById('vaiChatMessages');
        const msg = document.createElement('div');
        msg.className = 'vai-msg ai vai-typing';
        msg.id = 'vaiTypingIndicator';
        msg.innerHTML = `
            <div class="vai-msg-avatar"><i class="bi bi-stars"></i></div>
            <div class="vai-msg-bubble">
                <span class="vai-dot"></span>
                <span class="vai-dot"></span>
                <span class="vai-dot"></span>
            </div>`;
        msgs.appendChild(msg);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function removeTyping() {
        document.getElementById('vaiTypingIndicator')?.remove();
    }

    window.vmsAiChatKeydown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            window.vmsAiChatSend();
        }
    };

    window.vmsAiSendSuggestion = function(text) {
        const input = document.getElementById('vaiChatInput');
        if (input) { input.value = text; }
        window.vmsAiChatSend();
    };

    window.vmsAiChatSend = async function() {
        const input = document.getElementById('vaiChatInput');
        const sendBtn = document.getElementById('vaiChatSend');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;

        // Add to history
        chatHistory.push({ role: 'user', text });
        appendMessage('user', text);
        showTyping();

        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                },
                body: JSON.stringify({
                    action: 'chat',
                    payload: {
                        message: text,
                        history: chatHistory.slice(-10), // last 10 messages for context
                        role: detectRole()
                    }
                })
            });
            const data = await res.json();
            removeTyping();
            const reply = data.success ? data.text : ('⚠️ ' + (data.message || 'AI error.'));
            chatHistory.push({ role: 'ai', text: reply });
            appendMessage('ai', reply);
        } catch(e) {
            removeTyping();
            appendMessage('ai', '⚠️ Failed to reach VMS Assistant. Please check your connection.', true);
        } finally {
            sendBtn.disabled = false;
            input.focus();
        }
    };

    // ─── TOOLS ───────────────────────────────────────────────

    const FEATURE_PARAMS = {
        greetingGenerator: [
            { id: 'name', placeholder: 'Visitor Name (e.g. Ravi Sharma)' },
            { id: 'department', placeholder: 'Department (e.g. Engineering)' }
        ],
        purposeGenerator: [
            { id: 'rawPurpose', type: 'textarea', placeholder: 'Raw visit reason (e.g. i want to meet my brother for lunch)' }
        ],
        scheduleStatement: [
            { id: 'title', placeholder: 'Task Title' },
            { id: 'description', placeholder: 'Task Description' },
            { id: 'dateTime', placeholder: 'Date & Time (e.g. 2026-07-30 10:00 AM)' }
        ],
        summarizeVisitor: [
            { id: 'name', placeholder: 'Visitor Name' },
            { id: 'email', placeholder: 'Visitor Email' },
            { id: 'company', placeholder: 'Company Name' },
            { id: 'purpose', placeholder: 'Visit Purpose' },
            { id: 'visitCount', placeholder: 'Total Past Visits (number)' }
        ],
        riskPredictor: [
            { id: 'name', placeholder: 'Visitor Name' },
            { id: 'company', placeholder: 'Company' },
            { id: 'purpose', placeholder: 'Visit Purpose' }
        ],
        emailDraft: [
            { id: 'name', placeholder: 'Visitor Name' },
            { id: 'status', placeholder: 'Status (e.g. Approved / Rejected)' },
            { id: 'department', placeholder: 'Department' },
            { id: 'dateTime', placeholder: 'Visit Date & Time' }
        ],
        priorityAdvisor: [
            { id: 'title', placeholder: 'Task Title' },
            { id: 'description', type: 'textarea', placeholder: 'Task Description' }
        ],
        feedbackAnalyzer: [
            { id: 'feedbackText', type: 'textarea', placeholder: 'Paste visitor feedback here…' }
        ],
        auditSummary: [
            { id: 'checkedIn', placeholder: 'Total Checked In (number)', type: 'number' },
            { id: 'checkedOut', placeholder: 'Total Checked Out (number)', type: 'number' },
            { id: 'pending', placeholder: 'Pending Approvals (number)', type: 'number' }
        ],
        loadOptimizer: [
            { id: 'staffCount', placeholder: 'Staff Count', type: 'number' },
            { id: 'dailyVisits', placeholder: 'Average Daily Visitors', type: 'number' }
        ],
        agendaPlanner: [
            { id: 'host', placeholder: 'Host Employee Name' },
            { id: 'visitor', placeholder: 'Visitor Name' },
            { id: 'purpose', placeholder: 'Meeting Purpose' }
        ],
        sentimentAnalysis: [
            { id: 'text', type: 'textarea', placeholder: 'Visitor comment or feedback text…' }
        ],
        lockoutReasoning: [
            { id: 'portalId', placeholder: 'Portal ID (e.g. DA-39232951)' },
            { id: 'failedAttempts', placeholder: 'Failed Attempts Count', type: 'number' }
        ],
        patternDetector: [
            { id: 'monthlyVisits', placeholder: 'Visits This Month', type: 'number' },
            { id: 'avgStay', placeholder: 'Average Stay Duration (e.g. 1 hour)' }
        ],
        passTranslator: [
            { id: 'passNumber', placeholder: 'Pass Number' },
            { id: 'name', placeholder: 'Visitor Name' },
            { id: 'date', placeholder: 'Valid Date' },
            { id: 'department', placeholder: 'Department' },
            { id: 'language', placeholder: 'Target Language (e.g. Hindi, French)' }
        ],
        checkInGuide: [
            { id: 'lobby', placeholder: 'Lobby/Block (e.g. Block A, Main Reception)' },
            { id: 'idType', placeholder: 'ID Verification Type (e.g. Govt Photo ID)' }
        ],
        // No-param features
        checkoutReminder: [], shiftNotes: [], autoReplyDraft: [],
        optimizationTips: [], emergencyProtocol: []
    };

    window.vmsAiRenderParams = function() {
        const feature = document.getElementById('vaiFeatureSelect')?.value;
        const container = document.getElementById('vaiParamContainer');
        if (!container || !feature) return;

        const params = FEATURE_PARAMS[feature] || [];
        if (!params.length) {
            container.innerHTML = '<p style="font-size:12px;color:#94a3b8;padding:4px 0;">No input needed — just click Generate!</p>';
            return;
        }

        container.innerHTML = params.map(p => {
            if (p.type === 'textarea') {
                return `<div><span class="vai-field-label">${p.placeholder}</span>
                    <textarea class="vai-textarea" id="vaiP_${p.id}" placeholder="${p.placeholder}"></textarea></div>`;
            }
            return `<div><span class="vai-field-label">${p.placeholder}</span>
                <input class="vai-input" type="${p.type||'text'}" id="vaiP_${p.id}" placeholder="${p.placeholder}"></div>`;
        }).join('');
    };

    window.vmsAiRunTool = async function() {
        const feature = document.getElementById('vaiFeatureSelect')?.value;
        const btn = document.getElementById('vaiRunBtn');
        const output = document.getElementById('vaiOutputBox');
        if (!feature || !output) return;

        // Collect params
        const params = FEATURE_PARAMS[feature] || [];
        const payload = {};
        params.forEach(p => {
            const el = document.getElementById('vaiP_' + p.id);
            if (el) payload[p.id] = el.value;
        });

        // Show loading
        output.innerHTML = `<span style="color:#94a3b8;font-size:13px;display:flex;align-items:center;gap:8px;">
            <span class="vai-dot"></span><span class="vai-dot"></span><span class="vai-dot"></span>
            &nbsp;Generating with Gemini AI…</span>`;
        btn.disabled = true;

        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + getToken()
                },
                body: JSON.stringify({ action: feature, payload })
            });
            const data = await res.json();
            if (data.success && data.text) {
                if (window.VMSRender) {
                    window.VMSRender(data.text, output);
                } else {
                    output.textContent = data.text;
                }
            } else {
                output.innerHTML = `<span style="color:#dc2626;">⚠️ ${data.message || 'Failed to generate.'}</span>`;
            }
        } catch(e) {
            output.innerHTML = `<span style="color:#dc2626;">⚠️ Network error. Please try again.</span>`;
        } finally {
            btn.disabled = false;
        }
    };

    window.vmsAiCopyOutput = function() {
        const output = document.getElementById('vaiOutputBox');
        if (!output) return;
        navigator.clipboard.writeText(output.innerText || output.textContent).then(() => {
            if (window.showAlert) window.showAlert('Copied', 'AI output copied to clipboard!');
        });
    };

    window.vmsAiClearOutput = function() {
        const output = document.getElementById('vaiOutputBox');
        if (output) output.innerHTML = '<span class="vai-output-placeholder">Your AI-generated result will appear here...</span>';
    };

    window.vmsAiSendOutputToChat = function() {
        const output = document.getElementById('vaiOutputBox');
        if (!output) return;
        const text = output.innerText || output.textContent;
        if (!text.trim() || text.includes('will appear here')) return;
        window.vmsAiSwitchTab('chat');
        const input = document.getElementById('vaiChatInput');
        if (input) { input.value = 'About this: ' + text.substring(0, 120) + '…'; }
    };

    // ─── Bind Events ─────────────────────────────────────────
    function bindEvents() {
        // Close on Escape key
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') window.vmsAiClose();
        });
    }

})();
