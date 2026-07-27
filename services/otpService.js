// services/otpService.js
const crypto = require('crypto');
const db = require('../config/db');

// Hash function helper
function hashOtp(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

// Generate 6 digit numeric OTP
function generateOtpCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.createOtp = async (email, purpose) => {
    // Generate new code
    const otp = generateOtpCode();
    const codeHash = hashOtp(otp);
    
    // Set 5-minute expiry
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    
    // Insert into db
    await db.execute(
        `INSERT INTO otps (email, code_hash, purpose, expires_at, attempt_count) 
         VALUES (?, ?, ?, ?, 0)`,
        [email, codeHash, purpose, expiresAt]
    );

    return otp;
};

exports.verifyOtp = async (email, otp, purpose) => {
    const codeHash = hashOtp(otp);
    
    // Find matching non-expired OTP record
    const [rows] = await db.execute(
        `SELECT id, expires_at, attempt_count FROM otps 
         WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1`,
        [email, purpose]
    );

    if (!rows.length) {
        return { success: false, message: 'No OTP record found.' };
    }

    const record = rows[0];

    // Expiry check
    if (new Date(record.expires_at) < new Date()) {
        return { success: false, message: 'OTP has expired.' };
    }

    // Attempt count check
    if (record.attempt_count >= 5) {
        return { success: false, message: 'Too many failed verification attempts.' };
    }

    const [matchRows] = await db.execute(
        `SELECT id FROM otps 
         WHERE id = ? AND code_hash = ?`,
        [record.id, codeHash]
    );

    if (!matchRows.length) {
        // Increment attempts
        await db.execute(
            `UPDATE otps SET attempt_count = attempt_count + 1 WHERE id = ?`,
            [record.id]
        );
        return { success: false, message: 'Invalid OTP code.' };
    }

    // Clean up used OTPs
    await db.execute(`DELETE FROM otps WHERE email = ? AND purpose = ?`, [email, purpose]);

    return { success: true };
};
