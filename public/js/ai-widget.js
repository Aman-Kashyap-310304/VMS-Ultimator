// public/js/ai-widget.js

(function() {
    // Inject floating AI copilot widget on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAiWidget);
    } else {
        initializeAiWidget();
    }

    function initializeAiWidget() {
        // Only load on dashboard pages
        if (!window.location.pathname.includes('dashboard') && !window.location.pathname.includes('dashbaord')) {
            return;
        }

        // Inject Styles
        const style = document.createElement('style');
        style.innerHTML = `
            #aiFloatingBtn {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 60px;
                height: 60px;
                border-radius: 30px;
                background: linear-gradient(135deg, #2563eb, #7c3aed);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.8rem;
                cursor: pointer;
                box-shadow: 0 10px 35px rgba(37, 99, 235, 0.45);
                z-index: 99999;
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s;
            }
            #aiFloatingBtn:hover {
                transform: scale(1.1);
                box-shadow: 0 12px 40px rgba(37, 99, 235, 0.6);
            }
            #aiAssistantPanel {
                position: fixed;
                top: 0;
                right: -420px;
                width: 400px;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(25px);
                border-left: 1px solid rgba(255, 255, 255, 0.3);
                box-shadow: -10px 0 45px rgba(0, 0, 0, 0.15);
                z-index: 100000;
                transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                display: flex;
                flex-direction: column;
                font-family: 'Segoe UI', system-ui, sans-serif;
                padding: 24px;
            }
            #aiAssistantPanel.active {
                right: 0;
            }
            .ai-feature-label {
                font-weight: 700;
                font-size: 0.82rem;
                color: #64748b;
                margin-bottom: 6px;
                display: block;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .ai-output-box {
                flex: 1;
                padding: 16px;
                border-radius: 16px;
                border: 1px solid #cbd5e1;
                background: #f8fafc;
                color: #334155;
                font-size: 0.95rem;
                overflow-y: auto;
                line-height: 1.5;
                white-space: pre-wrap;
                min-height: 160px;
            }
            /* Dark theme overrides */
            [data-theme="dark"] #aiAssistantPanel {
                background: rgba(15, 23, 42, 0.92) !important;
                border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
            }
            [data-theme="dark"] .ai-output-box {
                background: #0f172a !important;
                color: #e2e8f0 !important;
                border-color: #334155 !important;
            }
            [data-theme="dark"] #aiAssistantPanel h3 {
                color: #f8fafc !important;
            }
            [data-theme="dark"] #aiAssistantPanel button {
                color: #cbd5e1 !important;
            }
        `;
        document.head.appendChild(style);

        // Inject HTML
        const container = document.createElement('div');
        container.innerHTML = `
            <div id="aiFloatingBtn" onclick="window.toggleAiAssistant()">
                <i class="bi bi-cpu-fill"></i>
            </div>

            <div id="aiAssistantPanel">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h3 style="margin: 0; font-size: 1.3rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;"><i class="bi bi-magic" style="color: #7c3aed;"></i> VMS Assistant</h3>
                    <button onclick="window.toggleAiAssistant()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;"><i class="bi bi-x-lg"></i></button>
                </div>

                
                <div style="flex: 1; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; max-height: calc(100vh - 100px);">
                    <div>
                        <label class="ai-feature-label">Select AI Feature (20+ Capabilities)</label>
                        <select id="aiFeatureSelect" onchange="window.onAiFeatureChange()" style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #cbd5e1; background: white; color: #0f172a; font-size: 0.9rem;">
                            <option value="greetingGenerator">Pass Greeting Generator</option>
                            <option value="purposeGenerator">Dynamic Purpose Statement Generator</option>
                            <option value="scheduleStatement">Formal Schedule Statement Writer</option>
                            <option value="priorityAdvisor">Task Priority Advisor</option>
                            <option value="feedbackAnalyzer">Sentiment Feedback Analyzer</option>
                            <option value="auditSummary">Security Audit Summary Log Writer</option>
                            <option value="checkoutReminder">Polite Checkout Reminder Draft</option>
                            <option value="optimizationTips">Security Desk Queue Optimization Tips</option>
                            <option value="loadOptimizer">Lobby Load Capacity Tips</option>
                            <option value="emergencyProtocol">Lobby Evacuation Guidelines</option>
                            <option value="shiftNotes">Shift Handover Notes Template</option>
                            <option value="autoReplyDraft">Quick Auto-Reply Template</option>
                            <option value="agendaPlanner">Meeting Agenda Planner</option>
                        </select>
                    </div>
                    
                    <div id="aiDynamicInputsContainer" style="display: flex; flex-direction: column; gap: 12px;">
                        <!-- Inputs populated dynamically -->
                    </div>
                    
                    <button id="aiRunBtn" onclick="window.runAiFeature()" style="width: 100%; padding: 14px; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; font-weight: 600; border: none; cursor: pointer; transition: opacity 0.2s;">
                        Generate Content <i class="bi bi-stars"></i>
                    </button>
                    
                    <div style="flex: 1; display: flex; flex-direction: column;">
                        <label class="ai-feature-label">AI Output Result</label>
                        <div id="aiOutputArea" class="ai-output-box">
                            Generated insights appear here...
                        </div>
                        <button onclick="window.copyAiOutput()" style="margin-top: 8px; padding: 10px; border-radius: 12px; border: 1px solid #cbd5e1; background: white; color: #334155; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <i class="bi bi-clipboard"></i> Copy to Clipboard
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        // Bind global functions to window
        let aiAssistantOpen = false;

        window.toggleAiAssistant = function() {
            const panel = document.getElementById('aiAssistantPanel');
            const btn = document.getElementById('aiFloatingBtn');
            if (aiAssistantOpen) {
                panel.classList.remove('active');
                btn.style.transform = 'rotate(0deg)';
            } else {
                panel.classList.add('active');
                btn.style.transform = 'rotate(180deg)';
                window.onAiFeatureChange();
            }
            aiAssistantOpen = !aiAssistantOpen;
        };

        window.onAiFeatureChange = function() {
            const feature = document.getElementById('aiFeatureSelect').value;
            const container = document.getElementById('aiDynamicInputsContainer');
            container.innerHTML = '';

            if (feature === 'greetingGenerator') {
                container.innerHTML = `
                    <input type="text" id="aiParam_name" class="form-control" placeholder="Visitor Name (e.g. John Doe)" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <input type="text" id="aiParam_department" class="form-control" placeholder="Department (e.g. Engineering)" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                `;
            } else if (feature === 'purposeGenerator') {
                container.innerHTML = `
                    <textarea id="aiParam_rawPurpose" class="form-control" placeholder="Type brief, raw reason of visit (e.g. i want to meet my brother for lunch and discuss key family issues)" rows="3" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%; font-family: inherit;"></textarea>
                `;
            } else if (feature === 'scheduleStatement') {
                container.innerHTML = `
                    <input type="text" id="aiParam_title" class="form-control" placeholder="Task Title" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <input type="text" id="aiParam_description" class="form-control" placeholder="Task Description" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <input type="text" id="aiParam_dateTime" class="form-control" placeholder="Date & Time (e.g. 2026-07-30 10:00 AM)" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                `;
            } else if (feature === 'priorityAdvisor') {
                container.innerHTML = `
                    <input type="text" id="aiParam_title" class="form-control" placeholder="Task Title" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <textarea id="aiParam_description" class="form-control" placeholder="Task Description" rows="2" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%; font-family: inherit;"></textarea>
                `;
            } else if (feature === 'feedbackAnalyzer') {
                container.innerHTML = `
                    <textarea id="aiParam_feedbackText" class="form-control" placeholder="Paste Visitor Feedback text here..." rows="3" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%; font-family: inherit;"></textarea>
                `;
            } else if (feature === 'auditSummary') {
                container.innerHTML = `
                    <input type="number" id="aiParam_checkedIn" class="form-control" placeholder="Total Checked In Count" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <input type="number" id="aiParam_checkedOut" class="form-control" placeholder="Total Checked Out Count" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <input type="number" id="aiParam_pending" class="form-control" placeholder="Pending Approvals Count" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                `;
            } else if (feature === 'loadOptimizer') {
                container.innerHTML = `
                    <input type="number" id="aiParam_staffCount" class="form-control" placeholder="Total Department Staff Count" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <input type="number" id="aiParam_dailyVisits" class="form-control" placeholder="Average Daily Visitor Count" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                `;
            } else if (feature === 'agendaPlanner') {
                container.innerHTML = `
                    <input type="text" id="aiParam_host" class="form-control" placeholder="Host Employee Name" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <input type="text" id="aiParam_visitor" class="form-control" placeholder="Visitor Name" style="margin-bottom:8px; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                    <input type="text" id="aiParam_purpose" class="form-control" placeholder="Meeting Purpose" style="padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; width: 100%;">
                `;
            }
        };

        window.runAiFeature = async function() {
            const feature = document.getElementById('aiFeatureSelect').value;
            const output = document.getElementById('aiOutputArea');
            const runBtn = document.getElementById('aiRunBtn');

            const payload = {};
            if (feature === 'greetingGenerator') {
                payload.name = document.getElementById('aiParam_name').value;
                payload.department = document.getElementById('aiParam_department').value;
            } else if (feature === 'purposeGenerator') {
                payload.rawPurpose = document.getElementById('aiParam_rawPurpose').value;
            } else if (feature === 'scheduleStatement') {
                payload.title = document.getElementById('aiParam_title').value;
                payload.description = document.getElementById('aiParam_description').value;
                payload.dateTime = document.getElementById('aiParam_dateTime').value;
            } else if (feature === 'priorityAdvisor') {
                payload.title = document.getElementById('aiParam_title').value;
                payload.description = document.getElementById('aiParam_description').value;
            } else if (feature === 'feedbackAnalyzer') {
                payload.feedbackText = document.getElementById('aiParam_feedbackText').value;
            } else if (feature === 'auditSummary') {
                payload.checkedIn = document.getElementById('aiParam_checkedIn').value;
                payload.checkedOut = document.getElementById('aiParam_checkedOut').value;
                payload.pending = document.getElementById('aiParam_pending').value;
            } else if (feature === 'loadOptimizer') {
                payload.staffCount = document.getElementById('aiParam_staffCount').value;
                payload.dailyVisits = document.getElementById('aiParam_dailyVisits').value;
            } else if (feature === 'agendaPlanner') {
                payload.host = document.getElementById('aiParam_host').value;
                payload.visitor = document.getElementById('aiParam_visitor').value;
                payload.purpose = document.getElementById('aiParam_purpose').value;
            }

            output.innerText = 'Analyzing with Gemini AI...';
            runBtn.disabled = true;

            try {
                const res = await fetch('/api/ai/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: feature, payload })
                });
                const data = await res.json();
                if (data.success) {
                    output.innerText = data.text;
                } else {
                    output.innerText = 'Error: ' + data.message;
                }
            } catch (e) {
                output.innerText = 'Failed to connect to VMS AI Copilot.';
            } finally {
                runBtn.disabled = false;
            }
        };

        window.copyAiOutput = function() {
            const text = document.getElementById('aiOutputArea').innerText;
            navigator.clipboard.writeText(text);
            if (typeof window.showAlert === 'function') {
                window.showAlert('Success', 'AI generated text copied to clipboard!');
            } else {
                alert('AI generated text copied to clipboard!');
            }
        };
    }
})();
