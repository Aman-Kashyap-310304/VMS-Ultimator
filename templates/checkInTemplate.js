// templates/checkInTemplate.js

const emailLayout =
    require('./emailLayout');

module.exports = ({
    visitorName,
    passNumber,
    employeeName,
    department,
    checkInTime
}) => {

    return emailLayout({

        title:
            'Visitor Check-In Confirmation',

        accentColor:
            '#16A34A',

        heading:
            'Visitor Successfully Checked In',

        body: `

<div style="
text-align:center;
margin-bottom:30px;
">

<div style="
width:90px;
height:90px;
margin:auto;
border-radius:50%;
background:#DCFCE7;
display:flex;
align-items:center;
justify-content:center;
font-size:42px;
">

✅

</div>

</div>


<p style="
font-size:16px;
line-height:1.8;
color:#334155;
">

Dear
<strong>${visitorName}</strong>,

</p>

<p style="
font-size:16px;
line-height:1.8;
color:#334155;
">

Your visitor pass has been successfully
used for entry into the premises.

</p>


<div style="
background:#F8FAFC;
border:1px solid #E2E8F0;
border-radius:18px;
padding:25px;
margin:30px 0;
">

<table
width="100%"
cellpadding="10">

<tr>

<td>
<strong>Pass ID</strong>
</td>

<td>
${passNumber}
</td>

</tr>

<tr>

<td>
<strong>Meeting With</strong>
</td>

<td>
${employeeName}
</td>

</tr>

<tr>

<td>
<strong>Department</strong>
</td>

<td>
${department}
</td>

</tr>

<tr>

<td>
<strong>Check In Time</strong>
</td>

<td>
${checkInTime}
</td>

</tr>

</table>

</div>


<div style="
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
line-height:1.8;
color:#7F1D1D;
">

If you did not enter the premises or
believe this check-in was unauthorized,
please immediately contact security personnel.

</p>

</div>


<p style="
margin-top:30px;
font-size:15px;
line-height:1.8;
color:#64748B;
">

Thank you for using our
Visitor Management System.

</p>

`
    });
};