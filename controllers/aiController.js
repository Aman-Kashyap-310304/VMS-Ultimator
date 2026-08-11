// controllers/aiController.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * ─── Gemini Model Fallback Strategy ──────────────────────────────────────────
 * Tries from highest model to lowest, downgrading one by one.
 */
async function callGeminiWithFallback(reqData, apiKey) {
    const models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-flash-lite',
        'gemini-flash-latest'
    ];
    let lastError = null;
    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
            const response = await axios.post(url, reqData, { timeout: 60000 });
            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
                console.log(`[Gemini] Successful with model: ${model}`);
                return text;
            }
        } catch (err) {
            console.warn(`[Gemini Fallback] Model ${model} failed:`, err.response?.data?.error?.message || err.message);
            lastError = err;
        }
    }
    throw lastError || new Error('All Gemini models failed');
}

/**
 * ─── SQL Security & RBAC Enforcement ─────────────────────────────────────────
 * Strict role-based access control on what tables and operations are permitted.
 */
function validateAndSanitizeSQL(sql, user) {
    const cleanSql = sql.trim().toLowerCase();
    const role = user?.role || (user?.visitor_id ? 'Visitor' : 'Unknown');

    // Basic syntax — only CRUD allowed, no DDL
    if (!cleanSql.startsWith('select') && !cleanSql.startsWith('insert') &&
        !cleanSql.startsWith('update') && !cleanSql.startsWith('delete')) {
        throw new Error('Only SELECT, INSERT, UPDATE, and DELETE operations are allowed.');
    }

    // Block all DDL
    const ddlKeywords = ['drop ', 'alter ', 'truncate ', 'grant ', 'revoke ', 'create ', 'rename '];
    if (ddlKeywords.some(k => cleanSql.includes(k))) {
        throw new Error('DDL commands are strictly forbidden.');
    }

    // ─── VISITOR: Most restricted ─────────────────────────────────────────────
    if (role === 'Visitor') {
        const visitorEmail = user?.email || '';
        const visitorId = user?.visitor_id || '';
        const visitorDbId = String(user?.id || '');

        // Block all staff and credential tables
        const blockedVisitorTables = ['users', 'deptadmin', 'otps', 'wrong_password_attempt',
            'password_requests', 'department_view_logs', 'schedules'];
        if (blockedVisitorTables.some(t => cleanSql.includes(t))) {
            throw new Error('Access Denied. Visitors cannot access staff or system tables.');
        }

        // Visitors can ONLY read — no writes
        if (!cleanSql.startsWith('select')) {
            throw new Error('Access Denied. Visitors can only perform read operations on their own data.');
        }

        // Must have their own identifier in the query when touching visitor tables
        if (cleanSql.includes('visitors') || cleanSql.includes('visitor_passes')) {
            const hasFilter = (visitorId && cleanSql.includes(visitorId.toLowerCase())) ||
                              (visitorEmail && cleanSql.includes(visitorEmail.toLowerCase())) ||
                              (visitorDbId && cleanSql.includes(visitorDbId));
            if (!hasFilter) {
                throw new Error('Access Denied. You can only query your own visitor records.');
            }
        }
        return sql;
    }

    // ─── EMPLOYEE: Can view own data + department info ────────────────────────
    if (role === 'Employee') {
        const blockedEmpTables = ['otps', 'wrong_password_attempt', 'deptadmin'];
        if (blockedEmpTables.some(t => cleanSql.includes(t))) {
            throw new Error('Access Denied. Employees cannot access credential or admin tables.');
        }
        // Employees cannot do writes on visitor passes or users table
        if (!cleanSql.startsWith('select')) {
            const allowedWriteTargets = ['schedules'];
            if (!allowedWriteTargets.some(t => cleanSql.includes(t))) {
                throw new Error('Access Denied. Employees can only write to their own schedule records.');
            }
        }
        return sql;
    }

    // ─── SECURITY: Can view visitor passes and related data ──────────────────
    if (role === 'Security') {
        const blockedSecTables = ['otps', 'wrong_password_attempt', 'deptadmin', 'users'];
        if (blockedSecTables.some(t => cleanSql.includes(t))) {
            throw new Error('Access Denied. Security cannot access credential tables.');
        }
        // Security can update visitor pass status (check-in/check-out)
        if (!cleanSql.startsWith('select') && !cleanSql.startsWith('update')) {
            throw new Error('Access Denied. Security can only read and update visitor pass records.');
        }
        return sql;
    }

    // ─── DEPTADMIN: Can query department scope, no OTP table ─────────────────
    if (role === 'DeptAdmin') {
        if (cleanSql.includes('otps')) {
            throw new Error('Access Denied. DeptAdmins cannot access temporary OTP table.');
        }
        return sql;
    }

    // ─── ADMIN: Full access (except DDL already blocked above) ───────────────
    return sql;
}

/**
 * Build role-specific system prompt with portal links and photo context
 */
function buildRoleContext(user, userRole, userName) {
    const portalBase = 'https://vms-ultimator.onrender.com';

    const portalLinks = {
        Admin: {
            dashboard: `${portalBase}/admin/dashboard`,
            analytics: `${portalBase}/admin/dashboard#analytics`,
            departments: `${portalBase}/admin/dashboard#departments`,
            deptAdmins: `${portalBase}/admin/dashboard#deptadmins`,
            visitors: `${portalBase}/admin/dashboard#visitors`,
            alerts: `${portalBase}/admin/dashboard#alerts`,
        },
        DeptAdmin: {
            dashboard: `${portalBase}/deptadmin/dashboard`,
            employees: `${portalBase}/deptadmin/dashboard#employees`,
            passes: `${portalBase}/deptadmin/dashboard#passes`,
            schedules: `${portalBase}/deptadmin/dashboard#schedules`,
        },
        Employee: {
            dashboard: `${portalBase}/employee/dashboard`,
            myPasses: `${portalBase}/employee/dashboard#passes`,
            departments: `${portalBase}/employee/dashboard#departments`,
            profile: `${portalBase}/employee/dashboard#profile`,
        },
        Security: {
            dashboard: `${portalBase}/security/dashboard`,
            scanner: `${portalBase}/security/dashboard#scanner`,
            logs: `${portalBase}/security/dashboard#logs`,
        },
        Visitor: {
            dashboard: `${portalBase}/visitor/dashboard`,
            myPasses: `${portalBase}/visitor/dashboard#passes`,
            profile: `${portalBase}/visitor/dashboard#profile`,
        }
    };

    const links = portalLinks[userRole] || portalLinks['Visitor'];
    const linksText = Object.entries(links).map(([k, v]) => `  - ${k}: ${v}`).join('\n');

    // Build photo context if user has a photo
    const photoUrl = user?.photo_url || user?.profile_photo || user?.photo || null;
    const photoContext = photoUrl
        ? `\nUser Photo URL: ${photoUrl} — You may reference this image in responses using: [IMG:${photoUrl}:${userName}'s Profile Photo]`
        : '';

    return `
Active Portal: ${userRole} Dashboard
User: ${userName} | Role: ${userRole}
PortalId/Email/ID: ${user?.portalId || user?.email || user?.visitor_id || 'N/A'}
Department: ${user?.dept || 'N/A'}${photoContext}

Your portal links (use these as absolute URLs in responses):
${linksText}

Navigation tokens you can embed in responses:
- [NAV:Label:${links.dashboard}] — creates a navigation button to the portal page
- [IMG:url:alt text] — renders a user photo or system image inline
- [ACTION:Label:eventName] — triggers a frontend VMS action
- [COPY:Label:text] — creates a copy-to-clipboard button`;
}

/**
 * Build strict RBAC schema context based on role
 */
function buildSchemaContext(userRole, user) {
    const commonSchema = `
Available Database Tables (role-filtered):`;

    const adminSchema = `
- departments (dept_code, dept_name, dept_location, dept_profile)
- visitors (id, visitor_id, full_name, email, contact_number, purpose, company_name, designation, is_blocked, blocked_reason, photo_url)
- visitor_passes (id, visitor_id, pass_number, host_employee_name, host_department, status, check_in_time, check_out_time, pass_pdf_url)
- wrong_password_attempt (alert_id, portal_id, role, timestampt, device_type, ip_address, action_trigger, investigated_by)
- deptAdmin (PortalId, EmpId, Name, Email, Contact, dept, is_blocked, blocked_reason, photo_url)
- users (PortalId, EmpId, Name, Email, Contact, dept, Role, is_blocked, blocked_reason, photo_url)
- schedules (id, portal_id, title, date, time, description, status, remarks)
- password_requests (id, portal_id, role, status, reason)
- visitor_profile_updates (id, visitor_id, old_details, new_details)
- department_view_logs (id, viewer_id, viewer_role, dept_code, viewed_at)
- otps (id, email, otp_code, expires_at, purpose)`;

    const deptAdminSchema = `
- departments (dept_code, dept_name, dept_location, dept_profile)
- visitors (id, visitor_id, full_name, email, contact_number, purpose, company_name, designation, is_blocked, photo_url)
- visitor_passes (id, visitor_id, pass_number, host_employee_name, host_department, status, check_in_time, check_out_time, pass_pdf_url)
- users (PortalId, Name, Email, Contact, dept, Role, is_blocked, photo_url) — your department only
- schedules (id, portal_id, title, date, time, description, status, remarks)
- password_requests (id, portal_id, role, status, reason)
- department_view_logs (id, viewer_id, viewer_role, dept_code, viewed_at)`;

    const employeeSchema = `
- departments (dept_code, dept_name, dept_location, dept_profile) — read only
- visitor_passes (id, pass_number, host_employee_name, host_department, status, check_in_time, check_out_time) — your assigned passes only
- schedules (id, portal_id, title, date, time, description, status, remarks) — your schedules only
NOTE: You CANNOT query users, deptAdmin, wrong_password_attempt, or otps tables.`;

    const securitySchema = `
- visitor_passes (id, visitor_id, pass_number, host_employee_name, host_department, status, check_in_time, check_out_time) — all active passes
- visitors (id, visitor_id, full_name, email, contact_number, purpose, company_name, is_blocked, photo_url) — public visitor info
- departments (dept_code, dept_name, dept_location) — read only
NOTE: You CANNOT query users, deptAdmin, otps, or password tables.`;

    const visitorSchema = `
- visitors (id, visitor_id, full_name, email, contact_number, purpose, company_name, designation, photo_url) — YOUR record only
- visitor_passes (id, pass_number, host_employee_name, host_department, status, check_in_time, check_out_time) — YOUR passes only
- departments (dept_code, dept_name, dept_location) — read only, department listing
NOTE: You CANNOT query users, deptAdmin, schedules, password_requests, or any staff tables.`;

    const schemaMap = {
        Admin: adminSchema,
        DeptAdmin: deptAdminSchema,
        Employee: employeeSchema,
        Security: securitySchema,
        Visitor: visitorSchema
    };

    return commonSchema + (schemaMap[userRole] || visitorSchema);
}

exports.generateContent = async (req, res) => {
    try {
        const { action, payload } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'Gemini AI API Key is not configured on the server.' });
        }

        if (!action || !payload) {
            return res.status(400).json({ success: false, message: 'Action and payload parameters are required.' });
        }

        // ─── Decode Token to Get User Role & Identity for RBAC ───────────────────
        let user = null;
        const authHeader = req.headers.authorization;
        const cookieToken = req.cookies?.admin_token || req.cookies?.deptadmin_token ||
            req.cookies?.employee_token || req.cookies?.security_token || req.cookies?.visitor_token;
        const token = (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || cookieToken;

        if (token) {
            try {
                user = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
            } catch (e) {
                console.warn('JWT verify failed in AI controller:', e.message);
            }
        }

        let userRole = user?.role || (user?.visitor_id ? 'Visitor' : 'Visitor');
        let userName = user?.name || user?.full_name || user?.Name || 'User';

        let prompt = '';

        // ─── Map Actions ────────────────────────────────────────────────────────
        switch (action) {
            case 'summarizeVisitor':
                prompt = `Summarize the following visitor profile and history into a short, elegant paragraph:\nName: ${payload.name}\nEmail: ${payload.email}\nCompany: ${payload.company || 'N/A'}\nDesignation: ${payload.designation || 'N/A'}\nPurpose: ${payload.purpose || 'N/A'}\nTotal past visits: ${payload.visitCount || 0}`;
                break;
            case 'purposeGenerator':
                prompt = `Convert this rough draft of a visitor's visit reason into a professional, concise corporate purpose statement (maximum 10 words): "${payload.rawPurpose}"`;
                break;
            case 'scheduleStatement':
                prompt = `Write a formal, brief work schedule statement for an employee's dashboard:\nTask: ${payload.title}\nDetails: ${payload.description}\nDate/Time: ${payload.dateTime}`;
                break;
            case 'riskPredictor':
                prompt = `Perform a quick security risk assessment based on these details. Return a JSON structure with "level" (Low, Medium, or High) and "reasons" (array of 2 bullet points):\nVisitor Name: ${payload.name}\nCompany: ${payload.company || 'Unknown'}\nPurpose: ${payload.purpose || 'Unknown'}\nSecurity Flag Status: ${payload.isBlocked ? 'BLOCKED' : 'CLEAN'}`;
                break;
            case 'emailDraft':
                prompt = `Draft a brief, professional email to a visitor regarding their request:\nVisitor: ${payload.name}\nStatus: ${payload.status}\nDepartment: ${payload.department}\nTime: ${payload.dateTime}`;
                break;
            case 'priorityAdvisor':
                prompt = `Recommend a priority level (Routine, Urgent, or Critical) and give a 1-sentence explanation:\nTask title: ${payload.title}\nDescription: ${payload.description}`;
                break;
            case 'checkoutReminder':
                prompt = `Write a polite, 2-sentence SMS checkout reminder for a checked-in visitor who has completed their visit.`;
                break;
            case 'optimizationTips':
                prompt = `Provide 3 short, bulleted actionable queue-clearing efficiency tips for a security desk lobby experiencing high visitor traffic.`;
                break;
            case 'feedbackAnalyzer':
                prompt = `Analyze the sentiment (Positive, Neutral, or Negative) and list 2 key improvement keywords from this visitor feedback: "${payload.feedbackText}"`;
                break;
            case 'auditSummary':
                prompt = `Generate a 2-sentence security audit log summary statement for a shift containing:\nTotal Checked In: ${payload.checkedIn || 0}\nTotal Checked Out: ${payload.checkedOut || 0}\nPending Approvals: ${payload.pending || 0}`;
                break;
            case 'loadOptimizer':
                prompt = `Suggest optimal visitor lobby limits and advice for a department with:\nStaff Count: ${payload.staffCount || 0}\nAverage Daily Visits: ${payload.dailyVisits || 0}`;
                break;
            case 'lockoutReasoning':
                prompt = `Analyze this lockout security incident and write a 1-sentence recommendation:\nUser Portal ID: ${payload.portalId}\nFailed Attempts: ${payload.failedAttempts}\nReason: ${payload.reason || 'Multiple wrong passwords'}`;
                break;
            case 'passTranslator':
                prompt = `Translate the following visitor pass details into ${payload.language || 'Spanish'}:\nPass: ${payload.passNumber}\nVisitor: ${payload.name}\nValid Date: ${payload.date}\nDepartment: ${payload.department}`;
                break;
            case 'sentimentAnalysis':
                prompt = `Give a sentiment polarity score from -1.0 (most negative) to 1.0 (most positive) with a 5-word explanation for this visitor comment: "${payload.text}"`;
                break;
            case 'shiftNotes':
                prompt = `Generate a shift handover notes template for security guards. Keep it under 50 words.`;
                break;
            case 'autoReplyDraft':
                prompt = `Draft a polite employee auto-reply text template when they are busy in a meeting and a visitor unexpectedly arrives.`;
                break;
            case 'agendaPlanner':
                prompt = `Create a brief, bulleted 3-step 15-minute meeting agenda for host ${payload.host} and visitor ${payload.visitor} based on purpose: "${payload.purpose}"`;
                break;
            case 'emergencyProtocol':
                prompt = `Provide 3 short, bulleted emergency evacuation rules to display on a mobile visitor pass.`;
                break;
            case 'patternDetector':
                prompt = `Identify frequent visitor patterns and VIP eligibility recommendation for a visitor with:\nVisits this month: ${payload.monthlyVisits || 0}\nAverage stay duration: ${payload.avgStay || '1 hour'}`;
                break;
            case 'checkInGuide':
                prompt = `Write a short, friendly check-in step guide for a visitor arriving at:\nLobby/Block: ${payload.lobby || 'Main Reception'}\nID Verification Requirement: ${payload.idType || 'Govt Photo ID'}`;
                break;
            case 'greetingGenerator':
                prompt = `Create a warm, professional, personalized 1-sentence greeting for a visitor pass card:\nVisitor: ${payload.name}\nDepartment: ${payload.department}`;
                break;
        }

        // ─── Conversational Chat Setup ──────────────────────────────────────
        const isChat = (action === 'chat');
        const userMessage = isChat ? (payload.message || '') : '';
        const history = isChat && Array.isArray(payload.history) ? payload.history : [];

        // Classify query complexity to set word-count targets
        const queryText = isChat ? userMessage : prompt;
        const wordCount = queryText.split(/\s+/).length;
        const isLongQuery = wordCount > 12 ||
            /analyz|summar|explain|describe|how to|detail|plan|strateg|optim|report|assess|evaluat|recommend|review|list all|show me|what are|give me|compare|overview|breakdown|comprehensive|full|complete/i.test(queryText);
        const isShortQuery = wordCount <= 8 && !isLongQuery;

        // Response length targets — greatly expanded for long queries
        const minWords = isShortQuery ? 70 : (isLongQuery ? 3000 : 350);
        const maxWords = isShortQuery ? 120 : (isLongQuery ? 4500 : 500);
        const maxTokens = isShortQuery ? 512 : (isLongQuery ? 8192 : 2048);

        // Build role context with portal links + photo
        const roleContext = buildRoleContext(user, userRole, userName);
        const schemaContext = buildSchemaContext(userRole, user);

        // Build system prompt
        const systemContext = `You are VMS Assistant — the intelligent AI copilot embedded inside VMS Ultra Pro, an enterprise-grade Visitor Management System deployed at https://vms-ultimator.onrender.com.

You are currently assisting a **${userRole}** portal user named **${userName}**.

=== RESPONSE RULES (MANDATORY) ===
- Use **bold** for key terms, names, and important values
- Use ### headings for major sections in long responses
- Use ## headings for top-level sections
- Use bullet points (- item) for feature lists and options
- Use numbered lists (1. step) for procedures and workflows
- Use > blockquotes for warnings, tips, or highlighted information
- Use \`inline code\` for Portal IDs, SQL queries, route paths, or system values
- Use [IMG:url:alt] to embed user profile photos when relevant to the response
- Use [NAV:Label:url] to create navigation buttons to portal pages
- Use [COPY:Label:text] to create copy-to-clipboard buttons for IDs or important values
- For **short queries** (simple questions): respond in ${minWords}–${maxWords} words, conversationally
- For **analytical/detail queries**: respond in ${minWords}–${maxWords} words with full depth, multiple sections, examples, and actionable insights
- NEVER truncate or cut your response short — always complete your full answer
- NEVER give responses shorter than ${minWords} words — even simple answers must be thorough
- Do NOT include disclaimers like "as an AI" or "I cannot access"
- Always be specific, practical, and use VMS system terminology
- Include relevant portal navigation links in long responses using [NAV:Label:url] tokens
- When showing user information, render their photo if available using [IMG:url:alt]

=== ROLE-BASED ACCESS CONTROL ===
${roleContext}

=== DATABASE SCHEMA (${userRole} scope) ===
${schemaContext}

User Identity Context:
- Name: ${userName}
- Role: ${userRole}  
- PortalId/Email/VisitorId: ${user?.portalId || user?.email || user?.visitor_id || 'N/A'}
- Department: ${user?.dept || 'N/A'}

=== SQL AGENT PROTOCOL ===
If you need to query live database records to answer the question, emit ONLY this exact format:
[SQL: SELECT ... ] or [SQL: UPDATE ... ] or [SQL: INSERT ... ]
The backend will execute this query and return the JSON result to you.
You may emit up to 3 sequential SQL queries if needed (the loop runs 3 iterations max).
After receiving database results, compose your final comprehensive response.`;

        let currentPrompt = isChat ? userMessage : prompt;
        const contents = [];

        if (isChat) {
            // Build conversation history (up to last 10 turns for better context)
            history.slice(-10).forEach(turn => {
                if (turn.role === 'user') {
                    contents.push({ role: 'user', parts: [{ text: turn.text }] });
                } else if (turn.role === 'ai') {
                    contents.push({ role: 'model', parts: [{ text: turn.text }] });
                }
            });
            contents.push({ role: 'user', parts: [{ text: currentPrompt }] });
        }

        let aiResponseText = '';
        let loopCount = 0;
        let dynamicSystemContext = systemContext;

        // ─── ReAct Agent Loop (up to 3 SQL round-trips) ─────────────────────
        while (loopCount < 3) {
            let reqData;
            if (isChat) {
                reqData = {
                    system_instruction: { parts: [{ text: dynamicSystemContext }] },
                    contents,
                    generationConfig: {
                        temperature: 0.75,
                        topK: 64,
                        topP: 0.95,
                        maxOutputTokens: maxTokens
                    }
                };
            } else {
                reqData = {
                    contents: [{ parts: [{ text: dynamicSystemContext + '\n\nQuery: ' + currentPrompt }] }],
                    generationConfig: {
                        temperature: 0.75,
                        topK: 64,
                        topP: 0.95,
                        maxOutputTokens: maxTokens
                    }
                };
            }

            aiResponseText = await callGeminiWithFallback(reqData, apiKey);

            // Check if LLM outputted a SQL execution block
            const sqlMatch = aiResponseText.match(/\[SQL:\s*(.+?)\s*\]/is);
            if (sqlMatch) {
                const sqlQuery = sqlMatch[1].trim();
                console.log(`[VMS AI Agent] SQL Request (loop ${loopCount + 1}): ${sqlQuery.substring(0, 120)}...`);
                let resultStr = '';
                try {
                    const validatedSql = validateAndSanitizeSQL(sqlQuery, user);
                    const [dbResult] = await db.execute(validatedSql);
                    resultStr = JSON.stringify(dbResult);
                    dynamicSystemContext += `\n\n[DATABASE RESULT for: "${sqlQuery}"]\n${resultStr}`;
                } catch (sqlErr) {
                    console.error('[VMS AI Agent] SQL Error:', sqlErr.message);
                    resultStr = `Error: ${sqlErr.message}`;
                    dynamicSystemContext += `\n\n[DATABASE ERROR for: "${sqlQuery}"]\n${sqlErr.message}`;
                }

                if (isChat) {
                    contents.push({ role: 'model', parts: [{ text: aiResponseText }] });
                    contents.push({ role: 'user', parts: [{ text: `Database result: ${resultStr}` }] });
                } else {
                    currentPrompt += `\n\n[AI SQL Request]: ${aiResponseText}\n[Database result]: ${resultStr}`;
                }
                loopCount++;
            } else {
                break; // No SQL block — final response ready
            }
        }

        return res.json({ success: true, text: aiResponseText.trim() });

    } catch (err) {
        console.error('Gemini AI API Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to generate AI content. Please try again.' });
    }
};
