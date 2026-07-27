const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

exports.generateVisitorPassPdf = async (passData) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const tempFileName = `pass-${passData.pass_number}-${Date.now()}.pdf`;
            const tempFilePath = path.join(__dirname, `../uploads/${tempFileName}`);
            
            // Ensure uploads directory exists
            const uploadsDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const writeStream = fs.createWriteStream(tempFilePath);
            doc.pipe(writeStream);

            // Access Pass Header Banner
            doc.rect(0, 0, 595, 110).fill('#2563eb');
            
            doc.fillColor('#ffffff')
               .font('Helvetica-Bold')
               .fontSize(24)
               .text('FACILITY ACCESS PASS', 40, 42);

            // Outer border card
            doc.rect(40, 140, 515, 660).lineWidth(1.5).strokeColor('#cbd5e1').stroke();

            // Inner styling details
            doc.fillColor('#0f172a')
               .font('Helvetica-Bold')
               .fontSize(16)
               .text('Visitor Access Authorization', 60, 170);

            let currentY = 220;
            const drawRow = (label, value) => {
                doc.fillColor('#64748b')
                   .font('Helvetica-Bold')
                   .fontSize(11)
                   .text(label.toUpperCase(), 60, currentY);
                
                doc.fillColor('#0f172a')
                   .font('Helvetica')
                   .fontSize(12)
                   .text(value || 'N/A', 200, currentY);
                
                currentY += 35;
            };

            drawRow('Pass ID:', passData.pass_number);
            drawRow('Visitor Name:', passData.visitor_name);
            drawRow('Visitor Email:', passData.visitor_email);
            drawRow('Host Department:', passData.host_department);
            drawRow('Host Employee:', passData.host_employee_name);
            drawRow('Date of Visit:', `${passData.visit_date} at ${passData.visit_time}`);
            
            // Status row
            doc.fillColor('#64748b')
               .font('Helvetica-Bold')
               .fontSize(11)
               .text('STATUS:', 60, currentY);
            
            doc.fillColor('#16a34a')
               .font('Helvetica-Bold')
               .fontSize(12)
               .text('APPROVED', 200, currentY);

            // Instructions text
            doc.fillColor('#dc2626')
               .font('Helvetica-Bold')
               .fontSize(10)
               .text('IMPORTANT SECURITY INSTRUCTIONS:', 60, 480);

            doc.fillColor('#475569')
               .font('Helvetica')
               .fontSize(9)
               .text('1. Please present this pass along with a valid ID at the security desk upon arrival.\n2. Keep this pass visible at all times while inside the facility.\n3. Scan the QR code below at the scanner during check-in and check-out.', 60, 500, { lineGap: 4 });

            // Generate full redirect URL for normal scanners
            const redirectUrl = `http://localhost:3000/visitor-pass.html?passNumber=${passData.pass_number}`;
            const qrDataUrl = await QRCode.toDataURL(redirectUrl, { errorCorrectionLevel: 'H' });
            const qrImageBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/\w+;base64,/, ""), 'base64');
            
            // Render QR Code in the lower section
            doc.image(qrImageBuffer, 197, 570, { width: 200 });

            doc.fillColor('#64748b')
               .font('Helvetica-Bold')
               .fontSize(10)
               .text('SCAN FOR CHECK-IN / CHECK-OUT', 197, 785, { width: 200, align: 'center' });

            doc.end();

            writeStream.on('finish', () => {
                resolve(tempFilePath);
            });
            writeStream.on('error', (err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
};
