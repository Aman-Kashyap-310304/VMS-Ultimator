// public/js/custom-dialogs.js

(function() {
    // Inject custom modal styles
    const css = `
        .custom-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            opacity: 0;
            transition: opacity 0.2s ease-out;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }
        .custom-dialog-overlay.active {
            opacity: 1;
        }
        .custom-dialog-box {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.25);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
            border-radius: 20px;
            width: 90%;
            max-width: 420px;
            padding: 24px;
            text-align: center;
            transform: scale(0.92);
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .custom-dialog-overlay.active .custom-dialog-box {
            transform: scale(1);
        }
        .custom-dialog-icon {
            font-size: 3rem;
            margin-bottom: 12px;
            color: #2563eb;
        }
        .custom-dialog-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
        }
        .custom-dialog-text {
            font-size: 0.95rem;
            color: #475569;
            margin-bottom: 24px;
            line-height: 1.5;
        }
        .custom-dialog-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
        }
        .custom-dialog-btn {
            padding: 10px 20px;
            font-size: 0.9rem;
            font-weight: 600;
            border-radius: 12px;
            cursor: pointer;
            border: none;
            transition: background-color 0.2s, transform 0.1s;
        }
        .custom-dialog-btn:active {
            transform: scale(0.97);
        }
        .custom-dialog-btn-primary {
            background: #2563eb;
            color: white;
            flex: 1;
        }
        .custom-dialog-btn-primary:hover {
            background: #1d4ed8;
        }
        .custom-dialog-btn-secondary {
            background: #e2e8f0;
            color: #475569;
            flex: 1;
        }
        .custom-dialog-btn-secondary:hover {
            background: #cbd5e1;
        }
        /* Dark mode support */
        [data-theme="dark"] .custom-dialog-box {
            background: rgba(30, 41, 59, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        [data-theme="dark"] .custom-dialog-title {
            color: #f8fafc;
        }
        [data-theme="dark"] .custom-dialog-text {
            color: #cbd5e1;
        }
        [data-theme="dark"] .custom-dialog-btn-secondary {
            background: #334155;
            color: #cbd5e1;
        }
        [data-theme="dark"] .custom-dialog-btn-secondary:hover {
            background: #475569;
        }
    `;

    // Wait for DOM to be ready to inject styles
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
    }

    // Override native alert
    window.alert = function(message, title = "Notification") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';
            overlay.innerHTML = `
                <div class="custom-dialog-box">
                    <div class="custom-dialog-icon"><i class="bi bi-info-circle-fill"></i></div>
                    <div class="custom-dialog-title">${title}</div>
                    <div class="custom-dialog-text">${message}</div>
                    <div class="custom-dialog-buttons">
                        <button class="custom-dialog-btn custom-dialog-btn-primary" id="custom-dialog-ok">OK</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('active'), 10);

            document.getElementById('custom-dialog-ok').onclick = function() {
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 200);
            };
        });
    };

    // Define custom confirm (promise-based)
    window.customConfirm = function(message, title = "Are you sure?") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';
            overlay.innerHTML = `
                <div class="custom-dialog-box">
                    <div class="custom-dialog-icon"><i class="bi bi-exclamation-triangle-fill" style="color: #d97706;"></i></div>
                    <div class="custom-dialog-title">${title}</div>
                    <div class="custom-dialog-text">${message}</div>
                    <div class="custom-dialog-buttons">
                        <button class="custom-dialog-btn custom-dialog-btn-secondary" id="custom-dialog-cancel">Cancel</button>
                        <button class="custom-dialog-btn custom-dialog-btn-primary" id="custom-dialog-confirm">Yes</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('active'), 10);

            document.getElementById('custom-dialog-cancel').onclick = function() {
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    resolve(false);
                }, 200);
            };

            document.getElementById('custom-dialog-confirm').onclick = function() {
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    resolve(true);
                }, 200);
            };
        });
    };

    // Override the native confirm with a friendly console notice or fallback
    // Since native confirm is synchronous, we keep it as a fallback but recommend customConfirm
    const nativeConfirm = window.confirm;
    window.confirm = function(message) {
        console.warn("Native confirm() called. Please use window.customConfirm() which returns a Promise.");
        return nativeConfirm(message);
    };

    // Custom prompt override
    window.customPrompt = function(message, title = "Input Required", defaultValue = "") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-dialog-overlay';
            overlay.innerHTML = `
                <div class="custom-dialog-box" style="max-width: 440px;">
                    <div class="custom-dialog-icon"><i class="bi bi-question-circle-fill" style="color: #7c3aed;"></i></div>
                    <div class="custom-dialog-title">${title}</div>
                    <div class="custom-dialog-text">${message}</div>
                    <div style="margin-bottom: 20px;">
                        <input type="text" id="custom-dialog-input" class="form-control" value="${defaultValue}" style="width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 0.95rem; outline: none; background: #fff; color: #000;" autocomplete="off">
                    </div>
                    <div class="custom-dialog-buttons">
                        <button class="custom-dialog-btn custom-dialog-btn-secondary" id="custom-dialog-cancel" style="flex:1;">Cancel</button>
                        <button class="custom-dialog-btn custom-dialog-btn-primary" id="custom-dialog-submit" style="flex:1; background: #7c3aed;">Submit</button>
                    </div>
                </div>
            `;
            const inputStyle = document.createElement('style');
            inputStyle.innerHTML = `
                [data-theme="dark"] #custom-dialog-input {
                    background: #1e293b !important;
                    color: #f8fafc !important;
                    border-color: #475569 !important;
                }
            `;
            overlay.appendChild(inputStyle);
            document.body.appendChild(overlay);
            
            const input = document.getElementById('custom-dialog-input');
            input.focus();
            input.select();

            input.onkeydown = function(e) {
                if (e.key === 'Enter') {
                    document.getElementById('custom-dialog-submit').click();
                }
            };

            setTimeout(() => overlay.classList.add('active'), 10);

            document.getElementById('custom-dialog-cancel').onclick = function() {
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    resolve(null);
                }, 200);
            };

            document.getElementById('custom-dialog-submit').onclick = function() {
                const val = input.value;
                overlay.classList.remove('active');
                setTimeout(() => {
                    overlay.remove();
                    resolve(val);
                }, 200);
            };
        });
    };
})();
