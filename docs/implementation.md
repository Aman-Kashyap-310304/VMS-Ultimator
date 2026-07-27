# Implementation Decisions & Stack Choices

This document outlines the choices and setup instructions for the **VMS Portal** codebase.

## 1. Technical Stack Selection & Rationale

*   **Database Interface**: Standard raw SQL queries with a connection pool via `mysql2/promise` (as established in existing controller files). This eliminates ORM overhead and matches the custom schema requirements.
*   **Security & Encryption**: `bcrypt` (and `bcryptjs` fallback) for all credential hashing. High-entropy key generation for JWT tokens.
*   **OTP Verification**: Hashed verification tokens stored at rest in an `otps` table with 5-minute TTL constraints.
*   **AI Duplicate Screening**: Node-native fuzzy-matching engine leveraging Jaro-Winkler string similarity with adjustable thresholds via `.env` configuration.
*   **State Machine Transitions**: Linear Visitor Pass lifecycle management (`Approved` -> `Checked In` -> `Checked Out` -> `Visit Completed`).

## 2. Configuration Setup

Copy `.env.example` to `.env` and fill the variables:
*   `PORT`: Port to run the server on (default: `3000`)
*   `JWT_SECRET`: Used for signing authorization tokens
*   `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`: Default owner admin credentials
*   `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: Database connection parameters
*   `BREVO_API_KEY`: SMTP/Transactional Email API key
*   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Media file uploads handling
*   `GEMINI_API_KEY`: Generative/AI screening configurations
