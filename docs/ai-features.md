# AI-Enhanced Duplicate Detection & Metrics

## Screening Engine
- Runs checks on Stage 2 of registration process.
- Performs fuzzy name calculations using Jaro-Winkler distance and normalized string formatting to block spam accounts.
- Compares name, email syntax similarity, and phone number parameters.
- Alert threshold defaults to `0.85`, configurable in `.env`.
