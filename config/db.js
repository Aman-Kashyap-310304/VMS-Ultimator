// config/db.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
};

const dbName = process.env.DB_NAME || 'vms_ultra_pro_db';

let pool;

async function initDb() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await connection.end();
        console.log(`✅ Database "${dbName}" checked/created successfully`);

        const pool = mysql2.createPool({
            host:     process.env.DB_HOST,
            port:     Number(process.env.DB_PORT) || 3306,
            user:     process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'defaultdb',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: {
                rejectUnauthorized: false   // ← Add this for Aiven
            }
        });

        const poolConn = await pool.getConnection();
        console.log('✅ Connected to MySQL Database successfully');
        
        // Create departments table
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS departments (
                dept_code VARCHAR(50) PRIMARY KEY,
                dept_name VARCHAR(255) NOT NULL,
                dept_location VARCHAR(255),
                dept_profile TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create visitors table (Added is_blocked and blocked_reason columns)
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS visitors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                visitor_id VARCHAR(50) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                identity_type VARCHAR(100),
                identity_number VARCHAR(100),
                email VARCHAR(255) NOT NULL,
                contact_number VARCHAR(50),
                purpose VARCHAR(255),
                photo_path VARCHAR(255),
                identity_proof_path VARCHAR(255),
                company_name VARCHAR(255),
                designation VARCHAR(255),
                password VARCHAR(255),
                is_blocked BOOLEAN DEFAULT FALSE,
                blocked_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Add column blocked_reason if not exists
        try {
            await poolConn.query("ALTER TABLE visitors ADD COLUMN blocked_reason TEXT");
        } catch(e) {}

        // Create visitor_passes table (Added status enum structure)
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS visitor_passes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                visitor_id INT NOT NULL,
                pass_number VARCHAR(100) UNIQUE NOT NULL,
                host_employee_name VARCHAR(255),
                host_department VARCHAR(50),
                visit_date VARCHAR(50),
                visit_time VARCHAR(50),
                check_in_time DATETIME NULL,
                check_out_time DATETIME NULL,
                checked_in_by VARCHAR(100),
                checked_out_by VARCHAR(100),
                status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, checked_in, checked_out, visit_completed
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
            )
        `);

        try {
            await poolConn.query("ALTER TABLE visitor_passes ADD COLUMN pass_pdf_url VARCHAR(500) NULL");
        } catch(e) {}

        try {
            await poolConn.query("ALTER TABLE visitor_passes ADD COLUMN host_flagged_left_time DATETIME NULL");
        } catch(e) {}

        // Create otps table
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS otps (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                code_hash VARCHAR(255) NOT NULL,
                purpose VARCHAR(100),
                expires_at DATETIME NOT NULL,
                attempt_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create wrong_password_attempt table
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS wrong_password_attempt (
                alert_id INT AUTO_INCREMENT PRIMARY KEY,
                portal_id VARCHAR(100),
                role VARCHAR(50),
                timestampt DATETIME,
                device_type VARCHAR(100),
                ip_address VARCHAR(100),
                issue_createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                issue_updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                action_trigger VARCHAR(255),
                investigated_by VARCHAR(100)
            )
        `);

        // Create deptAdmin table
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS deptAdmin (
                PortalId VARCHAR(100) PRIMARY KEY,
                EmpId VARCHAR(100) UNIQUE NOT NULL,
                Name VARCHAR(255) NOT NULL,
                Email VARCHAR(255) UNIQUE NOT NULL,
                Contact VARCHAR(100),
                dept VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                is_first_login TINYINT DEFAULT 1,
                adminPhotoPath VARCHAR(500),
                is_blocked TINYINT DEFAULT 0,
                blocked_reason VARCHAR(255),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (dept) REFERENCES departments(dept_code) ON DELETE CASCADE
            )
        `);

        // Create users table (Employees & Security)
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS users (
                PortalId VARCHAR(100) PRIMARY KEY,
                EmpId VARCHAR(100) UNIQUE NOT NULL,
                Name VARCHAR(255) NOT NULL,
                Email VARCHAR(255) UNIQUE NOT NULL,
                Contact VARCHAR(50),
                dept VARCHAR(100),
                Role VARCHAR(50), -- 'Employee' or 'Security'
                userPhotoPath VARCHAR(255),
                password VARCHAR(255) NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (dept) REFERENCES departments(dept_code) ON DELETE SET NULL
            )
        `);

        try {
            await poolConn.query(`ALTER TABLE users ADD COLUMN is_first_login TINYINT DEFAULT 1`);
        } catch (e) {}
        try {
            await poolConn.query(`ALTER TABLE users ADD COLUMN is_blocked TINYINT DEFAULT 0`);
        } catch (e) {}
        try {
            await poolConn.query(`ALTER TABLE users ADD COLUMN blocked_reason VARCHAR(255)`);
        } catch (e) {}

        try {
            await poolConn.query(`ALTER TABLE deptAdmin ADD COLUMN is_first_login TINYINT DEFAULT 1`);
        } catch (e) {}
        try {
            await poolConn.query(`ALTER TABLE deptAdmin ADD COLUMN is_blocked TINYINT DEFAULT 0`);
        } catch (e) {}
        try {
            await poolConn.query(`ALTER TABLE deptAdmin ADD COLUMN blocked_reason VARCHAR(255)`);
        } catch (e) {}

        // Create schedules table
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                portal_id VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                date VARCHAR(100) NOT NULL,
                time VARCHAR(100) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (portal_id) REFERENCES users(PortalId) ON DELETE CASCADE
            )
        `);

        try {
            await poolConn.query(`ALTER TABLE schedules ADD COLUMN status VARCHAR(50) DEFAULT 'pending'`);
        } catch (e) {}
        try {
            await poolConn.query(`ALTER TABLE schedules ADD COLUMN remarks TEXT`);
        } catch (e) {}

        try {
            await poolConn.query(`ALTER TABLE deptAdmin ADD COLUMN is_blocked TINYINT DEFAULT 0`);
        } catch (e) {}
        try {
            await poolConn.query(`ALTER TABLE deptAdmin ADD COLUMN blocked_reason VARCHAR(255)`);
        } catch (e) {}

        // Create password_requests table
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS password_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                portal_id VARCHAR(100) NOT NULL,
                role VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                reason VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Create visitor_profile_updates table
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS visitor_profile_updates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                visitor_id INT NOT NULL,
                old_details TEXT,
                new_details TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
            )
        `);

        // Create department_view_logs table
        await poolConn.query(`
            CREATE TABLE IF NOT EXISTS department_view_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                viewer_id VARCHAR(100) NOT NULL,
                viewer_role VARCHAR(50) NOT NULL,
                dept_code VARCHAR(50) NOT NULL,
                viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ All VMS database tables initialized successfully');
        poolConn.release();
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
    }
}

initDb();

module.exports = {
    execute: async (...args) => {
        if (!pool) {
            throw new Error("Database pool is initializing. Please try again.");
        }
        return pool.execute(...args);
    },
    query: async (...args) => {
        if (!pool) {
            throw new Error("Database pool is initializing. Please try again.");
        }
        return pool.query(...args);
    },
    cleanupOldRecords: async () => {
        try {
            if (!pool) return;
            // Keep latest 60 visitor passes
            await pool.execute(`
                DELETE FROM visitor_passes 
                WHERE id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM visitor_passes ORDER BY id DESC LIMIT 60
                    ) tmp
                )
            `);
            // Keep latest 60 profile updates
            await pool.execute(`
                DELETE FROM visitor_profile_updates 
                WHERE id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM visitor_profile_updates ORDER BY id DESC LIMIT 60
                    ) tmp
                )
            `);
            // Keep latest 60 wrong password attempts
            await pool.execute(`
                DELETE FROM wrong_password_attempt 
                WHERE alert_id NOT IN (
                    SELECT alert_id FROM (
                        SELECT alert_id FROM wrong_password_attempt ORDER BY alert_id DESC LIMIT 60
                    ) tmp
                )
            `);
            console.log('🧹 VMS Database Auto-Cleanup: Kept latest 60 records successfully.');
        } catch (e) {
            console.error('⚠️ Database cleanup failed:', e.message);
        }
    }
};
