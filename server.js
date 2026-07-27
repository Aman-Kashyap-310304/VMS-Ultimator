// server.js

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
    origin: [
        'http://localhost:3000',
        'https://vms-ultimator.onrender.com'
    ],
    credentials: true,
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(cookieParser());

// ======================================================
// STATIC FILES
// ======================================================

// Public HTML/CSS/JS with Cache-Control middleware to prevent browser caching
app.use((req, res, next) => {
    if (req.url.endsWith('.html') || req.url.includes('/dashboard') || req.url === '/deptadmin/dashboard' || req.url === '/admin/dashboard') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Uploaded Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SVG Files
app.use('/svg', express.static(path.join(__dirname, 'SVG')));

// ======================================================
// ROUTES IMPORT
// ======================================================

const adminRoutes = require('./routes/adminRoutes');
const visitorRoutes = require('./routes/visitorRoutes');

// ======================================================
// API ROUTES
// ======================================================
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
});
app.use('/api/admin', adminRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/password-reset', require('./routes/passwordRequestRoutes'));
app.use('/api/password_reset', require('./routes/passwordRequestRoutes'));
app.use('/', require('./routes/publicRoutes'));
app.use(
    '/api/security',
    require('./routes/securityAuthRoutes')
);
app.use(
    '/api/security',
    require('./routes/securityRoutes')
);
app.use(
    '/api/employee',
    require('./routes/employeeAuthRoutes')
);
app.use(
    '/api/employee',
    require('./routes/employeeVisitorRoutes')
);
app.use(
    '/api/deptadmin',
    require('./routes/deptAdminRoutes')
);

// ======================================================
// FRONTEND ROUTES
// ======================================================

// Home Page
app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'index.html')
    );
});

// Visitor Portal
app.get('/visitor', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Visitor', 'index.html')
    );
});

// Security Login
app.get('/security', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Security', 'index.html')
    );
});

// Admin Login
app.get('/admin', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Admins', 'index.html')
    );
});

// Admin Dashboard
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Admins', 'dashboard.html')
    );
});

// Admin Department Info View
app.get('/admin/department-info', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Admins', 'department-info.html')
    );
});
app.get('/deptadmin/department-info', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Admins', 'department-info.html')
    );
});
app.get('/employee/department-info', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Admins', 'department-info.html')
    );
});

// Security Dashboard
app.get('/security/dashboard', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Security', 'dashboard.html')
    );
});

// Security Pass Detail Page
app.get('/security/pass-visitor-detail.html', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Security', 'pass-visitor-detail.html')
    );
});

// DeptAdmin Portal Login
app.get('/deptadmin', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'DeptAdmin', 'index.html')
    );
});

// DeptAdmin Dashboard
app.get('/deptadmin/dashboard', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'DeptAdmin', 'dashbaord.html')
    );
});

// Employee Portal Login
app.get('/employee', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Employee', 'index.html')
    );
});

// Employee Dashboard
app.get('/employee/dashboard', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'Employee', 'dashbaord.html')
    );
});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'VMS Server Running',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date()
    });
});

// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {

    console.error('Global Error:', err);

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
🚀 Visitor Management System Started
=========================================
Environment : ${process.env.NODE_ENV || 'development'}
Port        : ${PORT}
URL         : http://localhost:${PORT}
Health      : http://localhost:${PORT}/health
=========================================
    `);
});