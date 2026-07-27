const emailLayout = require('./emailLayout');

module.exports = (otp) => {

    return emailLayout({
        title: 'Admin Login OTP',
        accentColor: '#2563EB',
        heading: 'Secure Login Verification',

        body: `
        <p style="font-size:16px;color:#334155;">
            Use the following One-Time Password to access the administrator portal.
        </p>

        <div style="
            text-align:center;
            margin:35px 0;
        ">

            <div style="
                display:inline-block;
                padding:20px 40px;
                background:#EFF6FF;
                border:2px dashed #2563EB;
                border-radius:12px;
                font-size:38px;
                font-weight:bold;
                color:#2563EB;
                letter-spacing:10px;
            ">
                ${otp}
            </div>

        </div>

        <p style="color:#475569;">
            This OTP will expire in <strong>10 minutes</strong>.
        </p>
        `
    });
};