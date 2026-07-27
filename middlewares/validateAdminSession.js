// middlewares/validateAdminSession.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const token = req.cookies?.admin_token || req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access Denied. No session token provided.'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Session has expired or is invalid.'
        });
    }
};
