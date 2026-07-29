// utils/baseUrl.js
/**
 * Resolves the base URL dynamically based on environment, request headers, or Render URL.
 * Priority:
 * 1. process.env.APP_URL
 * 2. process.env.RENDER_EXTERNAL_URL
 * 3. req (if passed)
 * 4. Fallback default: https://vms-ultimator.onrender.com
 */
function getBaseUrl(req) {
    if (process.env.APP_URL) {
        return process.env.APP_URL.replace(/\/$/, '');
    }
    if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
    }
    if (req && req.get) {
        const host = req.get('host');
        if (host) {
            const protocol = req.protocol || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
            return `${protocol}://${host}`;
        }
    }
    return 'https://vms-ultimator.onrender.com';
}

module.exports = getBaseUrl;
