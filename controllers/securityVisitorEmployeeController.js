// controllers/securityController.js

const db =
    require('../config/db');

const sendEmail =
    require('../services/emailService');

const checkInTemplate =
    require('../templates/checkInTemplate');


// =====================================
// FETCH VISITOR DETAILS
// =====================================

exports.getVisitorDetails =
    async (req, res) => {

        try {

            const passId =
                req.params.passId;

            const [rows] =
                await db.execute(

                    `
                    SELECT

                        v.*,

                        vp.pass_number,

                        vp.host_employee_name,

                        vp.host_department,

                        vp.visit_date,

                        vp.visit_time,

                        vp.check_in_time,

                        vp.check_out_time

                    FROM visitor_passes vp

                    INNER JOIN visitors v

                    ON v.id = vp.visitor_id

                    WHERE vp.pass_number = ?
                    `,
                    [passId]
                );

            if (!rows.length) {

                return res.status(404).json({

                    success: false,

                    message:
                        'Visitor Pass Not Found'
                });
            }

            return res.json({

                success: true,

                visitor:
                    rows[0]
            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({

                success: false,

                message:
                    'Unable to fetch visitor details'
            });
        }
    };


// =====================================
// CHECK IN
// =====================================

exports.checkInVisitor = async (req, res) => {

    try {

        const passId =
            req.params.passId;

        const [rows] =
            await db.execute(

                `
                SELECT
                    check_in_time,
                    check_out_time

                FROM visitor_passes

                WHERE pass_number = ?
                `,
                [passId]
            );

        if (!rows.length) {

            return res.status(404).json({

                success: false,

                message:
                    'Invalid Pass ID'
            });
        }

        const visitor =
            rows[0];

        if (visitor.check_in_time) {

            return res.status(400).json({

                success: false,

                message:
                    'Visitor Already Checked In'
            });
        }

        await db.execute(

            `
            UPDATE visitor_passes

            SET
                check_in_time = NOW(),
                checked_in_by = ?

            WHERE pass_number = ?
            `,
            [
                req.security.emp_id,
                passId
            ]
        );

        // Fetch complete visitor details

        const [visitorRows] =
            await db.execute(

                `
                SELECT

                    v.full_name,
                    v.email,

                    vp.pass_number,
                    vp.host_employee_name,
                    vp.host_department

                FROM visitor_passes vp

                INNER JOIN visitors v
                ON v.id = vp.visitor_id

                WHERE vp.pass_number = ?
                `,
                [passId]
            );

        if (!visitorRows.length) {

            return res.status(404).json({

                success: false,

                message:
                    'Visitor details not found'
            });
        }

        const visitorInfo =
            visitorRows[0];

        console.log(
            'Check-In Email To:',
            visitorInfo.email
        );

        await sendEmail({

            to:
                visitorInfo.email,

            subject:
                '🏢 Visitor Check-In Confirmation',

            htmlContent:
                checkInTemplate({

                    visitorName:
                        visitorInfo.full_name,

                    passNumber:
                        visitorInfo.pass_number,

                    employeeName:
                        visitorInfo.host_employee_name,

                    department:
                        visitorInfo.host_department,

                    checkInTime:
                        new Date()
                            .toLocaleString()
                }),

            textContent:
                `Your visitor pass ${visitorInfo.pass_number} has been checked in.`
        });

        return res.json({

            success: true,

            message:
                'Visitor Checked In Successfully'
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message:
                'Unable to Check In Visitor'
        });
    }
};


// =====================================
// CHECK OUT
// =====================================

exports.checkOutVisitor =
    async (req, res) => {

        try {

            const passId =
                req.params.passId;

            const [rows] =
                await db.execute(

                    `
                    SELECT
                        check_in_time,
                        check_out_time

                    FROM visitor_passes

                    WHERE pass_number = ?
                    `,
                    [passId]
                );

            if (!rows.length) {

                return res.status(404).json({

                    success: false,

                    message:
                        'Invalid Pass ID'
                });
            }

            const visitor =
                rows[0];

            if (
                !visitor.check_in_time
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Visitor Not Checked In Yet'
                });
            }

            if (
                visitor.check_out_time
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Visitor Already Checked Out'
                });
            }

            await db.execute(

                `
                UPDATE visitor_passes

                SET

                    check_out_time = NOW(),

                    checked_out_by = ?

                WHERE pass_number = ?
                `,
                [
                    req.security.emp_id,
                    passId
                ]
            );

            return res.json({

                success: true,

                message:
                    'Visitor Checked Out Successfully'
            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({

                success: false,

                message:
                    'Unable to Check Out Visitor'
            });
        }
    };


// =====================================
// TODAY LOGS
// =====================================

exports.getTodayLogs =
    async (req, res) => {

        try {
            await db.cleanupOldRecords();
            const [rows] =
                await db.execute(

                    `
                    SELECT

                        v.full_name,

                        vp.pass_number,

                        vp.visit_date,

                        vp.check_in_time,

                        vp.check_out_time

                    FROM visitor_passes vp

                    INNER JOIN visitors v

                    ON v.id = vp.visitor_id

                    ORDER BY
                        vp.id DESC
                    `
                );

            return res.json({
                success: true,
                logs: rows
            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({

                success: false,

                message:
                    'Unable to fetch logs'
            });
        }
    };

exports.getVisitsToMonitor = async (req, res) => {
    try {
        await db.cleanupOldRecords();
        const [rows] = await db.execute(`
            SELECT vp.*, v.full_name, v.email, v.contact_number, v.photo_path
            FROM visitor_passes vp
            INNER JOIN visitors v ON v.id = vp.visitor_id
            WHERE vp.status = 'approved' OR vp.status = 'checked_in' OR (vp.check_in_time IS NOT NULL AND vp.check_out_time IS NULL)
            ORDER BY vp.id DESC
        `);
        return res.json({ success: true, visits: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to retrieve visits.' });
    }
};

exports.getSecurityAlerts = async (req, res) => {
    try {
        await db.cleanupOldRecords();
        // 1. Visitors checked in > 8 hours ago but not checked out
        const [overstayRows] = await db.execute(`
            SELECT vp.pass_number, v.full_name, vp.check_in_time, vp.host_employee_name, 'Stayed checked in for more than 8 hours' as reason
            FROM visitor_passes vp
            INNER JOIN visitors v ON v.id = vp.visitor_id
            WHERE vp.check_in_time IS NOT NULL 
              AND vp.check_out_time IS NULL 
              AND vp.check_in_time < NOW() - INTERVAL 8 HOUR
        `);

        // 2. Visitors not checked out 15 minutes after employee schedule completed/marked done
        const [scheduleAlerts] = await db.execute(`
            SELECT vp.pass_number, v.full_name, vp.check_in_time, vp.host_employee_name, 'Schedule marked as done but visitor still checked in (>15 mins)' as reason
            FROM visitor_passes vp
            INNER JOIN visitors v ON v.id = vp.visitor_id
            INNER JOIN users u ON u.Name = vp.host_employee_name
            INNER JOIN schedules s ON s.portal_id = u.PortalId
            WHERE vp.check_in_time IS NOT NULL
              AND vp.check_out_time IS NULL
              AND s.status = 'completed'
        `);

        // 3. Visitors flagged left by Host Employee but not checked out within 15 minutes
        const [flaggedLeftAlerts] = await db.execute(`
            SELECT vp.pass_number, v.full_name, vp.check_in_time, vp.host_employee_name, 'Host employee flagged visitor as left, but visitor is still checked in (>15 mins)' as reason
            FROM visitor_passes vp
            INNER JOIN visitors v ON v.id = vp.visitor_id
            WHERE vp.check_in_time IS NOT NULL 
              AND vp.check_out_time IS NULL 
              AND vp.host_flagged_left_time IS NOT NULL 
              AND vp.host_flagged_left_time < NOW() - INTERVAL 15 MINUTE
        `);

        const alerts = [...overstayRows, ...scheduleAlerts, ...flaggedLeftAlerts];
        return res.json({ success: true, alerts });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Failed to fetch security alerts.' });
    }
};