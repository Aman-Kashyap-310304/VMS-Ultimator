// controllers/securityAuthController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const sendEmail = require('../services/emailService');

exports.loginSecurity = async (req, res) => {
    try {
        const { portalId, password } = req.body;

        if (!portalId || !password) {
            return res.status(400).json({ success: false, message: 'Portal ID and password are required.' });
        }

        const [rows] = await db.execute(
            `SELECT * FROM users WHERE PortalId = ? AND Role = 'Security'`,
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
                 VALUES (?, 'Security', NOW(), ?, ?, 'Incorrect password check', 'Pending')`,
                [portalId, deviceType, ipAddress]
            );

            // Fetch cumulative attempts
            const [checkRows] = await db.execute(
                `SELECT COUNT(*) as attempts FROM wrong_password_attempt 
                 WHERE portal_id = ? AND role = 'Security' AND issue_createdAt > NOW() - INTERVAL 1 HOUR`,
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
                        <p>A Security officer account has been temporarily locked out due to <strong>10 consecutive failed password attempts</strong>.</p>
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Security Name:</strong> ${user.Name}</p>
                            <p><strong>Portal ID:</strong> ${user.PortalId}</p>
                            <p><strong>Department:</strong> ${user.dept}</p>
                            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                    </div>
                `;

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
            { portalId: user.PortalId, emp_id: user.EmpId, name: user.Name, role: 'Security', dept: user.dept },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key',
            { expiresIn: '2d' }
        );

        res.cookie('security_token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000  // 2 days in ms 
        });

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
            [req.security.portalId]
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
            [passwordHash, req.security.portalId]
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
        const portalId = req.security.portalId;

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

        const alertHtml = `
            <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155;">
                <h3>📢 Security Profile Updated</h3>
                <p><strong>Portal ID:</strong> ${portalId}</p>
                <p><strong>Name:</strong> ${Name}</p>
                <p><strong>Email:</strong> ${Email}</p>
                <p><strong>Contact:</strong> ${Contact || 'N/A'}</p>
            </div>
        `;

        if (adminEmail) {
            await sendEmail({ to: adminEmail, subject: `📢 Security Profile Update: ${portalId}`, htmlContent: alertHtml });
        }
        await sendEmail({ to: superAdminEmail, subject: `📢 Security Profile Update: ${portalId}`, htmlContent: alertHtml });

        return res.json({ success: true, message: 'Profile updated successfully.', photoPath });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
};

exports.removePhoto = async (req, res) => {
    try {
        const portalId = req.security.portalId;
        await db.execute('UPDATE users SET userPhotoPath = NULL WHERE PortalId = ?', [portalId]);
        return res.json({ success: true, message: 'Profile photo removed successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to remove profile photo.' });
    }
};
