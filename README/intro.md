# Visitor Management System (VMS) – Project Demonstration

## Introduction

Good morning/afternoon.

I have developed a full-stack **Visitor Management System (VMS)** using **Node.js, Express.js, MySQL, HTML, CSS, and JavaScript**.

The primary objective of this system is to digitize and secure the complete visitor entry process inside an organization.

The system currently operates in local testing mode and supports three user roles:

1. Visitor
2. Administrator
3. Security Personnel

---

## 1. Visitor Module

A visitor can submit a visit request through an online form.

The visitor provides:

* Full Name
* Identity Type and Number
* Email Address
* Contact Number
* Photograph
* Identity Proof

After submission:

* Data is securely stored in MySQL.
* An automatic notification email is sent to the administrator.

This eliminates manual visitor registers.

---

## 2. Administrator Module

Administrators log in using:

* Email
* Password
* Email-based OTP authentication

This provides two-factor authentication for enhanced security.

After successful login, administrators can:

* View all visitor requests
* Approve requests
* Reject requests

When approving a visitor, the administrator enters:

* Employee to meet
* Department
* Visit Date
* Visit Time

The system automatically generates:

* A unique 12-digit Visitor Pass ID

The visitor then receives an approval email containing all visit details and the QR-enabled pass.

If rejected, the visitor receives a rejection email.

---

## 3. Security Module

Security staff authenticate using:

* Employee ID
* Password
* Email OTP verification

On first login, the system forces password change.

Security personnel can:

* Search visitors using Pass ID
* View complete visitor information
* Verify uploaded identity documents
* Perform Check-In and Check-Out operations

Every check-in event is recorded and tracked.

A confirmation email is also sent to the visitor when check-in occurs to prevent unauthorized usage.

---

## Security Features

The system implements multiple security measures:

* Two-Factor Authentication (OTP)
* Single Active Session Policy
* Session Validation
* Unique Visitor Pass Generation
* Visitor Identity Verification
* Email Notifications for important actions

---

## Technology Stack

Frontend:

* HTML5
* CSS3
* JavaScript
* Bootstrap Icons

Backend:

* Node.js
* Express.js

Database:

* MySQL

Additional Services:

* Brevo Email API

---

## Future Enhancements

Planned future enhancements include:

* Cloud Deployment using Render and Aiven
* Face Recognition based visitor verification
* Mobile Application support
* Real-time analytics dashboard
* Cloud storage for uploaded documents

---

## Conclusion

This system significantly improves security, reduces paperwork, automates visitor handling, and provides a scalable digital solution for organizations.

Thank you.
