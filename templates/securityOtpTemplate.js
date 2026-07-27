// templates/securityOtpTemplate.js

const emailLayout =
    require('./emailLayout');

module.exports = (otp) => {

    return emailLayout({

        title:
            'Security Verification OTP',

        accentColor:
            '#2563EB',

        heading:
            'Security Portal Login Verification',

        body: `

<div style="
    text-align:center;
">

    <div style="
        width:90px;
        height:90px;
        margin:0 auto 25px auto;
        background:#EFF6FF;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:42px;
    ">

        🔐

    </div>

</div>


<p style="
    color:#334155;
    font-size:16px;
    line-height:1.8;
">

A secure login request was initiated
for the
<strong>

Visitor Management System Security Portal

</strong>.

</p>


<p style="
    color:#334155;
    font-size:16px;
    line-height:1.8;
">

To continue accessing your account,
please use the One-Time Password (OTP)
shown below.

</p>


<div style="
    text-align:center;
    margin:40px 0;
">

    <div style="
        display:inline-block;
        background:#EFF6FF;
        border:2px dashed #2563EB;
        border-radius:18px;
        padding:25px 45px;
    ">

        <div style="
            font-size:42px;
            letter-spacing:12px;
            font-weight:700;
            color:#2563EB;
            font-family:
                Arial,
                Helvetica,
                sans-serif;
        ">

            ${otp}

        </div>

    </div>

</div>


<div style="
    background:#F8FAFC;
    border:1px solid #E2E8F0;
    border-radius:16px;
    padding:20px;
    margin-top:20px;
">

    <h3 style="
        color:#0F172A;
        margin-bottom:12px;
    ">

        Important Information

    </h3>

    <ul style="
        padding-left:18px;
        color:#475569;
        line-height:1.8;
    ">

        <li>

            This OTP is valid for

            <strong>

            ${process.env.OTP_EXPIRY_MINUTES || 10}
            minutes

            </strong>.

        </li>

        <li>

            Never share this OTP
            with anyone.

        </li>

        <li>

            Our support team will
            never ask for your OTP.

        </li>

    </ul>

</div>


<div style="
    margin-top:30px;
    padding:20px;
    background:#FEF2F2;
    border-left:5px solid #DC2626;
    border-radius:12px;
">

    <strong style="
        color:#B91C1C;
    ">

        Security Notice

    </strong>

    <p style="
        margin-top:10px;
        color:#7F1D1D;
        line-height:1.8;
    ">

        If you did not attempt to sign in
        to the Security Portal,
        please ignore this email and
        immediately contact your system administrator.

    </p>

</div>


<p style="
    margin-top:35px;
    color:#64748B;
    line-height:1.8;
">

Thank you for helping us keep the
Visitor Management System secure.

</p>

`
    });
};