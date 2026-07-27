// services/cloudinaryService.js
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const FormData = require('form-data'); // standard package usually available or we can use normal buffer posting

exports.uploadToCloudinary = async (filePath, publicId = null) => {
    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        const timestamp = Math.round(new Date().getTime() / 1000);
        let strToSign = '';
        if (publicId) {
            strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        } else {
            strToSign = `timestamp=${timestamp}${apiSecret}`;
        }
        const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);
        if (publicId) {
            formData.append('public_id', publicId);
        }

        const response = await axios.post(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            formData,
            {
                headers: formData.getHeaders()
            }
        );

        return response.data.secure_url;
    } catch (err) {
        console.error('Cloudinary Upload Error:', err.response?.data || err.message);
        throw new Error('Failed to upload file to Cloudinary.');
    }
};
