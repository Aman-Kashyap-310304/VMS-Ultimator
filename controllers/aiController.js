// controllers/aiController.js
const axios = require('axios');

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

        let prompt = '';

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

            // ── Conversational Chat ──────────────────────────────────────────
            case 'chat': {
                const userMessage = payload.message || '';
                const userRole = payload.role || 'Staff';
                const history = Array.isArray(payload.history) ? payload.history : [];

                // Classify query length to set word-count target
                const wordCount = userMessage.split(/\s+/).length;
                const isLongQuery = wordCount > 12 ||
                    /analyz|summar|explain|describe|how to|detail|plan|strateg|optim|report|assess|evaluat|recommend|review/i.test(userMessage);

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

                // Build conversation turns
                const contents = [];

                // Add history (up to last 8 turns)
                const recentHistory = history.slice(-8);
                recentHistory.forEach(turn => {
                    if (turn.role === 'user') {
                        contents.push({ role: 'user', parts: [{ text: turn.text }] });
                    } else if (turn.role === 'ai') {
                        contents.push({ role: 'model', parts: [{ text: turn.text }] });
                    }
                });

                // Add current message
                contents.push({ role: 'user', parts: [{ text: userMessage }] });

                // Call Gemini with system instruction + multi-turn
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                const response = await axios.post(geminiUrl, {
                    system_instruction: { parts: [{ text: systemContext }] },
                    contents,
                    generationConfig: {
                        temperature: 0.75,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: isLongQuery ? 1024 : 400
                    }
                });

                const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                return res.json({ success: true, text: generatedText.trim() });
            }

            default:
                return res.status(400).json({ success: false, message: 'Invalid AI action specified.' });
        }

        // ── Single-turn prompts (Tools tab) ──────────────────────────────────
        // Classify the prompt for word-count enforcement
        const isDetailedPrompt = [
            'summarize', 'analyze', 'recommend', 'generate', 'plan',
            'audit', 'optimize', 'assess', 'detect', 'predict'
        ].some(kw => prompt.toLowerCase().includes(kw));

        const wordTarget = isDetailedPrompt
            ? 'Provide a thorough, well-structured response of at least 380–450 words with proper markdown formatting (headings, bullets, bold).'
            : 'Respond concisely but with at least 80–100 words, using markdown formatting where appropriate.';

        const enhancedPrompt = `${prompt}\n\n[FORMATTING INSTRUCTION] ${wordTarget} Use **bold** for key terms, bullet points for lists, and ### headings for sections if the response has multiple parts.`;

        // Call Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await axios.post(geminiUrl, {
            contents: [{ parts: [{ text: enhancedPrompt }] }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: isDetailedPrompt ? 1024 : 512
            }
        });

        const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.json({ success: true, text: generatedText.trim() });

    } catch (err) {
        console.error('Gemini AI API Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to generate content using Gemini AI.' });
    }
};
