const http = require('http');

const data = JSON.stringify({
  portalId: 'DA-34815669',
  password: 1030 // passed as number
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/deptadmin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', body);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
