// controllers/visitorAuthController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const db = require('../config/db');
const otpService = require('../services/otpService');
const aiScreeningService = require('../services/aiScreeningService');
const sendEmail = require('../services/emailService');
const cloudinaryService = require('../services/cloudinaryService');
const ocrService = require('../services/ocrService');

// Helper to delete local temp file
function deleteTempFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });
    }
}

// Generates unique 8-digit numeric visitor ID
async function generateUniqueVisitorId() {
    let id;
    let isUnique = false;
    while (!isUnique) {
        id = Math.floor(10000000 + Math.random() * 90000000).toString();
        const [rows] = await db.execute('SELECT id FROM visitors WHERE visitor_id = ?', [id]);
        if (rows.length === 0) {
            isUnique = true;
        }
    }
    return id;
}

// 1. Process OCR on uploaded ID Card
exports.processOcr = async (req, res) => {
    try {
        const identityProof = req.files?.identityProof?.[0]?.path;
        if (!identityProof) {
            return res.status(400).json({ success: false, message: 'Identity card proof image is required for OCR.' });
        }

        const ocrData = await ocrService.extractIdentityDetails(identityProof);

        // Delete temp file after OCR
        deleteTempFile(identityProof);

        return res.json({
            success: true,
            message: 'OCR details extracted successfully.',
            data: {
                identityType: ocrData.identityType,
                identityNumber: ocrData.identityNumber
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'OCR analysis failed.' });
    }
};

// 2. Send Registration OTP
exports.sendRegistrationOtp = async (req, res) => {
    try {
        const { email, full_name, contact_number } = req.body;

        if (!email || !full_name) {
            return res.status(400).json({ success: false, message: 'Name and Email are required.' });
        }

        const screeningResult = await aiScreeningService.screenVisitorDetails(full_name, email, contact_number);
        if (screeningResult.duplicateDetected) {
            if (screeningResult.reason === 'blocked') {
                return res.status(403).json({
                    success: false,
                    message: `Account Blocked: ${screeningResult.blockedReason || 'Suspicious details detected.'}`
                });
            }
            return res.status(409).json({
                success: false,
                message: 'An account with similar details may already exist — try Forgot Password'
            });
        }

        const otp = await otpService.createOtp(email, 'registration');
        
        await sendEmail({
            to: email,
            subject: 'VMS Portal - Validate Your Account Registration',
            textContent: `Your registration OTP code is: ${otp}. It will expire in 5 minutes.`
        });

        return res.json({ success: true, message: 'OTP sent to email.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to send registration OTP.' });
    }
};

// 3. Register Visitor
exports.registerVisitor = async (req, res) => {
    let photoLocalPath = null;
    let idProofLocalPath = null;

    try {
        const {
            full_name,
            email,
            contact_number,
            identity_type,
            identity_number,
            company_name,
            designation,
            password,
            otp
        } = req.body;

        photoLocalPath = req.files?.photo?.[0]?.path;
        idProofLocalPath = req.files?.identityProof?.[0]?.path;

        if (!photoLocalPath) {
            return res.status(400).json({ success: false, message: 'Profile photo is compulsory.' });
        }

        // Verify OTP
        const verifyRes = await otpService.verifyOtp(email, otp, 'registration');
        if (!verifyRes.success) {
            deleteTempFile(photoLocalPath);
            deleteTempFile(idProofLocalPath);
            return res.status(400).json({ success: false, message: verifyRes.message });
        }

        // Upload to Cloudinary
        const photoUrl = await cloudinaryService.uploadToCloudinary(photoLocalPath);
        let identityProofUrl = null;
        if (idProofLocalPath) {
            identityProofUrl = await cloudinaryService.uploadToCloudinary(idProofLocalPath);
        }

        // Clean local temp files
        deleteTempFile(photoLocalPath);
        deleteTempFile(idProofLocalPath);

        // Hash Password & Generate 8-Digit ID
        const passwordHash = await bcrypt.hash(password, 12);
        const visitorId = await generateUniqueVisitorId();

        // Save
        const [result] = await db.execute(
            `INSERT INTO visitors (visitor_id, full_name, email, contact_number, identity_type, identity_number, company_name, designation, password, photo_path, identity_proof_path) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                visitorId,
                full_name || null,
                email || null,
                contact_number || null,
                identity_type || null,
                identity_number || null,
                company_name || null,
                designation || null,
                passwordHash,
                photoUrl,
                identityProofUrl
            ]
        );

        // JWT Session
        const token = jwt.sign(
            { id: result.insertId, visitor_id: visitorId, email, full_name },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key',
            { expiresIn: '2d' }
        );

        res.cookie('visitor_token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000  // 2 days in ms
        });

        return res.status(201).json({
            success: true,
            message: 'Visitor account registered successfully',
            token,
            visitorId
        });
    } catch (err) {
        console.error(err);
        deleteTempFile(photoLocalPath);
        deleteTempFile(idProofLocalPath);
        return res.status(500).json({ success: false, message: 'Failed to register visitor account.' });
    }
};

// 4. Login Visitor (Using 8-Digit Visitor ID)
exports.loginVisitor = async (req, res) => {
    try {
        const { visitorId, password } = req.body;

        if (!visitorId || !password) {
            return res.status(400).json({ success: false, message: 'Visitor ID and Password are required.' });
        }

        const [rows] = await db.execute(
            `SELECT * FROM visitors WHERE visitor_id = ? OR email = ?`,
            [visitorId, visitorId]
        );

        if (!rows.length) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const visitor = rows[0];
        if (visitor.is_blocked) {
            return res.status(403).json({
                success: false,
                message: `Account Blocked: ${visitor.blocked_reason || 'No reason specified.'}`
            });
        }

        const match = await bcrypt.compare(String(password), visitor.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: visitor.id, visitor_id: visitor.visitor_id, email: visitor.email, full_name: visitor.full_name },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key',
            { expiresIn: '2d' }
        );

        res.cookie('visitor_token', token, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000  // 2 days in ms
        });

        return res.json({
            success: true,
            token,
            visitor: {
                id: visitor.id,
                visitor_id: visitor.visitor_id,
                email: visitor.email,
                full_name: visitor.full_name,
                photo_path: visitor.photo_path
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Login failed.' });
    }
};

// 5. Forgot Password OTP
exports.forgotPasswordOtp = async (req, res) => {
    try {
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'Name and Email are required.' });
        }

        const [rows] = await db.execute(
            'SELECT visitor_id FROM visitors WHERE full_name = ? AND email = ?',
            [name, email]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Account not found matching those details.' });
        }

        const otp = await otpService.createOtp(email, 'forgot-password');

        await sendEmail({
            to: email,
            subject: 'VMS Portal - Forgot Password Verification OTP',
            textContent: `Your verification OTP is: ${otp}. It will expire in 5 minutes.`
        });

        return res.json({ success: true, message: 'OTP sent successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
    }
};

// 6. Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const verifyRes = await otpService.verifyOtp(email, otp, 'forgot-password');
        if (!verifyRes.success) {
            return res.status(400).json({ success: false, message: verifyRes.message });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await db.execute(
            'UPDATE visitors SET password = ? WHERE email = ?',
            [passwordHash, email]
        );

        return res.json({ success: true, message: 'Password has been reset successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to reset password.' });
    }
};
