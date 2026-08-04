/**
 * ============================================================
 * VMS Ultra Pro — Centralized Session & Security Manager
 * public/js/vms-session.js
 *
 * Rules:
 * 1. Single active session allowed across all user types in one browser.
 * 2. Session valid for max 48 hours OR expires after 18 hours of consecutive discontinuity.
 * 3. Logging into another role destroys previous session and alerts Admin & DeptAdmin via email & Dashboard Alert tab.
 * ============================================================
 */

window.VMSSession = (function() {
    'use strict';

    const MAX_SESSION_AGE_MS = 48 * 60 * 60 * 1000; // 48 Hours
    const MAX_INACTIVITY_MS = 18 * 60 * 60 * 1000;  // 18 Hours Discontinuity

    const TOKEN_KEYS = {
        admin: 'adminToken',
        deptAdmin: 'deptAdminToken',
        employee: 'employeeToken',
        security: 'securityToken',
        visitor: 'visitorToken'
    };

    const DASHBOARD_URLS = {
        admin: '/admin/dashboard',
        deptAdmin: '/deptadmin/dashboard',
        employee: '/employee/dashboard',
        security: '/security/dashboard',
        visitor: '/visitor/dashboard'
    };

    const LOGIN_URLS = {
        admin: '/admin',
        deptAdmin: '/deptadmin',
        employee: '/employee',
        security: '/security',
        visitor: '/visitor'
    };

    /**
     * Get active session metadata or validate expiry
     */
    function getActiveSession() {
        try {
            const rawMeta = localStorage.getItem('vms_session_meta');
            if (!rawMeta) {
                // Check standalone tokens for backward compatibility
                for (const [role, key] of Object.entries(TOKEN_KEYS)) {
                    const token = localStorage.getItem(key);
                    if (token) {
                        const meta = {
                            role,
                            token,
                            loginTime: Date.now(),
                            lastActive: Date.now(),
                            userIdentifier: role
                        };
                        localStorage.setItem('vms_session_meta', JSON.stringify(meta));
                        return meta;
                    }
                }
                return null;
            }

            const meta = JSON.parse(rawMeta);
            const now = Date.now();

            // Rule: Deactivate if total session > 48 hours OR inactivity > 18 hours
            const isTotalExpired = (now - meta.loginTime) > MAX_SESSION_AGE_MS;
            const isInactiveExpired = (now - meta.lastActive) > MAX_INACTIVITY_MS;

            if (isTotalExpired || isInactiveExpired) {
                console.warn('[VMSSession] Session expired. TotalAge:', isTotalExpired, 'Inactive:', isInactiveExpired);
                clearAllSessions();
                return null;
            }

            // Refresh last active timestamp
            meta.lastActive = now;
            localStorage.setItem('vms_session_meta', JSON.stringify(meta));

            return meta;
        } catch (e) {
            console.error('[VMSSession] Error reading session meta:', e);
            clearAllSessions();
            return null;
        }
    }

    /**
     * Update last active timestamp on user interaction
     */
    function touchSession() {
        const meta = getActiveSession();
        if (meta) {
            meta.lastActive = Date.now();
            localStorage.setItem('vms_session_meta', JSON.stringify(meta));
        }
    }

    /**
     * Clear all session tokens from localStorage
     */
    function clearAllSessions() {
        Object.values(TOKEN_KEYS).forEach(key => localStorage.removeItem(key));
        localStorage.removeItem('vms_session_meta');
    }

    /**
     * Set new session & destroy any existing session from another user type.
     * If another session was active on the same browser, alert Admin & DeptAdmin via API/Mail.
     */
    async function setSession(newRole, token, userIdentifier) {
        const previousSession = getActiveSession();
        const now = Date.now();

        // Check if a DIFFERENT session was active before in this browser
        if (previousSession && previousSession.role !== newRole) {
            console.warn(`[VMSSession] Single session override detected! Previous: ${previousSession.role}, New: ${newRole}`);
            
            // Send Alert to Backend (Admin/DeptAdmin email & Dashboard Alert tab)
            try {
                fetch('/api/auth/session-switch-alert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        previousRole: previousSession.role,
                        previousUser: previousSession.userIdentifier || previousSession.role,
                        newRole: newRole,
                        newUser: userIdentifier || newRole,
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString()
                    })
                }).catch(err => console.error('Alert send failed:', err));
            } catch (err) {
                console.error('Session switch alert error:', err);
            }
        }

        // Wipe all old tokens
        clearAllSessions();

        // Save new token & metadata
        const tokenKey = TOKEN_KEYS[newRole] || (newRole + 'Token');
        localStorage.setItem(tokenKey, token);

        const newMeta = {
            role: newRole,
            token: token,
            loginTime: now,
            lastActive: now,
            userIdentifier: userIdentifier || newRole
        };
        localStorage.setItem('vms_session_meta', JSON.stringify(newMeta));
    }

    // Touch session on user activity
    window.addEventListener('click', touchSession, { passive: true });
    window.addEventListener('keypress', touchSession, { passive: true });

    return {
        getActiveSession,
        setSession,
        clearAllSessions,
        touchSession,
        DASHBOARD_URLS,
        LOGIN_URLS
    };
})();
