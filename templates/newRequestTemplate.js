const emailLayout = require('./emailLayout');

module.exports = (visitor) => {

return emailLayout({

title:'New Visitor Request',

accentColor:'#F59E0B',

heading:'New Visitor Request Received',

body:`

<p>A new visitor request requires your review.</p>

<table width="100%" cellpadding="8">

<tr>
<td><strong>Name</strong></td>
<td>${visitor.full_name}</td>
</tr>

<tr>
<td><strong>Email</strong></td>
<td>${visitor.email}</td>
</tr>

<tr>
<td><strong>Contact </strong></td>
<td>${visitor.contact_number}</td>
</tr>

<tr>
<td><strong>Purpose of Visit</strong></td>
<td>${visitor.purpose}</td>
</tr>

<tr>
<td><strong>Identity Type</strong></td>
<td>${visitor.identity_type}</td>
</tr>

<tr>
<td><strong>Identity Number</strong></td>
<td>${visitor.identity_number}</td>
</tr>

</table>

<p style="
text-align:center;
margin-top:30px;
">

<a href="http://localhost:3000/Admins/dashboard.html"
style="
background:#F59E0B;
color:#ffffff;
padding:14px 28px;
text-decoration:none;
border-radius:8px;
font-weight:bold;
">
Review Request
</a>

</p>
`
});
};