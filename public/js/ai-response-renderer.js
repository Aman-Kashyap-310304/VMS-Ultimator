/**
 * ============================================================
 * VMS Ultra Pro — AI Response Renderer
 * public/js/ai-response-renderer.js
 *
 * Parses AI markdown + injects safe HTML/CSS/JS, renders:
 * - Bold, italic, strikethrough, inline code
 * - Headings (h1–h4), horizontal rules
 * - Ordered & unordered lists (nested)
 * - Blockquotes
 * - Fenced code blocks with syntax highlight + copy button
 * - Tables
 * - Hyperlinks (secure, target="_blank")
 * - [ACTION:label:event] → Dynamic buttons that fire VMS events
 * - [NAV:label:url]      → Navigation buttons
 * - [COPY:label:text]    → Copy-to-clipboard buttons
 * ============================================================
 */

(function VMSRenderer() {
    'use strict';

    // ─── VMS Action Button Registry ──────────────────────────
    const ACTION_HANDLERS = {};

    /**
     * Register a named VMS action that AI can trigger via [ACTION:label:eventName]
     * @param {string} eventName
     * @param {function} handler
     */
    window.VMSAIRegister = function(eventName, handler) {
        ACTION_HANDLERS[eventName] = handler;
    };

    // ─── Core Markdown Parser ────────────────────────────────

    /**
     * Escape HTML entities to prevent XSS from raw text nodes
     */
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Parse inline markdown elements:
     * bold, italic, strikethrough, inline code, links, VMS action tokens
     */
    function parseInline(text) {
        // VMS Dynamic Action: [ACTION:Button Label:eventName]
        text = text.replace(/\[ACTION:([^\]|:]+):([^\]]+)\]/g, (_, label, eventName) => {
            return `<button class="vms-ai-action-btn" onclick="window.VMSAIDispatch('${escapeHtml(eventName.trim())}', this)" data-event="${escapeHtml(eventName.trim())}">
                        <i class="bi bi-lightning-fill"></i> ${escapeHtml(label.trim())}
                    </button>`;
        });

        // VMS Navigation Button: [NAV:Button Label:url]
        text = text.replace(/\[NAV:([^\]|:]+):([^\]]+)\]/g, (_, label, url) => {
            const safeUrl = url.trim().startsWith('http') ? url.trim() : '#';
            return `<a class="vms-ai-nav-btn" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">
                        <i class="bi bi-arrow-up-right-circle-fill"></i> ${escapeHtml(label.trim())}
                    </a>`;
        });

        // VMS Copy Button: [COPY:Button Label:text to copy]
        text = text.replace(/\[COPY:([^\]|:]+):([^\]]+)\]/g, (_, label, copyText) => {
            const encoded = btoa(unescape(encodeURIComponent(copyText.trim())));
            return `<button class="vms-ai-copy-btn" onclick="window.VMSAICopy('${encoded}', this)">
                        <i class="bi bi-clipboard2-fill"></i> ${escapeHtml(label.trim())}
                    </button>`;
        });

        // Bold + Italic: ***text***
        text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

        // Bold: **text**
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic: *text* or _text_
        text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        text = text.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>');

        // Strikethrough: ~~text~~
        text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Inline code: `code`
        text = text.replace(/`([^`]+)`/g, '<code class="vms-inline-code">$1</code>');

        // Markdown links: [label](url)
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
            const safeUrl = url.startsWith('http') ? url : '#';
            return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="vms-ai-link">${escapeHtml(label)}</a>`;
        });

        return text;
    }

    /**
     * Full markdown → HTML converter
     */
    function parseMarkdown(md) {
        if (!md || typeof md !== 'string') return '';

        const lines = md.split('\n');
        const html = [];
        let i = 0;
        let inList = null; // 'ul' | 'ol' | null
        let listDepth = 0;
        let inBlockquote = false;
        let inTable = false;

        function closeLists() {
            while (listDepth > 0) {
                html.push(`</${inList}>`);
                listDepth--;
            }
            inList = null;
        }

        function closeBlockquote() {
            if (inBlockquote) { html.push('</blockquote>'); inBlockquote = false; }
        }

        function closeTable() {
            if (inTable) { html.push('</tbody></table>'); inTable = false; }
        }

        while (i < lines.length) {
            const raw = lines[i];
            const line = raw.trimEnd();

            // ── Fenced code block ──────────────────────────────
            if (/^```/.test(line)) {
                closeLists(); closeBlockquote(); closeTable();
                const lang = line.slice(3).trim() || 'text';
                const codeLines = [];
                i++;
                while (i < lines.length && !/^```/.test(lines[i])) {
                    codeLines.push(lines[i]);
                    i++;
                }
                const codeId = 'vms-code-' + Math.random().toString(36).slice(2,8);
                const codeContent = escapeHtml(codeLines.join('\n'));
                html.push(`
                    <div class="vms-code-block">
                        <div class="vms-code-header">
                            <span class="vms-code-lang">${lang}</span>
                            <button class="vms-code-copy" onclick="window.VMSAICopyCode('${codeId}')">
                                <i class="bi bi-clipboard2"></i> Copy
                            </button>
                        </div>
                        <pre id="${codeId}"><code class="lang-${lang}">${codeContent}</code></pre>
                    </div>`);
                i++;
                continue;
            }

            // ── Horizontal rule ────────────────────────────────
            if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
                closeLists(); closeBlockquote(); closeTable();
                html.push('<hr class="vms-ai-hr">');
                i++; continue;
            }

            // ── Headings ────────────────────────────────────────
            const heading = line.match(/^(#{1,4})\s+(.+)$/);
            if (heading) {
                closeLists(); closeBlockquote(); closeTable();
                const level = heading[1].length;
                html.push(`<h${level} class="vms-ai-h${level}">${parseInline(heading[2])}</h${level}>`);
                i++; continue;
            }

            // ── Table ────────────────────────────────────────────
            if (line.includes('|') && lines[i+1] && /^\|?\s*[-:]+/.test(lines[i+1])) {
                closeLists(); closeBlockquote();
                if (!inTable) {
                    html.push('<div class="vms-table-wrap"><table class="vms-ai-table"><thead><tr>');
                    const headers = line.split('|').filter(c => c.trim());
                    headers.forEach(h => html.push(`<th>${parseInline(h.trim())}</th>`));
                    html.push('</tr></thead><tbody>');
                    inTable = true;
                    i += 2; // skip separator row
                    continue;
                }
            }

            if (inTable && line.includes('|')) {
                html.push('<tr>');
                const cells = line.split('|').filter(c => c.trim());
                cells.forEach(c => html.push(`<td>${parseInline(c.trim())}</td>`));
                html.push('</tr>');
                i++; continue;
            } else if (inTable) {
                closeTable();
            }

            // ── Blockquote ────────────────────────────────────
            if (line.startsWith('> ')) {
                closeLists();
                if (!inBlockquote) { html.push('<blockquote class="vms-ai-blockquote">'); inBlockquote = true; }
                html.push(`<p>${parseInline(line.slice(2))}</p>`);
                i++; continue;
            } else {
                closeBlockquote();
            }

            // ── Unordered list ────────────────────────────────
            const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
            if (ulMatch) {
                closeTable();
                if (inList !== 'ul') {
                    closeLists();
                    html.push('<ul class="vms-ai-ul">');
                    inList = 'ul';
                    listDepth = 1;
                }
                html.push(`<li>${parseInline(ulMatch[2])}</li>`);
                i++; continue;
            }

            // ── Ordered list ───────────────────────────────────
            const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
            if (olMatch) {
                closeTable();
                if (inList !== 'ol') {
                    closeLists();
                    html.push('<ol class="vms-ai-ol">');
                    inList = 'ol';
                    listDepth = 1;
                }
                html.push(`<li>${parseInline(olMatch[2])}</li>`);
                i++; continue;
            }

            // ── Empty line ─────────────────────────────────────
            if (line.trim() === '') {
                closeLists(); closeTable();
                i++; continue;
            }

            // ── Paragraph ──────────────────────────────────────
            closeLists(); closeTable();
            html.push(`<p class="vms-ai-p">${parseInline(line)}</p>`);
            i++;
        }

        closeLists(); closeBlockquote(); closeTable();
        return html.join('\n');
    }

    // ─── Public API ──────────────────────────────────────────

    /**
     * Render markdown into a DOM element
     * @param {string} markdown  - Raw AI text response
     * @param {HTMLElement} el   - Target DOM element to render into
     */
    window.VMSRender = function(markdown, el) {
        if (!el) return;
        el.innerHTML = parseMarkdown(markdown);
        el.classList.add('vms-ai-rendered');
    };

    /**
     * Dispatch a VMS action triggered by an AI button
     */
    window.VMSAIDispatch = function(eventName, btn) {
        if (ACTION_HANDLERS[eventName]) {
            ACTION_HANDLERS[eventName](btn);
        } else {
            // Fire as custom DOM event for page-level listeners
            document.dispatchEvent(new CustomEvent('vms:ai:action', { detail: { eventName, btn } }));
        }
    };

    /**
     * Copy encoded text to clipboard
     */
    window.VMSAICopy = function(encoded, btn) {
        try {
            const text = decodeURIComponent(escape(atob(encoded)));
            navigator.clipboard.writeText(text).then(() => {
                btn.innerHTML = '<i class="bi bi-check2"></i> Copied!';
                setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard2-fill"></i> Copy'; }, 2000);
            });
        } catch(e) {}
    };

    /**
     * Copy code block content to clipboard
     */
    window.VMSAICopyCode = function(codeId) {
        const el = document.getElementById(codeId);
        if (!el) return;
        navigator.clipboard.writeText(el.innerText).then(() => {
            const btn = el.closest('.vms-code-block')?.querySelector('.vms-code-copy');
            if (btn) {
                btn.innerHTML = '<i class="bi bi-check2"></i> Copied!';
                setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard2"></i> Copy'; }, 2000);
            }
        });
    };

    // ─── Inject Renderer Styles ─────────────────────────────

    function injectStyles() {
        if (document.getElementById('vms-renderer-css')) return;
        const style = document.createElement('style');
        style.id = 'vms-renderer-css';
        style.textContent = `
            /* Base container */
            .vms-ai-rendered {
                font-family: 'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif;
                font-size: 14px;
                line-height: 1.75;
                color: var(--text, #334155);
                word-break: break-word;
            }

            /* Headings */
            .vms-ai-h1 { font-size: 1.5em; font-weight: 800; color: var(--dark, #0f172a); margin: 1.2em 0 0.5em; border-bottom: 2px solid var(--primary, #2563eb); padding-bottom: 4px; }
            .vms-ai-h2 { font-size: 1.25em; font-weight: 700; color: var(--dark, #0f172a); margin: 1em 0 0.4em; }
            .vms-ai-h3 { font-size: 1.1em; font-weight: 700; color: var(--secondary, #7c3aed); margin: 0.9em 0 0.4em; }
            .vms-ai-h4 { font-size: 1em; font-weight: 600; margin: 0.8em 0 0.3em; }

            /* Paragraphs */
            .vms-ai-p { margin: 0.5em 0; }

            /* Lists */
            .vms-ai-ul, .vms-ai-ol { padding-left: 1.5em; margin: 0.5em 0; }
            .vms-ai-ul li, .vms-ai-ol li { margin: 0.25em 0; }
            .vms-ai-ul { list-style-type: disc; }
            .vms-ai-ol { list-style-type: decimal; }

            /* Blockquote */
            .vms-ai-blockquote {
                border-left: 4px solid var(--primary, #2563eb);
                background: rgba(37,99,235,0.06);
                margin: 0.75em 0;
                padding: 10px 16px;
                border-radius: 0 8px 8px 0;
                font-style: italic;
                color: var(--text, #334155);
            }

            /* Inline code */
            .vms-inline-code {
                background: rgba(37,99,235,0.1);
                color: var(--secondary, #7c3aed);
                padding: 1px 6px;
                border-radius: 4px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 0.88em;
            }

            /* Code block */
            .vms-code-block {
                background: #0f172a;
                border-radius: 12px;
                margin: 0.75em 0;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.06);
            }
            .vms-code-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 14px;
                background: rgba(255,255,255,0.06);
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .vms-code-lang {
                font-size: 11px;
                font-weight: 700;
                color: #7c3aed;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .vms-code-copy {
                background: none;
                border: 1px solid rgba(255,255,255,0.15);
                color: #94a3b8;
                padding: 3px 10px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 5px;
                transition: all 0.2s;
            }
            .vms-code-copy:hover { background: rgba(255,255,255,0.1); color: #fff; }
            .vms-code-block pre {
                margin: 0;
                padding: 14px 16px;
                overflow-x: auto;
                color: #e2e8f0;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.6;
            }

            /* Tables */
            .vms-table-wrap { overflow-x: auto; margin: 0.75em 0; border-radius: 10px; border: 1px solid var(--border, #e2e8f0); }
            .vms-ai-table { width: 100%; border-collapse: collapse; min-width: 400px; }
            .vms-ai-table th {
                background: var(--primary, #2563eb);
                color: #fff;
                padding: 10px 14px;
                text-align: left;
                font-size: 13px;
                font-weight: 600;
            }
            .vms-ai-table td {
                padding: 9px 14px;
                border-bottom: 1px solid var(--border, #e2e8f0);
                font-size: 13px;
                color: var(--text, #334155);
            }
            .vms-ai-table tr:last-child td { border-bottom: none; }
            .vms-ai-table tr:hover td { background: rgba(37,99,235,0.04); }

            /* Links */
            .vms-ai-link {
                color: var(--primary, #2563eb);
                text-decoration: underline;
                text-underline-offset: 3px;
                font-weight: 500;
            }
            .vms-ai-link:hover { color: var(--secondary, #7c3aed); }

            /* HR */
            .vms-ai-hr { border: none; border-top: 1.5px solid var(--border, #e2e8f0); margin: 1em 0; }

            /* Dynamic Action Buttons */
            .vms-ai-action-btn {
                display: inline-flex; align-items: center; gap: 6px;
                background: linear-gradient(135deg, var(--primary, #2563eb), var(--secondary, #7c3aed));
                color: #fff; border: none; padding: 7px 14px; border-radius: 8px;
                font-size: 13px; font-weight: 600; cursor: pointer;
                margin: 4px 4px 4px 0;
                transition: transform 0.15s, box-shadow 0.15s;
                box-shadow: 0 2px 8px rgba(37,99,235,0.3);
            }
            .vms-ai-action-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(37,99,235,0.4); }

            /* Copy buttons */
            .vms-ai-copy-btn {
                display: inline-flex; align-items: center; gap: 6px;
                background: rgba(37,99,235,0.1); color: var(--primary, #2563eb);
                border: 1px solid rgba(37,99,235,0.25); padding: 5px 12px;
                border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;
                margin: 4px 4px 4px 0; transition: all 0.2s;
            }
            .vms-ai-copy-btn:hover { background: rgba(37,99,235,0.2); }

            /* Nav buttons */
            .vms-ai-nav-btn {
                display: inline-flex; align-items: center; gap: 6px;
                background: rgba(16,163,74,0.1); color: #16a34a;
                border: 1px solid rgba(16,163,74,0.25); padding: 5px 12px;
                border-radius: 8px; font-size: 12px; font-weight: 600;
                text-decoration: none; margin: 4px 4px 4px 0; transition: all 0.2s;
            }
            .vms-ai-nav-btn:hover { background: rgba(16,163,74,0.2); }

            /* Dark mode adjustments */
            [data-theme="dark"] .vms-ai-rendered { color: #e2e8f0; }
            [data-theme="dark"] .vms-ai-h1,
            [data-theme="dark"] .vms-ai-h2,
            [data-theme="dark"] .vms-ai-h4 { color: #f1f5f9; }
            [data-theme="dark"] .vms-ai-table td { color: #e2e8f0; border-color: #334155; }
            [data-theme="dark"] .vms-ai-table tr:hover td { background: rgba(255,255,255,0.04); }
            [data-theme="dark"] .vms-table-wrap { border-color: #334155; }
            [data-theme="dark"] .vms-ai-blockquote { background: rgba(37,99,235,0.12); }
            [data-theme="dark"] .vms-ai-hr { border-color: #334155; }
            [data-theme="dark"] .vms-inline-code { background: rgba(124,58,237,0.15); }
        `;
        document.head.appendChild(style);
    }

    // ─── Init ────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }

})();
