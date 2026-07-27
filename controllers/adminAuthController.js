// controllers/adminAuthController.js
const jwt = require('jsonwebtoken');
const otpService = require('../services/otpService');
const sendEmail = require('../services/emailService');

exports.loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const envEmail = process.env.ADMIN_EMAIL;
        const envPassword = process.env.ADMIN_PASSWORD;

        if (email !== envEmail || password !== envPassword) {
            return res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
        }

        // Direct login, no OTP required
        const token = jwt.sign(
            { email, role: 'admin', name: process.env.ADMIN_NAME },
            process.env.JWT_SECRET || 'your_super_secret_jwt_key',
            { expiresIn: '2d' }
        );


        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 2 * 24 * 60 * 60 * 1000  // 2 days in ms
        });

        return res.json({
            success: true,
            token,
            admin: { email, name: process.env.ADMIN_NAME }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

exports.forgotPasswordOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (email !== process.env.ADMIN_EMAIL) {
            return res.status(404).json({ success: false, message: 'Invalid administrative email address.' });
        }

        const otp = await otpService.createOtp(email, 'admin-forgot');

        await sendEmail({
            to: email,
            subject: 'VMS Admin Password Reveal OTP Code',
            textContent: `Your VMS Admin password reveal OTP code is: ${otp}. It will expire in 5 minutes.`
        });

        return res.json({ success: true, message: 'OTP code sent to admin email.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to send OTP.' });
    }
};

exports.revealPassword = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const verifyRes = await otpService.verifyOtp(email, otp, 'admin-forgot');
        if (!verifyRes.success) {
            return res.status(400).json({ success: false, message: verifyRes.message });
        }

        // Return the administrative password to display
        return res.json({
            success: true,
            password: process.env.ADMIN_PASSWORD
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
    }
};

exports.getAdminProfile = async (req, res) => {
    return res.json({
        success: true,
        profile: {
            name: process.env.ADMIN_NAME || 'Super Administrator',
            email: process.env.ADMIN_EMAIL || 'admin@example.com'
        }
    });
};
