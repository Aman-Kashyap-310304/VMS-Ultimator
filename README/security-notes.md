# Visitor Management System - Security Notes

## Authentication Security

The system implements multi-layer authentication mechanisms.

### Administrator Authentication

* Login using Email and Password.
* Email OTP verification is mandatory.
* Single active session policy is enforced.
* Previous session is terminated automatically upon new login.

### Security Staff Authentication

* Login using Employee ID and Password.
* Email OTP verification is mandatory.
* First login requires mandatory password change.
* Single active session policy is enforced.

---

## Session Security

* Session IDs are randomly generated.
* Session IDs contain 16 alphanumeric characters.
* Unauthorized users cannot access protected routes.
* Every dashboard validates the active session before rendering.

---

## Visitor Security

* Every visitor request requires:

  * Photograph upload.
  * Identity proof upload.

* Identity verification is performed by Security Staff before entry.

---

## Check-In Security

Security personnel must verify:

1. Visitor photograph.
2. Identity proof.
3. Visitor name.
4. Pass ID.

Only after successful verification should Check-In be performed.

---

## Email Security

System notifications are delivered using Brevo Transactional Email API.

Emails are sent for:

* New Visitor Request.
* Visitor Approval.
* Visitor Rejection.
* Admin OTP.
* Security OTP.
* Visitor Check-In Confirmation.

---

## Password Security

Recommendations:

* Store all passwords using bcrypt hashing.
* Minimum password length: 8 characters.
* Never store plain text passwords in production.

---

## Production Recommendations

Before production deployment:

* Enable HTTPS.
* Use Helmet middleware.
* Enable Rate Limiting.
* Configure SPF, DKIM and DMARC.
* Use Cloud Storage for uploads.
* Enable Database SSL for Aiven.

---

## Audit Trail

The following activities are recorded:

* Visitor Requests.
* Visitor Approval.
* Visitor Rejection.
* Check-In.
* Check-Out.
* User Login Sessions.

---

## Future Security Enhancements

* Face Recognition Verification.
* Entry OTP Verification.
* Device Fingerprinting.
* Login Attempt Limiting.
* IP Whitelisting.
* Activity Logs Dashboard.
