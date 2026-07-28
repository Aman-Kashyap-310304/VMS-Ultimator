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
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-flash-lite',
        'gemini-flash-latest'
    ];
    let lastError = null;
    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
            const response = await axios.post(url, reqData);
            const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
        } catch (err) {
            console.warn(`[Gemini Fallback] Model ${model} failed:`, err.response?.data?.error?.message || err.message);
            lastError = err;
        }
    }
    throw lastError || new Error('All Gemini models failed');
}

/**
 * ─── SQL Security & RBAC Enforcement ─────────────────────────────────────────
 * Ensures users can only access tables and rows authorized for their role.
 */
function validateAndSanitizeSQL(sql, user) {
    const cleanSql = sql.trim().toLowerCase();
    const role = user?.role || (user?.visitor_id ? 'Visitor' : 'Visitor');

    // Basic syntax checks
    if (!cleanSql.startsWith('select') && !cleanSql.startsWith('insert') && !cleanSql.startsWith('update') && !cleanSql.startsWith('delete')) {
        throw new Error('Only SELECT, INSERT, UPDATE, and DELETE operations are allowed.');
    }

    // Block database structural modification commands
    if (cleanSql.includes('drop ') || cleanSql.includes('alter ') || cleanSql.includes('truncate ') || cleanSql.includes('grant ') || cleanSql.includes('revoke ')) {
        throw new Error('DDL commands are strictly forbidden.');
    }

    if (role === 'Visitor') {
        // Visitor can ONLY select/update their own records
        const visitorEmail = user?.email;
        const visitorId = user?.visitor_id;
        const visitorDbId = user?.id;

        // Block access to staff tables
        if (cleanSql.includes('users') || cleanSql.includes('deptadmin') || cleanSql.includes('otps') || cleanSql.includes('wrong_password_attempt') || cleanSql.includes('password_requests') || cleanSql.includes('department_view_logs')) {
            throw new Error('Access Denied. Visitors cannot access staff tables.');
        }

        // Block any Visitor SQL writes entirely
        if (!cleanSql.startsWith('select')) {
            throw new Error('Access Denied. Visitors can only perform read operations.');
        }

        // Ensure visitor_id or email filters are present for visitors
        if (cleanSql.includes('visitors') || cleanSql.includes('visitor_passes')) {
            const hasIdFilter = (visitorId && cleanSql.includes(String(visitorId).toLowerCase())) || 
                                (visitorEmail && cleanSql.includes(String(visitorEmail).toLowerCase())) || 
                                (visitorDbId && cleanSql.includes(String(visitorDbId).toLowerCase()));
            if (!hasIdFilter) {
                throw new Error('Access Denied. You can only query your own visitor records.');
            }
        }
    }

    // Role: Employee / Security
    if (role === 'Employee' || role === 'Security') {
        // Cannot access credentials or security logs of others
        if (cleanSql.includes('otps') || cleanSql.includes('password') || cleanSql.includes('wrong_password_attempt')) {
            throw new Error('Access Denied. Staff cannot access credential tables.');
        }
    }

    // Role: DeptAdmin
    if (role === 'DeptAdmin') {
        // Can query anything but let's restrict OTP table access
        if (cleanSql.includes('otps')) {
            throw new Error('Access Denied. DeptAdmins cannot access temporary OTP table.');
        }
    }

    return sql;
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
        const cookieToken = req.cookies?.admin_token || req.cookies?.deptadmin_token || req.cookies?.employee_token || req.cookies?.security_token || req.cookies?.visitor_token;
        const token = (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) || cookieToken;

        if (token) {
            try {
                user = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
            } catch (e) {
                console.warn('JWT verify failed in AI controller:', e.message);
            }
        }

        let userRole = user?.role || (user?.visitor_id ? 'Visitor' : 'Visitor');
        let userName = user?.name || user?.full_name || 'User';

        let prompt = '';

        // ─── Map Actions ────────────────────────────────────────────────────────
        switch (action) {
            case 'summarizeVisitor':
                prompt = `Summarize the following visitor profile and history into a short, elegant paragraph:
Name: ${payload.name}
Email: ${payload.email}
Company: ${payload.company || 'N/A'}
Designation: ${payload.designation || 'N/A'}
Purpose: ${payload.purpose || 'N/A'}
Total past visits: ${payload.visitCount || 0}`;
                break;

            case 'purposeGenerator':
                prompt = `Convert this rough draft of a visitor's visit reason into a professional, concise corporate purpose statement (maximum 10 words): "${payload.rawPurpose}"`;
                break;

            case 'scheduleStatement':
                prompt = `Write a formal, brief work schedule statement for an employee's dashboard:
Task: ${payload.title}
Details: ${payload.description}
Date/Time: ${payload.dateTime}`;
                break;

            case 'riskPredictor':
                prompt = `Perform a quick security risk assessment based on these details. Return a JSON structure with "level" (Low, Medium, or High) and "reasons" (array of 2 bullet points):
Visitor Name: ${payload.name}
Company: ${payload.company || 'Unknown'}
Purpose: ${payload.purpose || 'Unknown'}
Security Flag Status: ${payload.isBlocked ? 'BLOCKED' : 'CLEAN'}`;
                break;

            case 'emailDraft':
                prompt = `Draft a brief, professional email to a visitor regarding their request:
Visitor: ${payload.name}
Status: ${payload.status}
Department: ${payload.department}
Time: ${payload.dateTime}`;
                break;

            case 'priorityAdvisor':
                prompt = `Recommend a priority level (Routine, Urgent, or Critical) and give a 1-sentence explanation:
Task title: ${payload.title}
Description: ${payload.description}`;
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
                prompt = `Generate a 2-sentence security audit log summary statement for a shift containing:
Total Checked In: ${payload.checkedIn || 0}
Total Checked Out: ${payload.checkedOut || 0}
Pending Approvals: ${payload.pending || 0}`;
                break;

            case 'loadOptimizer':
                prompt = `Suggest optimal visitor lobby limits and advice for a department with:
Staff Count: ${payload.staffCount || 0}
Average Daily Visits: ${payload.dailyVisits || 0}`;
                break;

            case 'lockoutReasoning':
                prompt = `Analyze this lockout security incident and write a 1-sentence recommendation:
User Portal ID: ${payload.portalId}
Failed Attempts: ${payload.failedAttempts}
Reason: ${payload.reason || 'Multiple wrong passwords'}`;
                break;

            case 'passTranslator':
                prompt = `Translate the following visitor pass details into ${payload.language || 'Spanish'}:
Pass: ${payload.passNumber}
Visitor: ${payload.name}
Valid Date: ${payload.date}
Department: ${payload.department}`;
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
                prompt = `Identify frequent visitor patterns and VIP eligibility recommendation for a visitor with:
Visits this month: ${payload.monthlyVisits || 0}
Average stay duration: ${payload.avgStay || '1 hour'}`;
                break;

            case 'checkInGuide':
                prompt = `Write a short, friendly check-in step guide for a visitor arriving at:
Lobby/Block: ${payload.lobby || 'Main Reception'}
ID Verification Requirement: ${payload.idType || 'Govt Photo ID'}`;
                break;

            case 'greetingGenerator':
                prompt = `Create a warm, professional, personalized 1-sentence greeting for a visitor pass card:
Visitor: ${payload.name}
Department: ${payload.department}`;
                break;
        }

        // ─── Conversational Chat Setup ──────────────────────────────────────
        const isChat = (action === 'chat');
        const userMessage = isChat ? (payload.message || '') : '';
        const history = isChat && Array.isArray(payload.history) ? payload.history : [];

        // Classify query length to set word-count target
        const wordCount = isChat ? userMessage.split(/\s+/).length : prompt.split(/\s+/).length;
        const isLongQuery = wordCount > 12 || 
            /analyz|summar|explain|describe|how to|detail|plan|strateg|optim|report|assess|evaluat|recommend|review/i.test(isChat ? userMessage : prompt);

        const minWords = isLongQuery ? 380 : 80;
        const maxWords = isLongQuery ? 500 : 120;

        // Build system context
        const systemContext = `You are VMS Assistant — the intelligent AI copilot for VMS Ultra Pro, an enterprise Visitor Management System. 
You are currently assisting a ${userRole} portal user.
The system manages: visitor registrations, visitor passes, department management, employee & security staff, schedules, and security lockouts.

Formatting rules (MANDATORY):
- Use **bold** for important terms
- Use ### headings for sections when answering long queries
- Use bullet points (- item) for lists
- Use numbered lists (1. step) for procedures
- Keep inline code for Portal IDs, route paths, or system values
- For short queries: respond in ${minWords}–${maxWords} words minimum, conversationally and helpfully
- For analytical/detail queries: respond in ${minWords}–${maxWords} words with proper structure and depth
- NEVER give responses shorter than ${minWords} words
- Do NOT include disclaimer phrases like 'as an AI' or 'I cannot'
- Always be specific and practical, using VMS system terminology`;

        // Active Database Schema & Identity Context
        let loopContext = `
Active Database Schema:
- departments (dept_code VARCHAR(50) PRIMARY KEY, dept_name VARCHAR(255), dept_location VARCHAR(255), dept_profile TEXT)
- visitors (id INT AUTO_INCREMENT PRIMARY KEY, visitor_id VARCHAR(50) UNIQUE, full_name VARCHAR(255), email VARCHAR(255), contact_number VARCHAR(50), purpose VARCHAR(255), company_name VARCHAR(255), designation VARCHAR(255), is_blocked TINYINT, blocked_reason VARCHAR(255))
- visitor_passes (id INT AUTO_INCREMENT PRIMARY KEY, visitor_id INT, pass_number VARCHAR(100) UNIQUE, host_employee_name VARCHAR(255), host_department VARCHAR(50), status VARCHAR(50), check_in_time DATETIME, check_out_time DATETIME, pass_pdf_url VARCHAR(500), host_flagged_left_time DATETIME)
- wrong_password_attempt (alert_id INT AUTO_INCREMENT PRIMARY KEY, portal_id VARCHAR(100), role VARCHAR(50), timestampt DATETIME, device_type VARCHAR(100), ip_address VARCHAR(100), action_trigger VARCHAR(255), investigated_by VARCHAR(100))
- deptAdmin (PortalId VARCHAR(100) PRIMARY KEY, EmpId VARCHAR(100) UNIQUE, Name VARCHAR(255), Email VARCHAR(255), Contact VARCHAR(100), dept VARCHAR(100), is_first_login TINYINT, is_blocked TINYINT, blocked_reason VARCHAR(255))
- users (PortalId VARCHAR(100) PRIMARY KEY, EmpId VARCHAR(100) UNIQUE, Name VARCHAR(255), Email VARCHAR(255), Contact VARCHAR(50), dept VARCHAR(100), Role VARCHAR(50), is_first_login TINYINT, is_blocked TINYINT, blocked_reason VARCHAR(255))
- schedules (id INT AUTO_INCREMENT PRIMARY KEY, portal_id VARCHAR(100), title VARCHAR(255), date VARCHAR(100), time VARCHAR(100), description TEXT, status VARCHAR(50), remarks TEXT)
- password_requests (id INT AUTO_INCREMENT PRIMARY KEY, portal_id VARCHAR(100), role VARCHAR(50), status VARCHAR(50), reason VARCHAR(255))
- visitor_profile_updates (id INT AUTO_INCREMENT PRIMARY KEY, visitor_id INT, old_details TEXT, new_details TEXT)
- department_view_logs (id INT AUTO_INCREMENT PRIMARY KEY, viewer_id VARCHAR(100), viewer_role VARCHAR(50), dept_code VARCHAR(50), viewed_at TIMESTAMP)

User Identity:
- Name: ${userName}
- Role: ${userRole}
- PortalId/Email/VisitorId: ${user?.portalId || user?.email || user?.visitor_id || 'N/A'}
- Department (if staff): ${user?.dept || 'N/A'}

If you need to query database records to answer the user's query or perform a write action, reply with ONLY a single line containing the SQL block:
[SQL: SELECT ... ] or [SQL: UPDATE ... ] or [SQL: INSERT ... ]
The backend will execute this query and return the JSON result.
If you have the data or do not need to query, write your final response.`;

        let currentPrompt = isChat ? userMessage : prompt;
        const contents = [];

        if (isChat) {
            // Build conversation history (up to last 8 turns)
            history.slice(-8).forEach(turn => {
                if (turn.role === 'user') {
                    contents.push({ role: 'user', parts: [{ text: turn.text }] });
                } else if (turn.role === 'ai') {
                    contents.push({ role: 'model', parts: [{ text: turn.text }] });
                }
            });
            // Push current user prompt
            contents.push({ role: 'user', parts: [{ text: currentPrompt }] });
        }

        let aiResponseText = '';
        let loopCount = 0;
        let systemContextWithSchema = systemContext + '\n\n' + loopContext;

        // ─── ReAct Agent Loop ────────────────────────────────────────────────
        while (loopCount < 3) {
            let reqData;
            if (isChat) {
                reqData = {
                    system_instruction: { parts: [{ text: systemContextWithSchema }] },
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048 // Full length to prevent cutoffs
                    }
                };
            } else {
                reqData = {
                    contents: [{ parts: [{ text: systemContextWithSchema + '\n\nQuery: ' + currentPrompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048 // Full length to prevent cutoffs
                    }
                };
            }

            aiResponseText = await callGeminiWithFallback(reqData, apiKey);

            // Check if LLM outputted a SQL execution block
            const sqlMatch = aiResponseText.match(/\[SQL:\s*(.+?)\s*\]/is);
            if (sqlMatch) {
                const sqlQuery = sqlMatch[1].trim();
                console.log(`[VMS AI Agent] Requested SQL: ${sqlQuery}`);
                let resultStr = '';
                try {
                    // Enforce role-based access control rules
                    const validatedSql = validateAndSanitizeSQL(sqlQuery, user);
                    const [dbResult] = await db.execute(validatedSql);
                    resultStr = JSON.stringify(dbResult);
                    systemContextWithSchema += `\n\n[DATABASE EXECUTED RESULT for query "${sqlQuery}"]\n${resultStr}`;
                } catch (sqlErr) {
                    console.error('[VMS AI Agent] SQL Error:', sqlErr.message);
                    resultStr = `Error: ${sqlErr.message}`;
                    systemContextWithSchema += `\n\n[DATABASE ERROR for query "${sqlQuery}"]\n${sqlErr.message}`;
                }

                if (isChat) {
                    // Push the model's call and the user's DB response to contents
                    contents.push({ role: 'model', parts: [{ text: aiResponseText }] });
                    contents.push({ role: 'user', parts: [{ text: `Database result: ${resultStr}` }] });
                } else {
                    currentPrompt += `\n\n[AI SQL Request]: ${aiResponseText}\n[Database result]: ${resultStr}`;
                }
                loopCount++;
            } else {
                break; // No SQL block, final text ready
            }
        }

        // Return final text
        return res.json({ success: true, text: aiResponseText.trim() });

    } catch (err) {
        console.error('Gemini AI API Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to generate content using Gemini AI.' });
    }
};
