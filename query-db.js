require('dotenv').config();
const db = require('./config/db');

async function test() {
  // Wait 1.5 seconds for the database pool to initialize
  await new Promise(resolve => setTimeout(resolve, 1500));
  try {
    const [admins] = await db.execute('SELECT PortalId, EmpId, Name, Email, password FROM deptAdmin');
    console.log('DEPT ADMINS:', admins);
    const [visitors] = await db.execute('SELECT visitor_id, email, password FROM visitors');
    console.log('VISITORS:', visitors);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

test();
