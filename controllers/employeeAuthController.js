// controllers/employeeAuthController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const sendEmail = require('../services/emailService');

exports.loginEmployee = async (req, res) => {
    try {
        const { portalId, password } = req.body;

        if (!portalId || !password) {
            return res.status(400).json({ success: false, message: 'Portal ID and password are required.' });
        }

        const [rows] = await db.execute(
            `SELECT * FROM users WHERE PortalId = ? AND Role = 'Employee'`,
            [portalId]
        );

        if (!rows.length) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const user = rows[0];

        if (user.is_blocked) {
            return res.status(403).json({
                success: false,
                message: `Account is locked out. Reason: ${user.blocked_reason || 'Too many failed login attempts.'}`
            });
        }

        const match = await bcrypt.compare(String(password), user.password);
        if (!match) {
            // Track failed password attempt
            const deviceType = (req.headers['user-agent'] || 'Unknown Device').substring(0, 100);
            const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
            await db.execute(
                `INSERT INTO wrong_password_attempt (portal_id, role, timestampt, device_type, ip_address, action_trigger, investigated_by) 
                 VALUES (?, 'Employee', NOW(), ?, ?, 'Incorrect password check', 'Pending')`,
                [portalId, deviceType, ipAddress]
            );

            // Fetch cumulative attempts
            const [checkRows] = await db.execute(
                `SELECT COUNT(*) as attempts FROM wrong_password_attempt 
                 WHERE portal_id = ? AND role = 'Employee' AND issue_createdAt > NOW() - INTERVAL 1 HOUR`,
                [portalId]
            );

            if (checkRows[0].attempts >= 10) {
                // Block account
                await db.execute(
                    `UPDATE users SET is_blocked = 1, blocked_reason = 'Brute force lockout (10 failed password attempts)' WHERE PortalId = ?`,
                    [portalId]
                );

                // Fetch DeptAdmin Email
                const [adminRows] = await db.execute(
                    `SELECT Email, Name FROM deptAdmin WHERE dept = ? LIMIT 1`,
                    [user.dept]
                );

                const adminEmail = adminRows.length ? adminRows[0].Email : null;
                const superAdminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

                const alertHtml = `
                    <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                        <h2 style="color: #dc2626; margin-bottom: 20px;">🚨 Security Alert: Account Locked</h2>
                        <p>An employee account has been temporarily locked out due to <strong>10 consecutive failed password attempts</strong>.</p>
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Employee Name:</strong> ${user.Name}</p>
                            <p><strong>Portal ID:</strong> ${user.PortalId}</p>
                            <p><strong>Department:</strong> ${user.dept}</p>
                            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                    </div>
                `;

                // Alert both DeptAdmin and Super Admin
                if (adminEmail) {
                    await sendEmail({
                        to: adminEmail,
                        subject: `🚨 Security Alert: Locked Account (${user.PortalId})`,
                        htmlContent: alertHtml
                    });
                }

                await sendEmail({
                    to: superAdminEmail,
                    subject: `🚨 Security Alert: Locked Account (${user.PortalId})`,
                    htmlContent: alertHtml
                });

                return res.status(403).json({
                    success: false,
                    message: 'Maximum password attempts exceeded. Account is locked. Administrator notified.'
                });
            }

            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isFirstLogin = user.is_first_login === 1;

        const token = jwt.sign(
            { portalId: user.PortalId, emp_id: user.EmpId, name: user.Name, role: 'Employee', dept: user.dept },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key',
            { expiresIn: '2d' }
        );

        res.cookie('employee_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

        return res.json({
            success: true,
            token,
            firstLogin: isFirstLogin,
            user: { portalId: user.PortalId, name: user.Name, dept: user.dept }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Login failed.' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT PortalId, EmpId, Name, Email, Contact, dept, Role, userPhotoPath, createdAt FROM users WHERE PortalId = ?',
            [req.employee.portalId]
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

exports.changePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword) {
            return res.status(400).json({ success: false, message: 'New password is required.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await db.execute(
            'UPDATE users SET password = ?, is_first_login = 0 WHERE PortalId = ?',
            [passwordHash, req.employee.portalId]
        );

        return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to change password.' });
    }
};

exports.updateProfile = async (req, res) => {
    let photoPath = null;
    try {
        const { Name, Email, Contact } = req.body;
        const portalId = req.employee.portalId;

        if (!Name || !Email) {
            return res.status(400).json({ success: false, message: 'Name and Email are required.' });
        }

        const [rows] = await db.execute('SELECT userPhotoPath, dept FROM users WHERE PortalId = ?', [portalId]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = rows[0];
        photoPath = user.userPhotoPath;

        if (req.file) {
            const cloudinaryService = require('../services/cloudinaryService');
            photoPath = await cloudinaryService.uploadToCloudinary(req.file.path);
            const fs = require('fs');
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        }

        await db.execute(
            'UPDATE users SET Name = ?, Email = ?, Contact = ?, userPhotoPath = ? WHERE PortalId = ?',
            [Name, Email, Contact || '', photoPath, portalId]
        );

        // Fetch DeptAdmin Email
        const [adminRows] = await db.execute(
            `SELECT Email FROM deptAdmin WHERE dept = ? LIMIT 1`,
            [user.dept]
        );

        const adminEmail = adminRows.length ? adminRows[0].Email : null;
        const superAdminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

        // Notify Admins
        const alertHtml = `
            <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155;">
                <h3>📢 Employee Profile Updated</h3>
                <p><strong>Portal ID:</strong> ${portalId}</p>
                <p><strong>Name:</strong> ${Name}</p>
                <p><strong>Email:</strong> ${Email}</p>
                <p><strong>Contact:</strong> ${Contact || 'N/A'}</p>
            </div>
        `;

        if (adminEmail) {
            try {
                await sendEmail({
                    to: adminEmail,
                    subject: `📢 Employee Profile Update: ${portalId}`,
                    htmlContent: alertHtml
                });
            } catch (emailErr) {
                console.warn('Could not send email to DeptAdmin:', emailErr.message);
            }
        }

        try {
            if (superAdminEmail && superAdminEmail !== 'admin@example.com') {
                await sendEmail({
                    to: superAdminEmail,
                    subject: `📢 Employee Profile Update: ${portalId}`,
                    htmlContent: alertHtml
                });
            }
        } catch (emailErr) {
            console.warn('Could not send email to Super Admin:', emailErr.message);
        }

        return res.json({ success: true, message: 'Profile updated successfully. Administrators have been notified.', photoPath });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
};

exports.removePhoto = async (req, res) => {
    try {
        const portalId = req.employee.portalId;
        await db.execute('UPDATE users SET userPhotoPath = NULL WHERE PortalId = ?', [portalId]);
        return res.json({ success: true, message: 'Profile photo removed successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to remove profile photo.' });
    }
};

exports.getSchedules = async (req, res) => {
    try {
        const [rows] = await db.execute(
            "SELECT * FROM schedules WHERE portal_id = ? AND (status = 'pending' OR status IS NULL) ORDER BY date ASC, time ASC",
            [req.employee.portalId]
        );
        return res.json({ success: true, schedules: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve schedules.' });
    }
};

exports.markScheduleDone = async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;
        const portalId = req.employee.portalId;

        const [rows] = await db.execute(
            'SELECT s.*, u.Name as emp_name, u.dept FROM schedules s INNER JOIN users u ON u.PortalId = s.portal_id WHERE s.id = ? AND s.portal_id = ?',
            [id, portalId]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Schedule task not found.' });
        }

        const sched = rows[0];
        await db.execute(
            `UPDATE schedules SET status = 'completed', remarks = ? WHERE id = ?`,
            [remarks || 'Completed by staff.', id]
        );

        // Fetch DeptAdmin Email
        const [adminRows] = await db.execute(
            `SELECT Email FROM deptAdmin WHERE dept = ? LIMIT 1`,
            [sched.dept]
        );

        const adminEmail = adminRows.length ? adminRows[0].Email : null;
        if (adminEmail) {
            await sendEmail({
                to: adminEmail,
                subject: `📢 Task Marked Completed: ${sched.title} (${sched.emp_name})`,
                htmlContent: `
                    <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                        <h2 style="color: #16a34a; margin-bottom: 16px;">✅ Staff Task Completion Alert</h2>
                        <p>Employee <strong>${sched.emp_name}</strong> (${portalId}) has marked their assigned schedule/task as <strong>Completed</strong>.</p>
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                            <p><strong>Task Title:</strong> ${sched.title}</p>
                            <p><strong>Date & Time:</strong> ${sched.date} (${sched.time})</p>
                            <p><strong>Completion Remarks:</strong> ${remarks || 'No additional remarks provided.'}</p>
                        </div>
                    </div>
                `
            });
        }

        return res.json({ success: true, message: 'Task marked as completed and administrator notified.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to complete task.' });
    }
};
