<div align="center">

<img src="public/vms.svg" alt="VMS Ultra Pro Logo" width="100" height="100">

# VMS Ultra Pro

### 🏢 Intelligent Enterprise Visitor Management System

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://mysql.com)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-2.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://vms-ultimator.onrender.com)
[![License](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)](LICENSE)

**[🌐 Live Demo](https://vms-ultimator.onrender.com) · [📋 Admin Portal](https://vms-ultimator.onrender.com/admin) · [🔒 Security Portal](https://vms-ultimator.onrender.com/security) · [👤 Visitor Portal](https://vms-ultimator.onrender.com/visitor)**

---

*A production-ready, full-stack Visitor Management System featuring AI-powered assistance, multi-role access control, automated QR visitor passes, real-time analytics, and enterprise-grade security — deployed on Render cloud.*

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [Portal Architecture](#-portal-architecture)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [AI Assistant](#-ai-assistant)
- [Security Model](#-security-model)
- [Environment Variables](#-environment-variables)
- [Local Setup](#-local-setup)
- [Deployment](#-deployment)
- [Screenshots](#-screenshots)
- [Author](#-author)

---

## 🌟 Overview

**VMS Ultra Pro** is a comprehensive, enterprise-grade Visitor Management System built with Node.js and Express, featuring five independent role-based portals, an AI-powered assistant backed by Google Gemini, automated visitor pass generation with QR codes, real-time organizational analytics, and a multi-layer security architecture.

The system replaces paper-based visitor registers with a fully digital, auditable, and intelligent platform — deployed live on Render at **[https://vms-ultimator.onrender.com](https://vms-ultimator.onrender.com)**.

---

## 🚀 Live Demo

| Portal | URL | Role |
|---|---|---|
| 🏠 **Homepage** | [vms-ultimator.onrender.com](https://vms-ultimator.onrender.com) | Public |
| 🔴 **Admin** | [/admin](https://vms-ultimator.onrender.com/admin) | System Administrator |
| 🟠 **DeptAdmin** | [/deptadmin](https://vms-ultimator.onrender.com/deptadmin) | Department Head |
| 🟡 **Employee** | [/employee](https://vms-ultimator.onrender.com/employee) | Staff Member |
| 🔵 **Security** | [/security](https://vms-ultimator.onrender.com/security) | Gate Officer |
| 🟢 **Visitor** | [/visitor](https://vms-ultimator.onrender.com/visitor) | External Guest |

> **Note:** The Render free-tier server may take ~30 seconds to wake up on first request. A keep-alive ping mechanism is built-in (`public/js/vms-backend-wakeup.js`) to minimize cold starts.

---

## 🏛️ Portal Architecture

```
                        ┌─────────────────────────────────────┐
                        │     VMS Ultra Pro — Render Cloud    │
                        │   https://vms-ultimator.onrender.com │
                        └─────────────────┬───────────────────┘
                                          │ Express.js REST API
              ┌───────────────────────────┼───────────────────────────┐
              │           │               │               │            │
         ┌────▼────┐ ┌────▼────┐   ┌─────▼────┐   ┌────▼────┐ ┌────▼────┐
         │  Admin  │ │DeptAdmin│   │ Employee │   │Security │ │ Visitor │
         │ Portal  │ │ Portal  │   │  Portal  │   │ Portal  │ │ Portal  │
         └────┬────┘ └────┬────┘   └─────┬────┘   └────┬────┘ └────┬────┘
              │           │               │               │            │
              └───────────┴───────────────┴───────────────┴────────────┘
                                          │
                              ┌───────────▼───────────┐
                              │   MySQL SQL Database   │
                              │ + Gemini AI Engine     │
                              │ + Cloudinary CDN       │
                              │ + Nodemailer SMTP      │
                              └───────────────────────┘
```

### Role Capabilities

| Role | Access Level | Key Capabilities |
|---|---|---|
| **Admin** | Full System | Analytics, department management, DeptAdmin CRUD, visitor oversight, security alerts |
| **DeptAdmin** | Department Scope | Employee management, pass approval/rejection, schedules, password requests |
| **Employee** | Personal + Department | View assigned visits, flag visitor departure, department info, AI assistant |
| **Security** | Operational | QR code scanner, gate entry/exit logging, active pass management |
| **Visitor** | Self Only | Register (OTP + ID), request visits, download passes, track status |

---

## ✨ Key Features

### 🤖 AI-Powered Assistant (Google Gemini)
- **Multi-model fallback chain**: `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash` → `gemini-flash-lite`
- **ReAct SQL agent loop**: AI autonomously queries the database (up to 3 round-trips) to answer live data questions
- **Role-based data access**: Each portal user only sees data scoped to their role (Visitor cannot see staff tables, Employee cannot see credential tables, etc.)
- **3000–4500 word deep responses** for analytical queries; 70–120 words for quick questions
- **Inline rendering**: AI responses support `[IMG:url:alt]`, `[NAV:label:url]`, `[ACTION:label:event]`, `[COPY:label:text]` interactive tokens
- **Advanced Markdown → HTML parser** with syntax-highlighted code blocks, tables, blockquotes, and nested lists

### 🔐 Multi-Layer Security
- **JWT authentication** with role-specific token keys (`adminToken`, `employeeToken`, etc.)
- **Single-session enforcement**: One active session per browser across all roles; cross-role login triggers an admin email alert
- **Session expiry**: 48-hour maximum lifetime + 18-hour inactivity auto-logout (`vms-session.js`)
- **Password hashing**: bcrypt with salt rounds
- **3-stage password recovery**: Identity verification → Webcam face-scan simulation (OpenCV-style UI) → Request submission
- **6-digit OTP** email verification for visitor registration and password reset
- **Security lockout logging**: Failed login attempts logged with device type, IP, and timestamp

### 📋 Visitor Pass System
- Auto-generated unique pass numbers
- **QR code** embedded on each pass (scannable by Security portal)
- **PDF pass** generated with PDFKit and attached to email
- **Dynamic email links** resolve correctly between localhost and Render production environments
- Pass lifecycle: `pending` → `approved` → `checked_in` → `checked_out` / `rejected`

### 📊 Real-Time Analytics (Admin)
- Total visitors, departments, employees, DeptAdmins
- Active pass count and visitor trends
- Department-wise statistics
- Security alert monitoring and resolution

### 📸 Identity Verification
- **ID Proof OCR** via Tesseract.js — auto-fills identity type and number during visitor registration
- **Webcam face-match UI** (retina scan → face contour → nose profile animation) for password recovery

### 📱 Responsive Design
- Mathematical responsive layout engine (`smart-media-responsive.js`)
- Dark / Light mode toggle with `data-theme` CSS variables
- Mobile-optimized sidebar navigation with swipe gesture support

### 🌐 SEO & Discoverability
- Canonical meta tags on all pages
- `robots.txt` and `sitemap.xml` published
- Structured Open Graph tags

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Node.js 18+** | Runtime environment |
| **Express.js 5.x** | REST API framework |
| **MySQL 2** | Relational database driver |
| **jsonwebtoken** | JWT authentication |
| **bcrypt** | Password hashing |
| **Nodemailer** | Email delivery (Gmail SMTP) |
| **Multer** | File and image upload handling |
| **PDFKit** | Visitor pass PDF generation |
| **QRCode** | QR code PNG generation |
| **Tesseract.js** | OCR for identity document scanning |
| **Cloudinary** | Profile photo CDN storage |
| **Axios** | HTTP client for Gemini AI API |
| **Helmet** | Security headers middleware |
| **express-rate-limit** | API rate limiting |
| **dotenvx** | Encrypted environment variable management |

### Frontend
| Technology | Purpose |
|---|---|
| **HTML5 + CSS3** | Markup and styling |
| **Vanilla JavaScript** | Client-side interactivity |
| **Bootstrap Icons** | Icon library |
| **IndexedDB** | Client-side session cache |
| **HTML5 Canvas** | Webcam capture for face verification |
| **html5-qrcode** | In-browser QR code scanning |

### Infrastructure
| Service | Role |
|---|---|
| **Render.com** | Cloud hosting + auto-deploy from GitHub |
| **GitHub** | Version control + CI/CD trigger |
| **Cloudinary** | Image CDN |
| **Gmail SMTP** | Transactional email |

---

## 📁 Project Structure

```
VMS-Ultimator/
├── server.js                    # Express app entry point, route mounting, static serving
├── package.json
├── render.yaml                  # Render deployment configuration
│
├── config/
│   └── db.js                    # MySQL connection pool + utility methods
│
├── controllers/
│   ├── aiController.js          # Gemini AI ReAct agent, RBAC SQL execution
│   ├── adminAuthController.js   # Admin login, OTP, password reveal
│   ├── adminVisitorController.js # Dept/employee/visitor CRUD, analytics, pass management
│   ├── deptAdminAuthController.js
│   ├── deptAdminVisitorController.js
│   ├── employeeAuthController.js
│   ├── employeeVisitorController.js
│   ├── securityAuthController.js
│   ├── securityVisitorEmployeeController.js
│   ├── visitorAuthController.js
│   ├── visitorController.js
│   └── passwordRequestController.js
│
├── routes/
│   ├── adminRoutes.js           # /api/admin/*
│   ├── adminAuthRoutes.js       # /api/admin/auth/*
│   ├── adminVisitorRoutes.js    # /api/admin/visitor/*
│   ├── deptAdminRoutes.js       # /api/deptadmin/*
│   ├── employeeAuthRoutes.js    # /api/employee/*
│   ├── employeeVisitorRoutes.js # /api/employee/passes, /api/employee/departments
│   ├── securityAuthRoutes.js    # /api/security/*
│   ├── securityRoutes.js        # /api/security/passes
│   ├── visitorAuthRoutes.js     # /api/visitor/auth
│   ├── visitorRoutes.js         # /api/visitor/*
│   ├── aiRoutes.js              # /api/ai/generate
│   ├── passwordRequestRoutes.js # /api/password-reset/*
│   └── publicRoutes.js          # /api/public/visitor-pass/:passNumber
│
├── middlewares/
│   ├── validateAdminSession.js
│   ├── validateDeptAdminSession.js
│   ├── validateEmployeeSession.js
│   ├── validateSecuritySession.js
│   └── validateVisitorSession.js
│
├── services/
│   ├── emailService.js          # Nodemailer transport
│   ├── cloudinaryService.js     # Image upload to Cloudinary
│   └── pdfService.js            # PDFKit visitor pass generation
│
├── utils/
│   └── baseUrl.js               # Dynamic base URL (localhost ↔ Render)
│
├── templates/
│   └── newRequestTemplate.js    # HTML email template
│
├── scripts/
│   └── vms-qrcode.png           # Generated QR code → vms-ultimator.onrender.com
│
└── public/
    ├── index.html               # Public homepage / portal dispatcher
    ├── visitor-pass.html        # Public visitor pass viewer (QR scan landing)
    ├── robots.txt
    ├── sitemap.xml
    ├── vms.svg                  # VMS logo
    │
    ├── js/
    │   ├── vms-session.js       # Centralized session manager (48h/18h rules)
    │   ├── ai-response-renderer.js # Markdown + HTML AI response parser
    │   ├── ai-widget.js         # Floating AI chat widget
    │   ├── vms-backend-wakeup.js # Render keep-alive ping
    │   └── custom-dialogs.js    # Custom alert/confirm/prompt modals
    │
    ├── Admins/
    │   ├── index.html           # Admin login
    │   ├── dashboard.html       # Admin dashboard (analytics, depts, visitors, alerts)
    │   └── department-info.html # Shared department detail view (Admin/DeptAdmin/Employee)
    │
    ├── DeptAdmin/
    │   ├── index.html           # DeptAdmin login + 3-stage face-scan recovery
    │   └── dashbaord.html       # DeptAdmin dashboard
    │
    ├── Employee/
    │   ├── index.html           # Employee login + face-scan recovery
    │   └── dashbaord.html       # Employee dashboard
    │
    ├── Security/
    │   ├── index.html           # Security login
    │   ├── dashboard.html       # Security dashboard + QR scanner
    │   └── pass-visitor-detail.html # Pass detail view
    │
    └── Visitor/
        ├── index.html           # Visitor register (4-step wizard) + login
        └── dashbaord.html       # Visitor dashboard
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/api/admin/auth/login` | Admin | Admin login |
| `POST` | `/api/deptadmin/login` | DeptAdmin | DeptAdmin login |
| `POST` | `/api/employee/login` | Employee | Employee login |
| `POST` | `/api/security/login` | Security | Security login |
| `POST` | `/api/visitor/register-otp` | Public | Send registration OTP |
| `POST` | `/api/visitor/register` | Public | Complete visitor registration |
| `POST` | `/api/visitor/login` | Public | Visitor login |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/analytics` | System analytics data |
| `GET` | `/api/admin/departments` | List all departments |
| `GET` | `/api/admin/departments/:dept_code/overview` | Department detail + staff |
| `POST` | `/api/admin/departments` | Create department |
| `PUT` | `/api/admin/departments/:dept_code` | Update department |
| `DELETE` | `/api/admin/departments/:dept_code` | Delete department |
| `POST` | `/api/admin/deptadmins` | Create DeptAdmin |
| `GET` | `/api/admin/deptadmins` | List DeptAdmins |
| `GET` | `/api/admin/visitors` | List all visitors |
| `POST` | `/api/admin/visitors/:id/block` | Block/unblock visitor |
| `GET` | `/api/admin/alerts` | Wrong-password alerts |
| `POST` | `/api/admin/alerts/:id/resolve` | Resolve security alert |
| `GET` | `/api/admin/departments-stats` | Dept-wise statistics |
| `GET` | `/api/admin/visitor-logs` | Visitor activity logs |

### DeptAdmin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/deptadmin/passes` | Pending visitor passes |
| `POST` | `/api/deptadmin/passes/:id/approve` | Approve visitor pass |
| `POST` | `/api/deptadmin/passes/:id/reject` | Reject visitor pass |
| `GET` | `/api/deptadmin/employees` | List department employees |
| `POST` | `/api/deptadmin/employees` | Create employee |
| `GET` | `/api/deptadmin/schedules` | Department schedules |
| `GET` | `/api/deptadmin/departments/:dept_code/overview` | Department overview |

### Employee

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/employee/departments` | All departments list |
| `GET` | `/api/employee/departments/:dept_code/overview` | Department detail |
| `GET` | `/api/employee/assigned-passes` | Passes assigned to employee |
| `POST` | `/api/employee/pass/:passId/arrived` | Mark visitor arrived |
| `POST` | `/api/employee/pass/:passId/flag-left` | Flag visitor as departed |

### Security

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/security/passes/active` | All active passes |
| `POST` | `/api/security/passes/:passNumber/checkin` | Check in visitor |
| `POST` | `/api/security/passes/:passNumber/checkout` | Check out visitor |

### Visitor

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/visitor/profile` | My profile |
| `POST` | `/api/visitor/request-visit` | Request a visit |
| `GET` | `/api/visitor/passes` | My passes |
| `GET` | `/api/visitor/ocr` | OCR identity scan |
| `POST` | `/api/visitor/forgot-password-otp` | Forgot password OTP |
| `POST` | `/api/visitor/reset-password` | Reset password |
| `DELETE` | `/api/visitor/delete-account` | Delete account |

### AI

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ai/generate` | AI content generation (all actions + chat) |

### Public

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/public/visitor-pass/:passNumber` | View pass publicly (QR scan) |

---

## 🗄️ Database Schema

```sql
-- Core tables
CREATE TABLE departments (
    dept_code VARCHAR(50) PRIMARY KEY,
    dept_name VARCHAR(255) NOT NULL,
    dept_location VARCHAR(255),
    dept_profile TEXT
);

CREATE TABLE users (
    PortalId VARCHAR(100) PRIMARY KEY,
    EmpId VARCHAR(100) UNIQUE,
    Name VARCHAR(255),
    Email VARCHAR(255),
    Contact VARCHAR(50),
    dept VARCHAR(100),
    Role VARCHAR(50),           -- 'Employee' | 'Security'
    is_first_login TINYINT DEFAULT 1,
    is_blocked TINYINT DEFAULT 0,
    blocked_reason VARCHAR(255),
    photo_url VARCHAR(500)
);

CREATE TABLE deptAdmin (
    PortalId VARCHAR(100) PRIMARY KEY,
    EmpId VARCHAR(100) UNIQUE,
    Name VARCHAR(255),
    Email VARCHAR(255),
    Contact VARCHAR(100),
    dept VARCHAR(100),
    is_first_login TINYINT DEFAULT 1,
    is_blocked TINYINT DEFAULT 0,
    blocked_reason VARCHAR(255),
    photo_url VARCHAR(500)
);

CREATE TABLE visitors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    visitor_id VARCHAR(50) UNIQUE,   -- 8-digit public ID
    full_name VARCHAR(255),
    email VARCHAR(255),
    contact_number VARCHAR(50),
    purpose VARCHAR(255),
    company_name VARCHAR(255),
    designation VARCHAR(255),
    is_blocked TINYINT DEFAULT 0,
    blocked_reason VARCHAR(255),
    photo_url VARCHAR(500)
);

CREATE TABLE visitor_passes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    visitor_id INT,                   -- FK → visitors.id
    pass_number VARCHAR(100) UNIQUE,
    host_employee_name VARCHAR(255),
    host_department VARCHAR(50),
    status VARCHAR(50),               -- pending|approved|rejected|checked_in|checked_out
    check_in_time DATETIME,
    check_out_time DATETIME,
    pass_pdf_url VARCHAR(500),
    host_flagged_left_time DATETIME
);

CREATE TABLE schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    portal_id VARCHAR(100),
    title VARCHAR(255),
    date VARCHAR(100),
    time VARCHAR(100),
    description TEXT,
    status VARCHAR(50),
    remarks TEXT
);

CREATE TABLE wrong_password_attempt (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    portal_id VARCHAR(100),
    role VARCHAR(50),
    timestampt DATETIME,
    device_type VARCHAR(100),
    ip_address VARCHAR(100),
    action_trigger VARCHAR(255),
    investigated_by VARCHAR(100)
);

CREATE TABLE password_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    portal_id VARCHAR(100),
    role VARCHAR(50),
    status VARCHAR(50),
    reason VARCHAR(255)
);

CREATE TABLE otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255),
    otp_code VARCHAR(10),
    expires_at DATETIME,
    purpose VARCHAR(100)
);

CREATE TABLE visitor_profile_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    visitor_id INT,
    old_details TEXT,
    new_details TEXT
);

CREATE TABLE department_view_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    viewer_id VARCHAR(100),
    viewer_role VARCHAR(50),
    dept_code VARCHAR(50),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🤖 AI Assistant

VMS Ultra Pro embeds a **Google Gemini AI assistant** inside every portal dashboard.

### Architecture

```
User Query (Chat)
      ↓
  THINK: Parse intent + role context
      ↓
   ACT: Generate SQL query [SQL: SELECT ...]
      ↓
OBSERVE: Backend executes + returns JSON result
      ↓
RESPOND: Compose comprehensive formatted response
      ↑
 (loops up to 3x for complex multi-step queries)
```

### Role-Based Data Access

| Role | Tables Accessible | Write Access |
|---|---|---|
| **Admin** | All tables | Full CRUD |
| **DeptAdmin** | Department scope (no OTP table) | Department data only |
| **Employee** | Own passes + departments (no credentials) | Own schedules only |
| **Security** | Visitor passes + visitors (no staff tables) | Update pass status only |
| **Visitor** | Own visitor + pass records only | Read-only |

### Response Tokens

AI can embed interactive elements using tokens:

```
[IMG:https://cloudinary.com/.../photo.jpg:John's Profile Photo]
→ Renders a circular profile photo with caption

[NAV:Go to Dashboard:/employee/dashboard]
→ Renders a navigation button (relative paths supported)

[NAV:Visit Portal:https://vms-ultimator.onrender.com/admin]
→ Renders an external link button

[ACTION:Approve Pass:approvePass]
→ Renders a button that triggers a VMS frontend event

[COPY:Copy Portal ID:EMP-2024-001]
→ Renders a copy-to-clipboard button
```

---

## 🔒 Security Model

```
Layer 1: Infrastructure
  ├── HTTPS enforced by Render
  ├── Helmet.js security headers
  └── CORS policy with allowed origins

Layer 2: Database
  ├── Parameterized queries (no SQL injection)
  └── bcrypt password hashing

Layer 3: Authentication
  ├── Role-specific JWT tokens
  ├── Middleware guards on every protected route
  └── Token expiry validation

Layer 4: Session Management (vms-session.js)
  ├── Single active session per browser across all roles
  ├── 48-hour maximum session lifetime
  ├── 18-hour inactivity auto-logout
  └── Cross-role login → admin alert email

Layer 5: AI Security
  ├── Role-scoped database access (RBAC)
  ├── DDL commands blocked (no DROP/ALTER/TRUNCATE)
  └── Visitor write operations blocked entirely

Layer 6: OTP & Identity
  ├── 6-digit time-limited OTP for registration and password reset
  └── Face-match UI for password recovery (3-stage)
```

---

## ⚙️ Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# Authentication
JWT_SECRET=your_super_secret_jwt_key_min_32_chars

# Email (Gmail SMTP)
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Cloudinary (image storage)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Render deployment (auto-set by Render)
RENDER_EXTERNAL_URL=https://vms-ultimator.onrender.com

# App URL (for email links)
APP_URL=https://vms-ultimator.onrender.com
```

> **Security Note:** Never commit `.env` to version control. Use `.gitignore` (already configured). For production, set these as environment variables directly in the Render dashboard.

---

## 🖥️ Local Setup

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- A Gmail account with App Password enabled
- A Cloudinary account (free tier works)
- A Google Gemini API key ([get one here](https://ai.google.dev))

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Aman-Kashyap-310304/VMS-Ultimator.git
cd VMS-Ultimator

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your values in .env

# 4. Set up the database
# Create a MySQL database and run the schema SQL from the Database Schema section above

# 5. Start the development server
npm run dev     # uses nodemon for hot reload
# OR
npm start       # production mode

# 6. Open in browser
# Homepage:       http://localhost:3000
# Admin Portal:   http://localhost:3000/admin
# DeptAdmin:      http://localhost:3000/deptadmin
# Employee:       http://localhost:3000/employee
# Security:       http://localhost:3000/security
# Visitor:        http://localhost:3000/visitor
```

---

## ☁️ Deployment

VMS Ultra Pro is deployed on **[Render.com](https://render.com)** with automatic deployments triggered on every push to `main`.

### Render Configuration (`render.yaml`)

```yaml
services:
  - type: web
    name: vms-ultimator
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
```

### Deploy Your Own

1. Fork this repository
2. Create a new **Web Service** on Render
3. Connect your forked GitHub repo
4. Add all environment variables from the [Environment Variables](#-environment-variables) section
5. Deploy — Render auto-installs dependencies and starts the server

### Keep-Alive

Render free-tier instances sleep after 15 minutes of inactivity. The built-in `vms-backend-wakeup.js` script pings the server every 5 minutes from the browser client to prevent cold starts during active sessions.

---

## 📲 QR Code

Scan to open the live VMS Ultra Pro portal:

<div align="center">
<img src="scripts/vms-qrcode.png" alt="VMS Ultra Pro QR Code" width="220">

*Scans to: https://vms-ultimator.onrender.com*
</div>

---

## 🗂️ Commit History Highlights

| Commit | Description |
|---|---|
| `6310895` | fix: logout clears all tokens + session meta; AI 3000–4500 word responses + RBAC + IMG token |
| `d446f61` | fix: stabilize homepage, single session enforcement with 48h/18h rules & responsive mobile layout |
| `416ab7d` | feat: professional internal navigation bar, canonical SEO & Render keep-alive |
| `cda15d7` | fix: remove GitHub Pages logic & optimize Render portal session auto-redirections |

---

## 👨‍💻 Author

<div align="center">

**Aman Kashyap**

[![GitHub](https://img.shields.io/badge/GitHub-Aman--Kashyap--310304-181717?style=for-the-badge&logo=github)](https://github.com/Aman-Kashyap-310304)
[![Email](https://img.shields.io/badge/Email-its.aman3103%40gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:its.aman3103@gmail.com)

*B.Tech CSE Student · Dronacharya College of Engineering*

</div>

---

## 📄 License

This project is licensed under the **ISC License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ❤️ by [Aman Kashyap](https://github.com/Aman-Kashyap-310304)

⭐ **Star this repo if you found it useful!**

</div>
