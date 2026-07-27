// controllers/deptAdminAuthController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const db = require('../config/db');
const sendEmail = require('../services/emailService');
const cloudinaryService = require('../services/cloudinaryService');

exports.loginDeptAdmin = async (req, res) => {
    try {
        const { portalId, password } = req.body;

        if (!portalId || !password) {
            return res.status(400).json({ success: false, message: 'Portal ID and Password are required.' });
        }

        // Check if the account is currently blocked due to password lockout attempts (10 failed tries)
        const [lockoutCheck] = await db.execute(
            `SELECT COUNT(*) as attempts FROM wrong_password_attempt 
             WHERE portal_id = ? AND role = 'DeptAdmin' AND issue_createdAt > NOW() - INTERVAL 1 HOUR`,
            [portalId]
        );

        if (lockoutCheck[0].attempts >= 10) {
            return res.status(403).json({
                success: false,
                message: 'Account temporarily locked out. 10 consecutive failed password attempts detected. System Administrator has been notified.'
            });
        }

        const [rows] = await db.execute(
            `SELECT * FROM deptAdmin WHERE PortalId = ?`,
            [portalId]
        );

        if (!rows.length) {
            // Track failed login attempt
            const deviceType = (req.headers['user-agent'] || 'Unknown Device').substring(0, 100);
            const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
            await db.execute(
                `INSERT INTO wrong_password_attempt (portal_id, role, timestampt, device_type, ip_address, action_trigger, investigated_by) 
                 VALUES (?, 'DeptAdmin', NOW(), ?, ?, 'Brute force lockout attempt', 'Pending')`,
                [portalId, deviceType, ipAddress]
            );

            // Fetch cumulative attempts after this insert
            const [postInsertCheck] = await db.execute(
                `SELECT COUNT(*) as attempts FROM wrong_password_attempt 
                 WHERE portal_id = ? AND role = 'DeptAdmin' AND issue_createdAt > NOW() - INTERVAL 1 HOUR`,
                [portalId]
            );

            if (postInsertCheck[0].attempts >= 10) {
                return res.status(403).json({
                    success: false,
                    message: 'Maximum password attempts exceeded. Account is locked. Admin notified.'
                });
            }

            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const admin = rows[0];
        const match = await bcrypt.compare(String(password), admin.password);
        if (!match) {
            // Track failed password attempt
            const deviceType = (req.headers['user-agent'] || 'Unknown Device').substring(0, 100);
            const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
            await db.execute(
                `INSERT INTO wrong_password_attempt (portal_id, role, timestampt, device_type, ip_address, action_trigger, investigated_by) 
                 VALUES (?, 'DeptAdmin', NOW(), ?, ?, 'Incorrect password check', 'Pending')`,
                [portalId, deviceType, ipAddress]
            );

            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Check if user has changed their password yet.
        const isFirstLogin = admin.is_first_login === 1; 

        // Generate token valid for 3 days as requested
        const token = jwt.sign(
            { portalId: admin.PortalId, emp_id: admin.EmpId, name: admin.Name, role: 'DeptAdmin', dept: admin.dept },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key',
            { expiresIn: '3d' }
        );

        res.cookie('deptadmin_token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 3 * 24 * 60 * 60 * 1000 
        });

        return res.json({
            success: true,
            token,
            firstLogin: isFirstLogin,
            admin: { portalId: admin.PortalId, name: admin.Name, dept: admin.dept }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Login failed.' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT PortalId, EmpId, Name, Email, Contact, dept, adminPhotoPath, createdAt FROM deptAdmin WHERE PortalId = ?',
            [req.deptAdmin.portalId]
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
            'UPDATE deptAdmin SET password = ?, is_first_login = 0 WHERE PortalId = ?',
            [passwordHash, req.deptAdmin.portalId]
        );

        return res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to change password.' });
    }
};

function deleteTempFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (e) {}
    }
}

exports.updateProfile = async (req, res) => {
    let photoPath = null;
    try {
        const { Name, Email, Contact } = req.body;
        const portalId = req.deptAdmin.portalId;

        if (!Name || !Email) {
            deleteTempFile(req.file?.path);
            return res.status(400).json({ success: false, message: 'Name and Email are required.' });
        }

        const [rows] = await db.execute('SELECT adminPhotoPath FROM deptAdmin WHERE PortalId = ?', [portalId]);
        if (!rows.length) {
            deleteTempFile(req.file?.path);
            return res.status(404).json({ success: false, message: 'DeptAdmin not found.' });
        }

        const admin = rows[0];
        photoPath = admin.adminPhotoPath;

        if (req.file) {
            photoPath = await cloudinaryService.uploadToCloudinary(req.file.path);
            deleteTempFile(req.file.path);
        }

        await db.execute(
            'UPDATE deptAdmin SET Name = ?, Email = ?, Contact = ?, adminPhotoPath = ? WHERE PortalId = ?',
            [Name, Email, Contact || '', photoPath, portalId]
        );

        // Notify Super Admin
        await sendEmail({
            to: process.env.ADMIN_EMAIL || 'admin@example.com',
            subject: `📢 DeptAdmin Profile Update: ${portalId}`,
            htmlContent: `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155;">
                    <h3>Department Administrator Profile Updated</h3>
                    <p><strong>Portal ID:</strong> ${portalId}</p>
                    <p><strong>Name:</strong> ${Name}</p>
                    <p><strong>Email:</strong> ${Email}</p>
                    <p><strong>Contact:</strong> ${Contact || 'N/A'}</p>
                </div>
            `
        });

        return res.json({ success: true, message: 'Profile updated successfully.', photoPath });
    } catch (err) {
        console.error(err);
        deleteTempFile(req.file?.path);
        return res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
};

exports.removePhoto = async (req, res) => {
    try {
        const portalId = req.deptAdmin.portalId;
        await db.execute('UPDATE deptAdmin SET adminPhotoPath = NULL WHERE PortalId = ?', [portalId]);
        return res.json({ success: true, message: 'Profile photo removed successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to remove profile photo.' });
    }
};
