# Email Trigger System & Templates

## Trigger Registry

| Trigger | Template Path | Subject | Key Variables |
|---|---|---|---|
| Registration OTP | `/templates/emails/registerOtp.html` | Visitor Account Validation | `otpCode`, `validTime` |
| Pass Generated | `/templates/emails/passGenerated.html` | Visitor Access Pass | `passNumber`, `qrCodeUrl`, `hostName` |
| Lockout Alert | `/templates/emails/lockoutAlert.html` | Security Warning | `portalId`, `ipAddress`, `unlockLink` |

All templates use HTML formatting containing embedded Tailwind styling rules designed to display cleanly across mail clients.
