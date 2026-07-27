// controllers/deptAdminVisitorController.js
const bcrypt = require('bcrypt');
const fs = require('fs');
const db = require('../config/db');
const sendEmail = require('../services/emailService');
const cloudinaryService = require('../services/cloudinaryService');
const approvalTemplate = require('../templates/approvalTemplate');
const rejectionTemplate = require('../templates/rejectionTemplate');

function deleteTempFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            console.error('Failed to clear temp file:', e);
        }
    }
}

async function generateUniqueUserPortalId(role) {
    let exists = true;
    let portalId = '';
    const prefix = (role === 'Security') ? 'SEC-' : 'EMP-';
    while (exists) {
        const num = Math.floor(1000000 + Math.random() * 9000000).toString();
        portalId = prefix + num;
        const [rows] = await db.execute('SELECT PortalId FROM users WHERE PortalId = ?', [portalId]);
        if (rows.length === 0) exists = false;
    }
    return portalId;
}

exports.getVisitorRequests = async (req, res) => {
    try {
        const dept = req.deptAdmin.dept;

        const [rows] = await db.execute(
            `SELECT vp.id as pass_id, vp.pass_number, vp.host_employee_name, vp.visit_date, vp.visit_time, vp.status, 
                    v.full_name as visitor_name, v.email as visitor_email, v.contact_number, v.purpose, v.photo_path
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE LOWER(TRIM(vp.host_department)) = LOWER(TRIM(?)) AND vp.status = 'pending'
             ORDER BY vp.id DESC`,
            [dept]
        );

        return res.json({ success: true, requests: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve visitor requests.' });
    }
};

exports.approveVisitorRequest = async (req, res) => {
    try {
        const { passId } = req.params;
        const { host_employee_name, visit_date, visit_time } = req.body;

        if (!host_employee_name || !visit_date || !visit_time) {
            return res.status(400).json({ success: false, message: 'Host Employee, Date and Time are required.' });
        }

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name, v.email as visitor_email 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.id = ?`,
            [passId]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Visitor request pass not found.' });
        }

        const request = rows[0];

        // Validate that the host employee exists to build proper database relationships
        const [empRows] = await db.execute(
            'SELECT PortalId, Email FROM users WHERE LOWER(TRIM(Name)) = LOWER(TRIM(?)) LIMIT 1',
            [host_employee_name]
        );

        if (!empRows.length) {
            return res.status(404).json({
                success: false,
                message: `Host Employee "${host_employee_name}" is not registered in the system. Please verify the employee name.`
            });
        }

        const employee = empRows[0];
        const finalPassNumber = 'PASS-' + Math.floor(10000000 + Math.random() * 90000000).toString();

        // 1. Generate PDF Pass
        const pdfService = require('../services/pdfService');
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
        const cloudinaryService = require('../services/cloudinaryService');
        const passPdfUrl = await cloudinaryService.uploadToCloudinary(tempPdfPath);
        
        // Clean up temp file
        try {
            const fs = require('fs');
            if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        } catch(e) {}

        // 3. Update pass record with approved status, pass number, and pdf url
        await db.execute(
            `UPDATE visitor_passes 
             SET pass_number = ?, host_employee_name = ?, visit_date = ?, visit_time = ?, status = 'approved', pass_pdf_url = ?
             WHERE id = ?`,
            [finalPassNumber, host_employee_name, visit_date, visit_time, passPdfUrl, passId]
        );

        // 4. Create schedule record for host employee automatically
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

        return res.json({ success: true, message: 'Visitor pass approved successfully.', passNumber: finalPassNumber, passPdfUrl });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to approve visitor pass.' });
    }
};

exports.rejectVisitorRequest = async (req, res) => {
    try {
        const { passId } = req.params;
        const { reason } = req.body;

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name, v.email as visitor_email 
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE vp.id = ?`,
            [passId]
        );

        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Visitor request pass not found.' });
        }

        const request = rows[0];

        await db.execute(
            `UPDATE visitor_passes SET status = 'rejected' WHERE id = ?`,
            [passId]
        );

        await sendEmail({
            to: request.visitor_email,
            subject: '❌ Visitor Request Rejected',
            htmlContent: rejectionTemplate({
                visitorName: request.visitor_name,
                reason: reason || 'Administrative decision.'
            })
        });

        return res.json({ success: true, message: 'Visitor request rejected.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to reject visitor request.' });
    }
};

exports.createStaffUser = async (req, res) => {
    let photoPath = null;
    try {
        const { EmpId, Name, Email, Contact, password, dept } = req.body;

        if (!EmpId || !Name || !Email || !password || !dept) {
            deleteTempFile(req.file?.path);
            return res.status(400).json({ success: false, message: 'All required fields (Employee ID, Name, Email, Password, Department) must be filled.' });
        }

        if (req.file) {
            photoPath = await cloudinaryService.uploadToCloudinary(req.file.path);
            deleteTempFile(req.file.path);
        }

        // Auto assign Role based on department
        const role = (dept === 'SEC' || dept === 'Security' || dept.includes('Security') || dept.includes('SEC')) ? 'Security' : 'Employee';

        const portalId = await generateUniqueUserPortalId(role);
        const passwordHash = await bcrypt.hash(password, 12);

        await db.execute(
            `INSERT INTO users (PortalId, EmpId, Name, Email, Contact, dept, Role, userPhotoPath, password) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [portalId, EmpId, Name, Email, Contact || '', dept, role, photoPath, passwordHash]
        );

        // Send Welcome Mail with Decline Link
        await sendEmail({
            to: Email,
            subject: 'Welcome to VMS - User Account Created',
            htmlContent: `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                    <h2 style="color: #2563eb; margin-bottom: 20px;">Welcome, ${Name}!</h2>
                    <p>You have been registered as a <strong>${role}</strong> in department: <strong>${dept}</strong>.</p>
                    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Portal ID:</strong> ${portalId}</p>
                        <p><strong>Password:</strong> ${password}</p>
                    </div>
                    <p style="font-size: 0.85rem; color: #64748b; margin-top: 30px;">
                        If you are not interested in this role, click the link below to delete your account:<br>
                        <a href="http://localhost:3000/api/deptadmin/decline-role?portalId=${portalId}" style="color: #dc2626; text-decoration: none; font-weight: bold;">Decline & Delete Account</a>
                    </p>
                </div>
            `
        });

        return res.status(201).json({ success: true, message: 'Staff user profile registered successfully.', portalId });
    } catch (err) {
        console.error(err);
        deleteTempFile(req.file?.path);
        return res.status(500).json({ success: false, message: 'Failed to register staff user.' });
    }
};

exports.declineUserRole = async (req, res) => {
    try {
        const { portalId } = req.query;
        await db.execute('DELETE FROM users WHERE PortalId = ?', [portalId]);
        return res.send('<h1>Account Declined</h1><p>Your user profile has been successfully deleted from the database.</p>');
    } catch (err) {
        console.error(err);
        return res.status(500).send('An error occurred.');
    }
};

exports.getStaffUsers = async (req, res) => {
    try {
        const dept = req.deptAdmin.dept;
        let [rows] = await db.execute(
            'SELECT PortalId, EmpId, Name, Email, Contact, dept, Role, userPhotoPath, createdAt FROM users WHERE LOWER(TRIM(dept)) = LOWER(TRIM(?)) ORDER BY Name ASC',
            [dept || '']
        );
        if (rows.length === 0) {
            const [allUsers] = await db.execute(
                'SELECT PortalId, EmpId, Name, Email, Contact, dept, Role, userPhotoPath, createdAt FROM users ORDER BY Name ASC'
            );
            rows = allUsers;
        }
        return res.json({ success: true, staff: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve staff users.' });
    }
};

exports.deleteStaffUser = async (req, res) => {
    try {
        const { portalId } = req.params;
        await db.execute('DELETE FROM users WHERE PortalId = ?', [portalId]);
        return res.json({ success: true, message: 'Staff user deleted.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to delete staff.' });
    }
};

exports.unlockDirectUser = async (req, res) => {
    try {
        const { portalId } = req.params;
        const { tempPass } = req.body;
        if (!tempPass) {
            return res.status(400).json({ success: false, message: 'Temporary password is required.' });
        }
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(tempPass, 12);
        await db.execute(
            'UPDATE users SET password = ?, is_first_login = 1, is_blocked = 0, blocked_reason = NULL WHERE PortalId = ?',
            [passwordHash, portalId]
        );
        return res.json({ success: true, message: 'User unlocked successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to unlock user.' });
    }
};

exports.createSchedule = async (req, res) => {
    try {
        const { portal_id, title, date, time, description } = req.body;
        if (!portal_id || !title || !date || !time) {
            return res.status(400).json({ success: false, message: 'Staff ID, Title, Date, and Time are required.' });
        }
        await db.execute(
            'INSERT INTO schedules (portal_id, title, date, time, description) VALUES (?, ?, ?, ?, ?)',
            [portal_id, title, date, time, description || '']
        );
        return res.status(201).json({ success: true, message: 'Schedule created successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to create schedule.' });
    }
};

exports.getSchedules = async (req, res) => {
    try {
        const dept = req.deptAdmin.dept;
        let [rows] = await db.execute(
            `SELECT s.*, u.Name as staff_name FROM schedules s
             INNER JOIN users u ON u.PortalId = s.portal_id
             WHERE LOWER(TRIM(u.dept)) = LOWER(TRIM(?)) AND (s.status = 'pending' OR s.status IS NULL)
             ORDER BY s.date ASC, s.time ASC`,
            [dept || '']
        );
        if (rows.length === 0) {
            const [allSchedules] = await db.execute(
                `SELECT s.*, u.Name as staff_name FROM schedules s
                 INNER JOIN users u ON u.PortalId = s.portal_id
                 WHERE (s.status = 'pending' OR s.status IS NULL)
                 ORDER BY s.date ASC, s.time ASC`
            );
            rows = allSchedules;
        }
        return res.json({ success: true, schedules: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve schedules.' });
    }
};

exports.deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM schedules WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Schedule deleted.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to delete schedule.' });
    }
};

exports.updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, time, description } = req.body;

        // Fetch existing schedule first
        const [rows] = await db.execute('SELECT * FROM schedules WHERE id = ?', [id]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Schedule not found.' });
        }
        const existing = rows[0];

        const finalTitle = title !== undefined ? title : existing.title;
        const finalDate = date !== undefined ? date : existing.date;
        const finalTime = time !== undefined ? time : existing.time;
        const finalDesc = description !== undefined ? description : existing.description;

        await db.execute(
            `UPDATE schedules SET title = ?, date = ?, time = ?, description = ? WHERE id = ?`,
            [finalTitle, finalDate, finalTime, finalDesc || '', id]
        );
        return res.json({ success: true, message: 'Schedule/shift updated successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to update schedule.' });
    }
};

exports.markScheduleDone = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            `SELECT s.*, u.Name as staff_name, u.Email as staff_email FROM schedules s 
             INNER JOIN users u ON u.PortalId = s.portal_id WHERE s.id = ?`,
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Schedule not found.' });
        }

        const sched = rows[0];
        await db.execute(`UPDATE schedules SET status = 'completed' WHERE id = ?`, [id]);

        if (sched.staff_email) {
            await sendEmail({
                to: sched.staff_email,
                subject: `✅ Work Schedule Completed: ${sched.title}`,
                htmlContent: `
                    <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                        <h2 style="color: #16a34a; margin-bottom: 16px;">✅ Work Schedule Completed</h2>
                        <p>Hello <strong>${sched.staff_name}</strong>,</p>
                        <p>Your administrator has marked the following task as <strong>Done / Completed</strong>:</p>
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                            <p><strong>Title:</strong> ${sched.title}</p>
                            <p><strong>Date:</strong> ${sched.date}</p>
                            <p><strong>Time:</strong> ${sched.time}</p>
                            <p><strong>Description:</strong> ${sched.description || 'N/A'}</p>
                        </div>
                    </div>
                `
            });
        }

        return res.json({ success: true, message: 'Schedule marked as completed. Record retained for AI knowledge.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to mark schedule as done.' });
    }
};

exports.getVisitorProfileUpdates = async (req, res) => {
    try {
        await db.cleanupOldRecords();
        const [rows] = await db.execute(`
            SELECT vpu.*, v.full_name as visitor_name, v.visitor_id
            FROM visitor_profile_updates vpu
            INNER JOIN visitors v ON v.id = vpu.visitor_id
            ORDER BY vpu.id DESC
        `);
        return res.json({ success: true, logs: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve visitor profile updates.' });
    }
};

exports.getVisitorLogs = async (req, res) => {
    try {
        await db.cleanupOldRecords();
        const dept = req.deptAdmin.dept;

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name, v.email as visitor_email, v.contact_number, v.purpose
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             WHERE LOWER(TRIM(vp.host_department)) = LOWER(TRIM(?))
             ORDER BY vp.id DESC`,
            [dept]
        );

        return res.json({ success: true, logs: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve visitor logs.' });
    }
};
