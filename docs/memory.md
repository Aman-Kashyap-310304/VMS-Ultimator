# VMS Memory & Decision Log

## Running Log of Design Decisions

- **Direct Database Access**: Decided to use `mysql2/promise` directly to ensure alignment with existing controller files and avoid adding unnecessary ORM dependencies.
- **Node-Native AI Screening**: Chose a Node-native fuzzy-matching engine using Jaro-Winkler string similarity. This avoids a separate Python service dependency and keeps the system lightweight for immediate local and Aiven DB deployments.
- **Owner Account Seeding**: Enabled database startup scripts to automatically seed the single administrator credentials from environment variables safely (using hashed passwords).

## Ambiguity Resolutions

- **HTML Page Naming**: Resolved spelling variations on dashboard routes (e.g. `dashbaord.html` and `dashboard.html` across different roles) by normalizing the routes in the Express web server logic while serving their respective physical files accurately.
