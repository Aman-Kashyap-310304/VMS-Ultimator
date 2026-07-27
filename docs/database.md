# Database Schema & Migrations Reference

## Entities & Tables

### `visitors`
- `id` (int PK auto_increment)
- `visitor_id` (varchar UNIQUE)
- `full_name` (varchar)
- `identity_type` (varchar)
- `identity_number` (varchar)
- `email` (varchar)
- `contact_number` (varchar NULL)
- `purpose` (varchar)
- `photo_path` (varchar NULL)
- `identity_proof_path` (varchar NULL)
- `company_name` (varchar NULL)
- `designation` (varchar NULL)
- `password` (varchar NULL)
- `created_at` (datetime)
- `updated_at` (datetime)

### `visitor_passes`
- `id` (int PK auto_increment)
- `visitor_id` (int FK)
- `pass_number` (varchar UNIQUE)
- `host_employee_name` (varchar)
- `host_department` (varchar)
- `visit_date` (varchar)
- `visit_time` (varchar)
- `check_in_time` (datetime NULL)
- `check_out_time` (datetime NULL)
- `checked_in_by` (varchar NULL)
- `checked_out_by` (varchar NULL)
- `status` (varchar) -- approved/checked_in/checked_out/visit_completed

### `otps`
- `id` (int PK auto_increment)
- `email` (varchar)
- `code_hash` (varchar)
- `purpose` (varchar)
- `expires_at` (datetime)
- `attempt_count` (int)

### `wrong_password_attempt`
- `alert_id` (int PK auto_increment)
- `portal_id` (varchar)
- `role` (varchar)
- `timestampt` (datetime)
- `device_type` (varchar)
- `ip_address` (varchar)
- `issue_createdAt` (datetime)
- `issue_updatedAt` (datetime)
- `action_trigger` (varchar NULL)
- `investigated_by` (varchar NULL)
