const emailLayout = require('./emailLayout');

module.exports = (visitor) => {
    return emailLayout({
        title: 'Visitor Check-Out Confirmation',
        accentColor: '#10B981',
        heading: 'Check-Out Complete',
        body: `
            <p>Hello ${visitor.visitorName},</p>
            <p>Your visitor pass <strong>${visitor.passNumber}</strong> has been successfully checked out. We hope you had a productive visit.</p>
            <p>Thank you for visiting us.</p>
        `
    });
};
