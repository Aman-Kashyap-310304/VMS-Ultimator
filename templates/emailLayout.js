module.exports = ({
    title,
    accentColor = '#2563EB',
    heading,
    body,
    footerNote = 'This is an automated message from Visitor Management System.'
}) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>

<body style="
    margin:0;
    padding:0;
    background:#F1F5F9;
    font-family:Arial,Helvetica,sans-serif;
">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 10px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
style="
    max-width:600px;
    width:100%;
    background:#ffffff;
    border-radius:16px;
    overflow:hidden;
    box-shadow:0 8px 30px rgba(0,0,0,0.08);
">

<tr>
<td style="
    background:${accentColor};
    padding:30px;
    text-align:center;
">

<h1 style="
    color:#ffffff;
    margin:0;
    font-size:28px;
">
Visitor Management System
</h1>

</td>
</tr>

<tr>
<td style="padding:40px 35px;">

<h2 style="
    color:#0F172A;
    margin-top:0;
">
${heading}
</h2>

${body}

</td>
</tr>

<tr>
<td style="
    background:#F8FAFC;
    padding:25px;
    text-align:center;
    color:#64748B;
    font-size:13px;
">

<p>${footerNote}</p>

<p style="margin-top:15px;">
© ${new Date().getFullYear()} Visitor Management System
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;