const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/deptadmin/update-profile',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer test_token',
    'Content-Length': 0
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
  console.error(`problem: ${e.message}`);
});

req.end();
