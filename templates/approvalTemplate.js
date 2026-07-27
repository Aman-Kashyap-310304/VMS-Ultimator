const emailLayout = require('./emailLayout');

module.exports = ({
    visitorName,
    passNumber,
    employeeName,
    department,
    visitDate,
    visitTime
}) => {

return emailLayout({

title:'Visitor Pass Approved',

accentColor:'#16A34A',

heading:'Your Visit Has Been Approved ✅',

body:`

<p style="font-size:16px;color:#334155;">
Dear <strong>${visitorName}</strong>,
</p>

<p style="color:#334155;">
Your visitor request has been approved.
Please present this pass at the security desk.
</p>

<div style="
    background:#F0FDF4;
    border-left:6px solid #16A34A;
    padding:25px;
    border-radius:10px;
    margin:30px 0;
">

<p><strong>Pass Number:</strong></p>

<p style="
    font-size:30px;
    color:#16A34A;
    font-weight:bold;
    letter-spacing:4px;
">
${passNumber}
</p>

<p><strong>Meeting With:</strong> ${employeeName}</p>

<p><strong>Department:</strong> ${department}</p>

<p><strong>Date:</strong> ${visitDate}</p>

<p><strong>Time:</strong> ${visitTime}</p>

</div>

<p style="
    text-align:center;
    margin-top:25px;
    color:#64748B;
">
Please keep this email for verification.
</p>
`
});
};