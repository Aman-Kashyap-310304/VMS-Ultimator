/**
 * ============================================================
 * VMS Ultra Pro — Backend Auto-Wakeup & Cross-Domain API Bridge
 * public/js/vms-backend-wakeup.js
 *
 * Features:
 * - Detects execution environment (Localhost vs Render vs GitHub Pages)
 * - Intercepts relative `/api/...` calls on GitHub Pages & redirects to Render Backend
 * - Pings `/health` on page load to spin up Render free tier if sleeping
 * - Displays a sleek, non-intrusive toast while Render is waking up
 * ============================================================
 */

(function VMSBackendBridge() {
    'use strict';

    const RENDER_BACKEND_URL = 'https://vms-ultimator.onrender.com';
    const hostname = window.location.hostname;

    // Is running locally or directly on Render backend?
    const isSameHostBackend = hostname === 'localhost' ||
                              hostname === '127.0.0.1' ||
                              hostname.endsWith('onrender.com');

    // Set global API base URL
    window.VMS_API_BASE = isSameHostBackend ? '' : RENDER_BACKEND_URL;

    // Intercept window.fetch to route `/api/...` to Render backend when hosted on GitHub Pages or external hosts
    const nativeFetch = window.fetch;
    window.fetch = function(input, init) {
        let url = input;
        if (typeof input === 'string') {
            if (input.startsWith('/api/')) {
                url = window.VMS_API_BASE + input;
            }
        } else if (input instanceof Request) {
            if (input.url.startsWith('/') && input.url.includes('/api/')) {
                url = new Request(window.VMS_API_BASE + input.url, input);
            }
        }
        return nativeFetch.call(this, url, init);
    };

    // Wakeup signal for Render backend
    function wakeupRender() {
        const healthEndpoint = (window.VMS_API_BASE || RENDER_BACKEND_URL) + '/health';
        let wakeupToast = null;

        // Show toast if server takes more than 1.2s to respond (Render sleeping)
        const toastTimer = setTimeout(() => {
            if (document.getElementById('vms-wakeup-toast')) return;
            wakeupToast = document.createElement('div');
            wakeupToast.id = 'vms-wakeup-toast';
            wakeupToast.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="vms-spinner"></div>
                    <div>
                        <div style="font-weight:700;font-size:13px;color:#fff;">Connecting to VMS Backend…</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.85);">Spinning up Render cloud server</div>
                    </div>
                </div>
            `;
            wakeupToast.style.cssText = `
                position: fixed; top: 18px; right: 18px; z-index: 9999999;
                background: linear-gradient(135deg, #2563eb, #7c3aed);
                padding: 12px 18px; border-radius: 12px;
                box-shadow: 0 10px 30px rgba(37,99,235,0.4);
                font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 0; transform: translateY(-10px);
            `;
            document.body.appendChild(wakeupToast);
            requestAnimationFrame(() => {
                wakeupToast.style.opacity = '1';
                wakeupToast.style.transform = 'translateY(0)';
            });

            // Inject spinner animation style if missing
            if (!document.getElementById('vms-spinner-css')) {
                const s = document.createElement('style');
                s.id = 'vms-spinner-css';
                s.textContent = `
                    .vms-spinner {
                        width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.3);
                        border-top-color: #fff; border-radius: 50%;
                        animation: vmsSpin 0.8s linear infinite;
                    }
                    @keyframes vmsSpin { to { transform: rotate(360deg); } }
                `;
                document.head.appendChild(s);
            }
        }, 1200);

        nativeFetch(healthEndpoint)
            .then(res => res.json())
            .then(data => {
                clearTimeout(toastTimer);
                if (wakeupToast) {
                    wakeupToast.style.background = 'linear-gradient(135deg, #16a34a, #059669)';
                    wakeupToast.innerHTML = `
                        <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#fff;">
                            <span>✅</span> VMS Server Online & Connected!
                        </div>
                    `;
                    setTimeout(() => {
                        wakeupToast.style.opacity = '0';
                        wakeupToast.style.transform = 'translateY(-10px)';
                        setTimeout(() => wakeupToast.remove(), 300);
                    }, 1600);
                }
            })
            .catch(err => {
                clearTimeout(toastTimer);
                if (wakeupToast) {
                    wakeupToast.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
                    wakeupToast.innerHTML = `
                        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#fff;">
                            <span>⚠️</span> Retrying backend connection…
                        </div>
                    `;
                    setTimeout(() => wakeupToast.remove(), 4000);
                }
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wakeupRender);
    } else {
        wakeupRender();
    }
})();
