/**
 * ============================================================
 * VMS Ultra Pro — Render Backend Auto-Wakeup
 * public/js/vms-backend-wakeup.js
 *
 * Features:
 * - Pings `/health` on page load to spin up Render free tier if sleeping
 * - Displays a sleek, non-intrusive toast while Render server is waking up
 * ============================================================
 */

(function VMSBackendBridge() {
    'use strict';

    const nativeFetch = window.fetch;

    // Wakeup signal for Render backend
    function wakeupRender() {
        const healthEndpoint = '/health';
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
                        <div style="font-weight:700;font-size:13px;color:#fff;">Connecting to VMS Server…</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.85);">Spinning up cloud backend</div>
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
