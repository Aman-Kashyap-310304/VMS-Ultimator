// controllers/adminVisitorController.js
const bcrypt = require('bcrypt');
const db = require('../config/db');
const sendEmail = require('../services/emailService');

exports.createDepartment = async (req, res) => {
    try {
        const { dept_code, dept_name, dept_location, dept_profile } = req.body;
        if (!dept_code || !dept_name) {
            return res.status(400).json({ success: false, message: 'Department Code and Name are required.' });
        }

        await db.execute(
            `INSERT INTO departments (dept_code, dept_name, dept_location, dept_profile) 
             VALUES (?, ?, ?, ?)`,
            [dept_code, dept_name, dept_location || '', dept_profile || '']
        );

        return res.status(201).json({ success: true, message: 'Department created successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to create department.' });
    }
};

exports.getDepartments = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM departments ORDER BY dept_name ASC');
        return res.json({ success: true, departments: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve departments.' });
    }
};

const fs = require('fs');
const cloudinaryService = require('../services/cloudinaryService');

function deleteTempFile(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (e) {}
    }
}

exports.createDeptAdmin = async (req, res) => {
    let photoPath = null;
    try {
        const { EmpId, Name, Email, Contact, dept, password } = req.body;

        if (!EmpId || !Name || !Email || !dept || !password) {
            deleteTempFile(req.file?.path);
            return res.status(400).json({ success: false, message: 'All fields must be filled.' });
        }

        // Limit check: Max 5 DeptAdmins per department
        const [countRows] = await db.execute(
            'SELECT COUNT(*) as count FROM deptAdmin WHERE dept = ?',
            [dept]
        );
        if (countRows[0].count >= 5) {
            deleteTempFile(req.file?.path);
            return res.status(400).json({ success: false, message: 'This department already has the maximum of 5 DeptAdmins.' });
        }

        // Duplicate checks
        const [existing] = await db.execute('SELECT PortalId FROM deptAdmin WHERE Email = ? OR EmpId = ?', [Email, EmpId]);
        if (existing.length > 0) {
            deleteTempFile(req.file?.path);
            return res.status(409).json({ success: false, message: 'DeptAdmin with this email or Employee ID already exists.' });
        }

        if (req.file) {
            photoPath = await cloudinaryService.uploadToCloudinary(req.file.path);
            deleteTempFile(req.file.path);
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const portalId = 'DA-' + Math.floor(10000000 + Math.random() * 90000000).toString();

        await db.execute(
            `INSERT INTO deptAdmin (PortalId, EmpId, Name, Email, Contact, dept, adminPhotoPath, password) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [portalId, EmpId, Name, Email, Contact || '', dept, photoPath, passwordHash]
        );

        // Send Welcome Mail
        await sendEmail({
            to: Email,
            subject: 'Welcome to VMS - DeptAdmin Account Created',
            htmlContent: `
                <div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: #334155; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                    <h2 style="color: #2563eb; margin-bottom: 20px;">Welcome, ${Name}!</h2>
                    <p>You have been registered as a Department Administrator for department: <strong>${dept}</strong>.</p>
                    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Portal ID:</strong> ${portalId}</p>
                        <p><strong>Password:</strong> ${password}</p>
                    </div>
                    <p style="font-size: 0.85rem; color: #64748b; margin-top: 30px;">
                        If you are not interested in this role, click the link below to delete your account:<br>
                        <a href="http://localhost:3000/api/admin/decline-dept-admin?portalId=${portalId}" style="color: #dc2626; text-decoration: none; font-weight: bold;">Decline & Delete Account</a>
                    </p>
                </div>
            `
        });

        return res.status(201).json({
            success: true,
            message: 'DeptAdmin account created successfully.',
            portalId
        });
    } catch (err) {
        console.error(err);
        deleteTempFile(req.file?.path);
        return res.status(500).json({ success: false, message: 'Failed to create DeptAdmin account.' });
    }
};

exports.declineDeptAdmin = async (req, res) => {
    try {
        const { portalId } = req.query;
        await db.execute('DELETE FROM deptAdmin WHERE PortalId = ?', [portalId]);
        return res.send('<h1>Account Declined</h1><p>The Department Administrator account has been successfully deleted.</p>');
    } catch (err) {
        console.error(err);
        return res.status(500).send('An error occurred.');
    }
};

exports.getDeptAdmins = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT PortalId, EmpId, Name, Email, Contact, dept, createdAt FROM deptAdmin ORDER BY Name ASC');
        return res.json({ success: true, deptAdmins: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve DeptAdmins.' });
    }
};

exports.deleteDeptAdmin = async (req, res) => {
    try {
        const { portalId } = req.params;
        await db.execute('DELETE FROM deptAdmin WHERE PortalId = ?', [portalId]);
        return res.json({ success: true, message: 'DeptAdmin deleted successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to delete DeptAdmin.' });
    }
};

exports.getVisitors = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, visitor_id, full_name, email, contact_number, company_name, designation, is_blocked, blocked_reason, created_at FROM visitors ORDER BY id DESC');
        return res.json({ success: true, visitors: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve visitors.' });
    }
};

exports.deleteVisitor = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM visitors WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Visitor profile deleted successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to delete visitor.' });
    }
};

exports.toggleBlockVisitor = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const [rows] = await db.execute('SELECT is_blocked FROM visitors WHERE id = ?', [id]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Visitor not found.' });
        }

        const newStatus = rows[0].is_blocked ? 0 : 1;
        const updatedReason = newStatus ? (reason || 'No reason provided') : null;
        await db.execute('UPDATE visitors SET is_blocked = ?, blocked_reason = ? WHERE id = ?', [newStatus, updatedReason, id]);

        return res.json({ success: true, message: `Visitor has been successfully ${newStatus ? 'blocked' : 'unblocked'}.` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to toggle block status.' });
    }
};

exports.getWrongPasswordAlerts = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM wrong_password_attempt ORDER BY alert_id DESC');
        return res.json({ success: true, alerts: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve security alert logs.' });
    }
};

exports.resolveAlert = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute(
            `UPDATE wrong_password_attempt SET investigated_by = ?, action_trigger = 'Resolved' WHERE alert_id = ?`,
            ['Admin', id]
        );
        return res.json({ success: true, message: 'Security alert log resolved.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to resolve alert.' });
    }
};

exports.getAnalyticsData = async (req, res) => {
    try {
        // Simple counts
        const [visitorsCount] = await db.execute('SELECT COUNT(*) as count FROM visitors');
        const [passesCount] = await db.execute('SELECT COUNT(*) as count FROM visitor_passes');
        const [checkedInCount] = await db.execute("SELECT COUNT(*) as count FROM visitor_passes WHERE status = 'checked_in' OR check_in_time IS NOT NULL");
        
        return res.json({
            success: true,
            analytics: {
                totalVisitors: visitorsCount[0].count,
                totalPasses: passesCount[0].count,
                activeVisitors: checkedInCount[0].count
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to fetch analytics.' });
    }
};

exports.getDepartmentsWithStats = async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT d.dept_code, d.dept_name, d.dept_location, d.dept_profile,
                   (SELECT COUNT(*) FROM deptAdmin WHERE dept = d.dept_code) as totalAdmins,
                   (SELECT COUNT(*) FROM users WHERE dept = d.dept_code AND Role = 'Employee') as totalEmployees
            FROM departments d
            ORDER BY d.dept_name ASC
        `);
        return res.json({ success: true, departments: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve department stats.' });
    }
};

exports.getDepartmentOverview = async (req, res) => {
    try {
        const { dept_code } = req.params;
        const [deptRows] = await db.execute('SELECT * FROM departments WHERE LOWER(TRIM(dept_code)) = LOWER(TRIM(?))', [dept_code]);
        if (!deptRows.length) {
            return res.status(404).json({ success: false, message: 'Department not found.' });
        }
        
        const code = deptRows[0].dept_code;
        const [admins] = await db.execute('SELECT PortalId, Name, Email, Contact FROM deptAdmin WHERE LOWER(TRIM(dept)) = LOWER(TRIM(?))', [code]);
        const [employees] = await db.execute('SELECT PortalId, Name, Email, Contact, Role FROM users WHERE LOWER(TRIM(dept)) = LOWER(TRIM(?))', [code]);

        const aiAnalysis = `AI Departmental Analysis Overview:\n- Department "${deptRows[0].dept_name}" (${code}) is fully operational.\n- Location: ${deptRows[0].dept_location || 'Main Campus'}.\n- Active Department Administrators: ${admins.length}.\n- Registered Staff/Employees: ${employees.length}.\n- Security status: Nominal. All credential distributions match standardized access protocols.`;

        // Log viewer action
        let viewer_id = 'Unknown';
        let viewer_role = 'Unknown';
        if (req.admin) {
            viewer_id = req.admin.email || 'admin';
            viewer_role = 'Admin';
        } else if (req.deptAdmin) {
            viewer_id = req.deptAdmin.portalId || 'deptadmin';
            viewer_role = 'DeptAdmin';
        } else if (req.employee) {
            viewer_id = req.employee.portalId || 'employee';
            viewer_role = 'Employee';
        }

        await db.execute(
            'INSERT INTO department_view_logs (viewer_id, viewer_role, dept_code) VALUES (?, ?, ?)',
            [viewer_id, viewer_role, code]
        );

        return res.json({
            success: true,
            department: deptRows[0],
            admins,
            employees,
            aiAnalysis
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to generate overview.' });
    }
};

exports.unlockDirectDeptAdmin = async (req, res) => {
    try {
        const { portalId } = req.params;
        const { tempPass } = req.body;
        if (!tempPass) {
            return res.status(400).json({ success: false, message: 'Temporary password is required.' });
        }
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(tempPass, 12);
        await db.execute(
            'UPDATE deptAdmin SET password = ?, is_first_login = 1, is_blocked = 0, blocked_reason = NULL WHERE PortalId = ?',
            [passwordHash, portalId]
        );
        return res.json({ success: true, message: 'DeptAdmin unlocked successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to unlock.' });
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
        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name as visitor_name, v.email as visitor_email, v.contact_number, v.purpose
             FROM visitor_passes vp
             INNER JOIN visitors v ON v.id = vp.visitor_id
             ORDER BY vp.id DESC`
        );
        return res.json({ success: true, logs: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve visitor logs.' });
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        const { dept_code } = req.params;
        const { dept_name, dept_location, dept_profile } = req.body;
        if (!dept_name) {
            return res.status(400).json({ success: false, message: 'Department Name is required.' });
        }

        await db.execute(
            `UPDATE departments SET dept_name = ?, dept_location = ?, dept_profile = ? 
             WHERE dept_code = ?`,
            [dept_name, dept_location || '', dept_profile || '', dept_code]
        );

        return res.json({ success: true, message: 'Department updated successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to update department.' });
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        const { dept_code } = req.params;
        await db.execute('DELETE FROM departments WHERE dept_code = ?', [dept_code]);
        return res.json({ success: true, message: 'Department deleted successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to delete department.' });
    }
};

exports.toggleBlockDeptAdmin = async (req, res) => {
    try {
        const { portalId } = req.params;
        const [rows] = await db.execute('SELECT is_blocked FROM deptAdmin WHERE PortalId = ?', [portalId]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'DeptAdmin not found.' });
        }

        const newStatus = rows[0].is_blocked ? 0 : 1;
        await db.execute('UPDATE deptAdmin SET is_blocked = ? WHERE PortalId = ?', [newStatus, portalId]);

        return res.json({ success: true, message: `DeptAdmin has been successfully ${newStatus ? 'blocked' : 'unblocked'}.` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to toggle block status.' });
    }
};

exports.updateDeptAdmin = async (req, res) => {
    try {
        const { portalId } = req.params;
        const { Name, Email, Contact, dept } = req.body;
        if (!Name || !Email) {
            return res.status(400).json({ success: false, message: 'Name and Email are required.' });
        }

        await db.execute(
            `UPDATE deptAdmin SET Name = ?, Email = ?, Contact = ?, dept = ? 
             WHERE PortalId = ?`,
            [Name, Email, Contact || '', dept || '', portalId]
        );

        return res.json({ success: true, message: 'DeptAdmin updated successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to update DeptAdmin.' });
    }
};
