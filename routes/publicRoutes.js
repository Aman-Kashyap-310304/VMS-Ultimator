const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const sendEmail = require('../services/emailService');
const approvalTemplate = require('../templates/approvalTemplate');
const rejectionTemplate = require('../templates/rejectionTemplate');
const pdfService = require('../services/pdfService');
const cloudinaryService = require('../services/cloudinaryService');
const fs = require('fs');

// CSS Styles for beautiful responsive forms
const pageStyles = `
<style>
    :root {
        --primary: #2563eb;
        --success: #16a34a;
        --danger: #dc2626;
        --dark: #0f172a;
        --text: #334155;
        --bg: #f8fafc;
        --card: #ffffff;
        --border: #e2e8f0;
    }
    * {
        margin: 0; padding: 0; box-sizing: border-box;
        font-family: 'Segoe UI', system-ui, sans-serif;
    }
    body {
        background: var(--bg);
        color: var(--text);
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 20px;
    }
    .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
        padding: 30px;
        width: 100%;
        max-width: 500px;
    }
    .header {
        text-align: center;
        margin-bottom: 24px;
    }
    .header h2 {
        color: var(--dark);
        font-size: 1.5rem;
        margin-top: 8px;
    }
    .info-box {
        background: #f1f5f9;
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 20px;
        font-size: 0.95rem;
    }
    .info-box p {
        margin-bottom: 8px;
    }
    .info-box p:last-child {
        margin-bottom: 0;
    }
    .form-group {
        margin-bottom: 16px;
    }
    .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 600;
        color: var(--dark);
    }
    .form-control {
        width: 100%;
        padding: 10px 14px;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 1rem;
        transition: border-color 0.2s;
    }
    .form-control:focus {
        border-color: var(--primary);
        outline: none;
    }
    .btn {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 10px;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
    .btn-primary {
        background: var(--primary);
        color: #fff;
    }
    .btn-success {
        background: var(--success);
        color: #fff;
    }
    .btn-danger {
        background: var(--danger);
        color: #fff;
    }
</style>
`;

// Public access pass lookup for QR code redirection
router.get('/api/public/pass/:passNumber', async (req, res) => {
    try {
        const { passNumber } = req.params;
        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.pass_number = ?`,
            [passNumber]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Pass not found.' });
        }
        return res.json({ success: true, pass: rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Proxy endpoint to stream pass PDF dynamically compiled on the fly, avoiding any Cloudinary CORS / decryption errors
router.get('/api/public/pass/:passNumber/pdf', async (req, res) => {
    try {
        const { passNumber } = req.params;
        
        // Fetch all visitor pass details to re-generate the PDF dynamically
        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name, v.email as visitor_email 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.pass_number = ?`,
            [passNumber]
        );

        if (!rows.length) {
            return res.status(404).send('Pass not found');
        }

        const passData = rows[0];

        // Compile PDF pass dynamically on the fly
        const tempPdfPath = await pdfService.generateVisitorPassPdf(passData);

        res.setHeader('Content-Type', 'application/pdf');
        res.sendFile(tempPdfPath, (err) => {
            // Delete temp file after streaming
            try {
                if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
            } catch(e) {}
            if (err) {
                console.error('Error sending PDF file:', err.message);
            }
        });
    } catch (err) {
        console.error('Failed to generate PDF stream:', err.message);
        res.status(500).send('Failed to stream PDF pass');
    }
});

// GET: Approve visitor link
router.get('/api/public-action/approve', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.send('<h1>Error: Missing Token</h1>');

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
        const passNumber = decoded.passId;

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.pass_number = ? AND vp.status = 'pending'`,
            [passNumber]
        );

        if (!rows.length) {
            return res.send(`
                <html>
                <head>${pageStyles}</head>
                <body>
                    <div class="card" style="text-align: center;">
                        <h2 style="color:var(--danger)">Request Not Available</h2>
                        <p style="margin: 16px 0;">This visit request is either already processed or does not exist.</p>
                    </div>
                </body>
                </html>
            `);
        }

        const pass = rows[0];

        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Approve Visit Request</title>
                ${pageStyles}
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h2>Approve Visit Request</h2>
                    </div>
                    <div class="info-box">
                        <p><strong>Visitor:</strong> ${pass.visitor_name}</p>
                        <p><strong>Department:</strong> ${pass.host_department}</p>
                        <p><strong>Requested Date:</strong> ${pass.visit_date} at ${pass.visit_time}</p>
                    </div>
                    <form action="/api/public-action/approve" method="POST">
                        <input type="hidden" name="token" value="${token}">
                        <div class="form-group">
                            <label>Assign Host Employee Name (*)</label>
                            <input type="text" name="host_employee_name" class="form-control" placeholder="e.g. Sanjay Prasad" required>
                        </div>
                        <div class="form-group">
                            <label>Confirm Date</label>
                            <input type="date" name="visit_date" value="${pass.visit_date}" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Confirm Time</label>
                            <input type="time" name="visit_time" value="${pass.visit_time}" class="form-control" required>
                        </div>
                        <button type="submit" class="btn btn-success">Approve Request & Issue Pass</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        return res.send(`<h1>Error: Link has expired or is invalid.</h1>`);
    }
});

// POST: Approve visitor link submission
router.post('/api/public-action/approve', async (req, res) => {
    try {
        const { token, host_employee_name, visit_date, visit_time } = req.body;
        if (!token) return res.send('<h1>Error: Missing Token</h1>');

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
        const passNumber = decoded.passId;

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name, v.email as visitor_email 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.pass_number = ? AND vp.status = 'pending'`,
            [passNumber]
        );

        if (!rows.length) {
            return res.send('<h1>Error: Request already processed.</h1>');
        }

        const request = rows[0];

        // Validate that employee exists
        const [empRows] = await db.execute(
            'SELECT PortalId FROM users WHERE LOWER(TRIM(Name)) = LOWER(TRIM(?)) LIMIT 1',
            [host_employee_name]
        );

        if (!empRows.length) {
            return res.send(`
                <html>
                <head>${pageStyles}</head>
                <body>
                    <div class="card" style="text-align: center;">
                        <h2 style="color:var(--danger)">Employee Not Found</h2>
                        <p style="margin: 16px 0;">Employee "${host_employee_name}" is not registered in VMS.</p>
                        <a href="/api/public-action/approve?token=${token}" class="btn btn-primary">Go Back & Try Again</a>
                    </div>
                </body>
                </html>
            `);
        }

        const employee = empRows[0];
        const finalPassNumber = 'PASS-' + Math.floor(10000000 + Math.random() * 90000000).toString();

        // 1. Generate PDF Pass
        const tempPdfPath = await pdfService.generateVisitorPassPdf({
            pass_number: finalPassNumber,
            visitor_name: request.visitor_name,
            visitor_email: request.visitor_email,
            host_department: request.host_department,
            host_employee_name: host_employee_name,
            visit_date: visit_date,
            visit_time: visit_time
        });

        // 2. Upload PDF to Cloudinary
        const passPdfUrl = await cloudinaryService.uploadToCloudinary(tempPdfPath);
        try {
            if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        } catch(e) {}

        // 3. Update pass database record
        await db.execute(
            `UPDATE visitor_passes 
             SET pass_number = ?, host_employee_name = ?, visit_date = ?, visit_time = ?, status = 'approved', pass_pdf_url = ?
             WHERE id = ?`,
            [finalPassNumber, host_employee_name, visit_date, visit_time, passPdfUrl, request.id]
        );

        // 4. Create schedule record for employee automatically
        await db.execute(
            `INSERT INTO schedules (portal_id, title, date, time, description, status) 
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [
                employee.PortalId,
                `Host Visitor: ${request.visitor_name}`,
                visit_date,
                visit_time,
                `Assigned to host visitor ${request.visitor_name} (Pass ID: ${finalPassNumber}).`
            ]
        );

        // 5. Send approval email to visitor
        await sendEmail({
            to: request.visitor_email,
            subject: '✅ Visitor Pass Approved',
            htmlContent: approvalTemplate({
                visitorName: request.visitor_name,
                passNumber: finalPassNumber,
                employeeName: host_employee_name,
                department: request.host_department,
                visitDate: visit_date,
                visitTime: visit_time
            })
        });

        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pass Approved</title>
                ${pageStyles}
            </head>
            <body>
                <div class="card" style="text-align: center;">
                    <h2 style="color:var(--success)">Pass Approved Successfully!</h2>
                    <p style="margin: 16px 0;">Visitor "${request.visitor_name}" has been approved. The access pass has been compiled and emailed.</p>
                    <a href="${passPdfUrl}" target="_blank" class="btn btn-success">View Generated PDF Pass</a>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error(err);
        return res.send('<h1>Server Error while processing approval.</h1>');
    }
});

// GET: Reject visitor link
router.get('/api/public-action/reject', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.send('<h1>Error: Missing Token</h1>');

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
        const passNumber = decoded.passId;

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.pass_number = ? AND vp.status = 'pending'`,
            [passNumber]
        );

        if (!rows.length) {
            return res.send(`
                <html>
                <head>${pageStyles}</head>
                <body>
                    <div class="card" style="text-align: center;">
                        <h2 style="color:var(--danger)">Request Not Available</h2>
                        <p style="margin: 16px 0;">This request has already been processed.</p>
                    </div>
                </body>
                </html>
            `);
        }

        const pass = rows[0];

        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reject Visit Request</title>
                ${pageStyles}
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h2>Reject Visit Request</h2>
                    </div>
                    <div class="info-box">
                        <p><strong>Visitor:</strong> ${pass.visitor_name}</p>
                        <p><strong>Department:</strong> ${pass.host_department}</p>
                    </div>
                    <form action="/api/public-action/reject" method="POST">
                        <input type="hidden" name="token" value="${token}">
                        <div class="form-group">
                            <label>Reason for Rejection (*)</label>
                            <textarea name="reason" class="form-control" rows="3" placeholder="Specify why the visit is declined..." required></textarea>
                        </div>
                        <button type="submit" class="btn btn-danger">Confirm Rejection</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        return res.send('<h1>Error: Link has expired or is invalid.</h1>');
    }
});

// POST: Reject visitor link submission
router.post('/api/public-action/reject', async (req, res) => {
    try {
        const { token, reason } = req.body;
        if (!token) return res.send('<h1>Error: Missing Token</h1>');

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
        const passNumber = decoded.passId;

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name, v.email as visitor_email 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.pass_number = ? AND vp.status = 'pending'`,
            [passNumber]
        );

        if (!rows.length) {
            return res.send('<h1>Error: Request already processed.</h1>');
        }

        const request = rows[0];

        // Update pass database record
        await db.execute(
            `UPDATE visitor_passes SET status = 'rejected' WHERE id = ?`,
            [request.id]
        );

        // Send rejection email to visitor
        await sendEmail({
            to: request.visitor_email,
            subject: '❌ Visitor Pass Rejected',
            htmlContent: rejectionTemplate({
                visitorName: request.visitor_name,
                reason: reason,
                department: request.host_department
            })
        });

        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pass Rejected</title>
                ${pageStyles}
            </head>
            <body>
                <div class="card" style="text-align: center;">
                    <h2 style="color:var(--danger)">Request Rejected</h2>
                    <p style="margin: 16px 0;">Visitor "${request.visitor_name}" has been notified of the rejection.</p>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error(err);
        return res.send('<h1>Server Error while processing rejection.</h1>');
    }
});

router.post('/api/ai/generate', require('../controllers/aiController').generateContent);

module.exports = router;
