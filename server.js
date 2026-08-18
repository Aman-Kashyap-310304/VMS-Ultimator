// server.js
// VMS Ultra Pro — Main Express Application Entry Point

require('dotenv').config();
require('./config/db');

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
app.set('trust proxy', 1);

// ======================================================
// BASIC MIDDLEWARES
// ======================================================

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (
            origin.includes('localhost') ||
            origin.includes('127.0.0.1') ||
            origin.includes('onrender.com')
        ) {
            return callback(null, true);
        }
        return callback(null, true); // Allow all origins (public API)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ======================================================
// STATIC FILES
// ======================================================

// Prevent HTML/dashboard caching in browser
app.use((req, res, next) => {
    if (
        req.url.endsWith('.html') ||
        req.url.includes('/dashboard') ||
        req.url === '/deptadmin/dashboard' ||
        req.url === '/admin/dashboard'
    ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/SVG', express.static(path.join(__dirname, 'SVG')));
app.use('/svg', express.static(path.join(__dirname, 'SVG')));

// ======================================================
// REQUEST LOGGER
// ======================================================

app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
});

// ======================================================
// API ROUTES — Registered in priority order
// Specific prefixes MUST come before the '/' catchall (publicRoutes)
// ======================================================

// ── AI Assistant ───────────────────────────────────────
// POST /api/ai/generate — Gemini AI chat + tools
app.use('/api/ai', require('./routes/aiRoutes'));

// ── Admin Portal ───────────────────────────────────────
// Includes: auth (login, otp, reveal-password), departments, dept-admins,
//           visitors, alerts, analytics, visitor-updates, visitor-logs
app.use('/api/admin', require('./routes/adminRoutes'));

// ── Visitor Portal ─────────────────────────────────────
// Includes: register-otp, register, login, forgot-password-otp,
//           reset-password, profile, history, passes, ocr, delete-account
app.use('/api/visitor', require('./routes/visitorRoutes'));

// ── Password Reset (Multi-Role) ────────────────────────
// Includes: verify-stage1, verify-stage2, admin-requests,
//           deptadmin-requests, resolve
// Mounted on both hyphen and underscore prefixes for compatibility
app.use('/api/password-reset', require('./routes/passwordRequestRoutes'));
app.use('/api/password_reset', require('./routes/passwordRequestRoutes'));

// ── DeptAdmin Portal ───────────────────────────────────
// Includes: login, profile, change-password, update-profile, requests,
//           approve/reject passes, create-user, users, schedules, departments
app.use('/api/deptadmin', require('./routes/deptAdminRoutes'));

// ── Employee Portal ────────────────────────────────────
// Auth: login, profile, change-password, update-profile, schedules
// Visitor: assigned-passes, pass actions, departments overview
app.use('/api/employee', require('./routes/employeeAuthRoutes'));
app.use('/api/employee', require('./routes/employeeVisitorRoutes'));

// ── Security Portal ────────────────────────────────────
// Auth: login, profile, change-password, update-profile
// Ops: pass check-in/out, logs, visits, alerts
app.use('/api/security', require('./routes/securityAuthRoutes'));
app.use('/api/security', require('./routes/securityRoutes'));

// ── Public Routes (LAST — partial catchall mounted at '/') ─
// Includes: /api/public/pass/:passNumber, /api/public-action/approve|reject,
//           /api/auth/session-switch-alert
// NOTE: This MUST be last among API routes to avoid swallowing other paths
app.use('/', require('./routes/publicRoutes'));

// ======================================================
// FRONTEND SPA ROUTES — Portal page serving
// ======================================================

// ── Home ───────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Visitor Portal ─────────────────────────────────────
app.get('/visitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Visitor', 'index.html'));
});
app.get('/visitor/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Visitor', 'dashbaord.html'));
});

// ── Admin Portal ───────────────────────────────────────
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admins', 'index.html'));
});
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admins', 'dashboard.html'));
});
app.get('/admin/department-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admins', 'department-info.html'));
});

// ── DeptAdmin Portal ───────────────────────────────────
app.get('/deptadmin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'DeptAdmin', 'index.html'));
});
app.get('/deptadmin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'DeptAdmin', 'dashbaord.html'));
});
app.get('/deptadmin/department-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admins', 'department-info.html'));
});

// ── Employee Portal ────────────────────────────────────
app.get('/employee', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Employee', 'index.html'));
});
app.get('/employee/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Employee', 'dashbaord.html'));
});
app.get('/employee/department-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Admins', 'department-info.html'));
});

// ── Security Portal ────────────────────────────────────
app.get('/security', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Security', 'index.html'));
});
app.get('/security/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Security', 'dashboard.html'));
});
app.get('/security/pass-visitor-detail.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Security', 'pass-visitor-detail.html'));
});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'VMS Ultra Pro Server Running',
        environment: process.env.NODE_ENV || 'development',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// ======================================================
// 404 HANDLER — Must be after ALL routes
// ======================================================

app.use((req, res) => {
    // Provide helpful message for POST-only endpoints hit via GET
    const postOnlyPaths = [
        '/api/admin/login', '/api/visitor/login', '/api/employee/login',
        '/api/security/login', '/api/deptadmin/login',
        '/api/password-reset/verify-stage1', '/api/password-reset/verify-stage2',
        '/api/password_reset/verify-stage1', '/api/password_reset/verify-stage2'
    ];
    if (req.method === 'GET' && postOnlyPaths.includes(req.path)) {
        return res.status(405).json({
            success: false,
            message: `This endpoint requires POST method. Direct browser access is not supported.`,
            endpoint: req.path,
            method_required: 'POST'
        });
    }

    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
    console.error('[Global Error]', err.message, err.stack?.split('\n')[1] || '');
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
=========================================
🚀 VMS Ultra Pro — Server Started
=========================================
Environment : ${process.env.NODE_ENV || 'development'}
Port        : ${PORT}
URL         : http://localhost:${PORT}
Health      : http://localhost:${PORT}/health
=========================================
API Routes Registered:
  POST  /api/ai/generate
  /api/admin/*       (auth + management)
  /api/visitor/*     (auth + passes)
  /api/employee/*    (auth + passes + dept)
  /api/security/*    (auth + gate ops)
  /api/deptadmin/*   (auth + dept mgmt)
  /api/password-reset/*  (multi-role recovery)
  /api/public/*      (public pass viewer)
=========================================
    `);
});