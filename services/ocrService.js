// services/ocrService.js
const Tesseract = require('tesseract.js');

exports.extractIdentityDetails = async (imagePath) => {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imagePath,
            'eng'
        );
        console.log("OCR Extracted Text:", text);

        let identityType = 'Unknown';
        if (/aadhaar|uidai/i.test(text)) {
            identityType = 'Aadhaar';
        } else if (/pan card|permanent account number/i.test(text)) {
            identityType = 'PAN';
        } else if (/driving license/i.test(text)) {
            identityType = 'Driving License';
        }

        let identityNumber = null;
        const aadhaarMatch = text.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
        const panMatch = text.match(/\b[A-Z]{5}\d{4}[A-Z]\b/i);

        if (aadhaarMatch) {
            identityNumber = aadhaarMatch[0].replace(/\s/g, '');
        } else if (panMatch) {
            identityNumber = panMatch[0].toUpperCase();
        }

        return {
            identityType,
            identityNumber,
            rawText: text
        };
    } catch (err) {
        console.error("OCR Error:", err);
        return {
            identityType: 'Unknown',
            identityNumber: null,
            rawText: ''
        };
    }
};
