# Project Directory Structure

```
vms-portal/
├── client/                        # (Legacy client location; served statically by public folder)
├── public/                        # Web assets & Kiosk HTML layouts
│   ├── Admins/                    # index.html & dashboard.html (Admin portal)
│   ├── DeptAdmin/                 # index.html & dashbaord.html (Department Admin portal)
│   ├── Employee/                  # index.html & dashbaord.html (Employee portal)
│   ├── Security/                  # index.html & dashboard.html (Security portal)
│   ├── Visitor/                   # index.html & dashbaord.html (Visitor portal)
│   ├── docs/                      # Interactive user manuals
│   ├── SVG/                       # Static branding assets
│   └── index.html                 # Central landing page
├── controllers/                   # Request routers execution logic
├── routes/                        # REST endpoint routes
├── middlewares/                   # Session validators and file upload filters
├── services/                      # Shared helper utilities (email, screening)
├── config/                        # DB setup configuration
├── templates/                     # Email content templates
├── docs/                          # Architecture & design documentation
├── server.js                      # Application main entry point
└── .env                           # Local environment overrides
```
