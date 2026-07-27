# Security & Authentication Specifications

## Password Policy
- Passwords must be hashed using `bcrypt` with a cost factor of 12.
- Answers to security FAQs must also be hashed like passwords to protect the credential-reset path.

## Session Management
- JWT access tokens with 15-minute TTL.
- Refresh tokens stored in `httpOnly` secure cookies to prevent XSS-based hijacking.
- Consecutive inactivity timeout of 18 hours or auto-expiration after 2 days.

## Safeguards
- **10-Strike Lockout Policy**: After 10 consecutive failed login attempts, accounts are locked automatically and suspicious activity alert mails are sent to Admins.
- **Strict Role-Based Access Control (RBAC)**: Validated at every middleware step.
- **Input Sanitization**: Implemented on bios and purpose text inputs to prevent XSS and SQL injection.
