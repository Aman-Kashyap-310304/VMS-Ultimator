const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/departments/IT/overview',
  method: 'GET'
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
