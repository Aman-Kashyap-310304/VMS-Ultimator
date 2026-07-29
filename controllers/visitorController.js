// controllers/visitorController.js
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const sendEmail = require('../services/emailService');
const getBaseUrl = require('../utils/baseUrl');
const newRequestTemplate = require('../templates/newRequestTemplate');

exports.createVisitorRequest = async (req, res) => {
    try {
        const { purpose, host_department, visit_date, visit_time } = req.body;
        const visitorId = req.visitor.id;

        const requestNumber = 'REQ-' + Math.floor(10000000 + Math.random() * 90000000).toString();
        
        // Auto assign host_employee_name to "DeptAdmin Assigned"
        const assignedHostName = 'DeptAdmin Assigned';
        
        await db.execute(
            `INSERT INTO visitor_passes (visitor_id, pass_number, host_employee_name, host_department, visit_date, visit_time, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [visitorId, requestNumber, assignedHostName, host_department, visit_date, visit_time]
        );

        // Notify all DeptAdmins of host_department and Super Admin via email with dynamic actions
        try {
            const [adminRows] = await db.execute('SELECT Email FROM deptAdmin WHERE dept = ?', [host_department]);
            const adminEmails = [process.env.ADMIN_EMAIL || 'its.akshatnetworkhub23@gmail.com', ...adminRows.map(r => r.Email)];
            
            const actionToken = jwt.sign(
                { passId: requestNumber },
                process.env.JWT_SECRET || 'your_super_secret_jwt_key',
                { expiresIn: '7d' }
            );

            const baseUrl = getBaseUrl(req);
            const approveLink = `${baseUrl}/api/public-action/approve?token=${actionToken}`;
            const rejectLink = `${baseUrl}/api/public-action/reject?token=${actionToken}`;

            if (adminEmails.length) {
                const emailHtml = `
                    <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                        <h2 style="color: #2563eb; margin-bottom: 20px;">🆕 New Visit Request</h2>
                        <p>A new visitor request has been submitted for department: <strong>${host_department}</strong>.</p>
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                            <p><strong>Request Ref:</strong> ${requestNumber}</p>
                            <p><strong>Purpose:</strong> ${purpose}</p>
                            <p><strong>Date & Time:</strong> ${visit_date} at ${visit_time}</p>
                        </div>
                        <p style="margin-bottom: 20px;">You can approve or reject this request instantly using the secure links below:</p>
                        <div style="display: flex; gap: 12px; margin-top: 15px; margin-bottom: 15px;">
                            <a href="${approveLink}" style="background: #16a34a; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.95rem;">Approve Request</a>
                            <a href="${rejectLink}" style="background: #dc2626; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 0.95rem;">Reject Request</a>
                        </div>
                        <p style="font-size: 0.85rem; color: #64748b; margin-top: 15px;">Note: These quick actions are valid for 7 days and do not require console login.</p>
                    </div>
                `;
                for (const email of adminEmails) {
                    await sendEmail({
                        to: email,
                        subject: `🆕 New Visit Request for ${host_department}: ${requestNumber}`,
                        htmlContent: emailHtml
                    });
                }
            }
        } catch (mailErr) {
            console.error('Admin notification email failed:', mailErr.message);
        }

        return res.status(201).json({
            success: true,
            message: 'Visit request submitted successfully, awaiting approval.',
            visitorId: requestNumber
        });
    } catch (error) {
        console.error('Visitor Controller Error:', error);
        return res.status(500).json({ success: false, message: 'Unable to submit visitor request.' });
    }
};

exports.getVisitorProfile = async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT visitor_id, full_name, email, contact_number, company_name, designation, photo_path FROM visitors WHERE id = ?',
            [req.visitor.id]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        return res.json({ success: true, profile: rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
    }
};

exports.getVisitorHistory = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT * FROM visitor_passes WHERE visitor_id = ? ORDER BY id DESC`,
            [req.visitor.id]
        );
        return res.json({ success: true, history: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve history.' });
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        await db.execute('DELETE FROM visitors WHERE id = ?', [req.visitor.id]);
        return res.json({ success: true, message: 'Your visitor profile was successfully deleted from the registry.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to delete your profile.' });
    }
};

exports.updateVisitorProfile = async (req, res) => {
    try {
        const { Name, Email, Contact, Company, Designation } = req.body;
        const visitorId = req.visitor.id;

        // Fetch old profile details
        const [oldRows] = await db.execute(
            'SELECT full_name, email, contact_number, company_name, designation, photo_path, visitor_id FROM visitors WHERE id = ?',
            [visitorId]
        );
        
        if (!oldRows.length) {
            return res.status(404).json({ success: false, message: 'Visitor profile not found.' });
        }

        const oldProfile = oldRows[0];

        let photoPath = oldProfile.photo_path;
        if (req.files && req.files['photo']) {
            photoPath = '/uploads/temp/' + req.files['photo'][0].filename;
        }

        // Update database record
        await db.execute(
            `UPDATE visitors 
             SET full_name = ?, email = ?, contact_number = ?, company_name = ?, designation = ?, photo_path = ? 
             WHERE id = ?`,
            [Name || oldProfile.full_name, Email || oldProfile.email, Contact || oldProfile.contact_number, Company || oldProfile.company_name, Designation || oldProfile.designation, photoPath, visitorId]
        );

        // Record update log details
        const oldDetails = JSON.stringify(oldProfile);
        const newDetails = JSON.stringify({
            full_name: Name || oldProfile.full_name,
            email: Email || oldProfile.email,
            contact_number: Contact || oldProfile.contact_number,
            company_name: Company || oldProfile.company_name,
            designation: Designation || oldProfile.designation,
            photo_path: photoPath
        });

        await db.execute(
            'INSERT INTO visitor_profile_updates (visitor_id, old_details, new_details) VALUES (?, ?, ?)',
            [visitorId, oldDetails, newDetails]
        );

        // Dispatch notifications to Super Admin and all DeptAdmins
        const [adminRows] = await db.execute('SELECT Email FROM deptAdmin');
        const adminEmails = [process.env.ADMIN_EMAIL || 'admin@example.com', ...adminRows.map(r => r.Email)];

        const emailHtml = `
            <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #ef4444; margin-bottom: 20px;">⚠️ Visitor Profile Updated</h2>
                <p>Visitor <strong>${oldProfile.full_name}</strong> (Visitor ID: ${oldProfile.visitor_id}) has updated their registration profile details.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Field</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Old Value</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">New Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Name</strong></td>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;">${oldProfile.full_name}</td>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;">${Name || oldProfile.full_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Email</strong></td>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;">${oldProfile.email}</td>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;">${Email || oldProfile.email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Contact</strong></td>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;">${oldProfile.contact_number || 'N/A'}</td>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;">${Contact || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Company</strong></td>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;">${oldProfile.company_name || 'N/A'}</td>
                            <td style="padding: 8px; border: 1px solid #e2e8f0;">${Company || 'N/A'}</td>
                        </tr>
                    </tbody>
                </table>
                <p style="font-size: 0.85rem; color: #64748b;">Please review this update in your respective admin dashboards.</p>
            </div>
        `;

        for (const mail of adminEmails) {
            try {
                await sendEmail({
                    to: mail,
                    subject: `⚠️ Visitor Profile Change Alert: ${oldProfile.full_name}`,
                    htmlContent: emailHtml
                });
            } catch (err) {
                console.error('Mail dispatch error to admin:', mail, err.message);
            }
        }

        return res.json({ success: true, message: 'Profile details updated and administrators notified.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
};

exports.getPassDetail = async (req, res) => {
    try {
        const { passNumber } = req.params;
        const visitorId = req.visitor.id;

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.pass_number = ? AND vp.visitor_id = ?`,
            [passNumber, visitorId]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Pass not found.' });
        }

        return res.json({ success: true, pass: rows[0] });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve pass details.' });
    }
};

exports.removePhoto = async (req, res) => {
    try {
        const visitorId = req.visitor.id;
        await db.execute('UPDATE visitors SET photo_path = NULL WHERE id = ?', [visitorId]);
        return res.json({ success: true, message: 'Profile photo removed successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to remove profile photo.' });
    }
};