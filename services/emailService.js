const axios = require('axios');
require('dotenv').config();

const sendEmail = async ({
    to,
    subject,
    htmlContent,
    textContent
}) => {

    try {

        const payload = {

            sender: {
                name: process.env.EMAIL_FROM_NAME,
                email: process.env.EMAIL_FROM
            },

            to: Array.isArray(to)
                ? to.map(email => ({ email }))
                : [{ email: to }],

            subject,

            htmlContent,

            // NEVER send empty textContent
            textContent: textContent ||
                `
${subject}

Please open this email in an HTML compatible email application.

Visitor Management System
`
        };

        console.log('\n========== EMAIL REQUEST ==========');
        console.log('FROM:', payload.sender);
        console.log('TO:', payload.to);
        console.log('SUBJECT:', subject);
        console.log('===================================\n');

        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            payload,
            {
                headers: {
                    'api-key': process.env.BREVO_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('\n========== EMAIL SUCCESS ==========');
        console.log(response.data);
        console.log('===================================\n');

        return {
            success: true,
            data: response.data
        };

    } catch (error) {

        console.error('\n========== EMAIL FAILED ==========');
        console.error('Status:', error.response?.status);

        console.error(
            JSON.stringify(
                error.response?.data,
                null,
                2
            )
        );

        console.error('==================================\n');

        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
};

module.exports = sendEmail;