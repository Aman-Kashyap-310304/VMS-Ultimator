require('dotenv').config();
const db = require('./config/db');
const bcrypt = require('bcrypt');

async function test() {
  await new Promise(resolve => setTimeout(resolve, 1500));
  try {
    const passwordHash = await bcrypt.hash('1030', 12);
    await db.execute('UPDATE deptAdmin SET password = ? WHERE PortalId = ?', [passwordHash, 'DA-34815669']);
    console.log('PASSWORD RESET SUCCESSFUL');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

test();
