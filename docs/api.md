# REST API Catalog

## Visitor Routes (`/api/visitor`)
- `POST /api/visitor/register` - Create visitor profile & verification step
- `POST /api/visitor/request` - Create visitor pass meeting request
- `POST /api/visitor/otp/verify` - Confirm registration or recovery flow

## Admin Routes (`/api/admin`)
- `POST /api/admin/login` - Authenticate admin credentials
- `POST /api/admin/create-dept-admin` - Deploy new Department Administrator accounts
- `GET /api/admin/visitor-requests` - Fetch pending visitor pass queues
- `POST /api/admin/approve-request` - Accept entry request and assign host employee

## Security Routes (`/api/security`)
- `GET /api/security/pass/:passId` - Read visitor credentials from signed QR string
- `POST /api/security/pass/:passId/check-in` - Perform visitor arrival entry
- `POST /api/security/pass/:passId/check-out` - Verify check-out exit transition
