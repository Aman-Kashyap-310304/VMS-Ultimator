# Visitor Management System - Operational Protocol

## System Workflow

Visitor
→ Administrator
→ Security Staff

---

# 1. Visitor Protocol

## Step 1

Visitor opens Visitor Request Portal.

## Step 2

Visitor enters:

* Full Name
* Identity Type
* Identity Number
* Email Address
* Contact Number

## Step 3

Visitor uploads:

* Personal Photograph
* Identity Proof

## Step 4

Visitor submits request.

Status:

PENDING

---

# 2. Administrator Protocol

## Step 1

Administrator logs in using:

* Email
* Password
* Email OTP

## Step 2

Administrator reviews all pending requests.

## Step 3

Administrator performs one of the following actions:

### Approve

Administrator enters:

* Employee Name
* Department
* Visit Date
* Visit Time

System automatically generates:

* Unique 12 Digit Pass ID

Visitor receives Approval Email.

Status:

APPROVED

### Reject

Administrator enters rejection reason.

Visitor receives Rejection Email.

Status:

REJECTED

---

# 3. Security Protocol

## Step 1

Security Staff logs in using:

* Employee ID
* Password
* Email OTP

## Step 2

Security searches visitor using:

* Pass ID

## Step 3

Security verifies:

* Visitor Photograph.
* Identity Proof.
* Identity Number.

## Step 4

Security performs Check-In.

System records:

* Check-In Time.
* Security Employee ID.

Visitor receives Check-In Confirmation Email.

---

## Visitor Exit

Upon leaving premises:

Security performs Check-Out.

System records:

* Check-Out Time.
* Security Employee ID.

---

# Status Lifecycle

PENDING

↓

APPROVED / REJECTED

↓

CHECKED IN

↓

CHECKED OUT

---

# User Roles

## Visitor

Permissions:

* Submit Request

---

## Administrator

Permissions:

* Login
* Review Requests
* Approve Requests
* Reject Requests

---

## Security Staff

Permissions:

* Login
* Search Visitor
* Verify Identity
* Check-In Visitor
* Check-Out Visitor
* View Logs

---

# Exception Handling

Invalid Login
→ Access Denied

Invalid Session
→ Redirect to Login

Invalid Pass ID
→ Display Error

Already Checked-In Visitor
→ Prevent Duplicate Entry

Already Checked-Out Visitor
→ Prevent Duplicate Exit

---

# Current Environment

Mode:

Local Testing Mode

Database:

MySQL

Backend:

Node.js + Express.js

Frontend:

HTML + CSS + JavaScript

Email Service:

Brevo Transactional Email API
