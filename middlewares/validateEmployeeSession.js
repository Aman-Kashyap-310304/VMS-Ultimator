// middlewares/validateEmployeeSession.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const token = req.cookies?.employee_token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access Denied. Please log in.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
        req.employee = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Session has expired or is invalid.'
        });
    }
};
