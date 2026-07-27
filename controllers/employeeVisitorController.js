// controllers/employeeVisitorController.js
const db = require('../config/db');

exports.getAssignedPasses = async (req, res) => {
    try {
        await db.cleanupOldRecords();
        const empName = req.employee.name;

        const [rows] = await db.execute(
            `SELECT vp.*, v.full_name, v.email, v.contact_number, v.purpose 
             FROM visitor_passes vp 
             INNER JOIN visitors v ON v.id = vp.visitor_id 
             WHERE vp.host_employee_name = ? AND vp.status != 'rejected' ORDER BY vp.id DESC`,
            [empName]
        );

        return res.json({ success: true, passes: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve passes.' });
    }
};

exports.markArrival = async (req, res) => {
    try {
        const { passId } = req.params;

        await db.execute(
            `UPDATE visitor_passes SET check_in_time = NOW() WHERE pass_number = ?`,
            [passId]
        );

        return res.json({ success: true, message: 'Visitor marked as arrived.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to update visitor arrival status.' });
    }
};

exports.flagVisitorLeft = async (req, res) => {
    try {
        const { passId } = req.params;

        await db.execute(
            `UPDATE visitor_passes SET host_flagged_left_time = NOW() WHERE pass_number = ?`,
            [passId]
        );

        return res.json({ success: true, message: 'Visitor flagged as left.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to flag visitor as left.' });
    }
};
