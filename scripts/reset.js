const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform();
let userDataPath = '';

if (platform === 'win32') {
  userDataPath = path.join(process.env.APPDATA, 'bill-flow');
} else if (platform === 'darwin') {
  userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'bill-flow');
} else {
  userDataPath = path.join(os.homedir(), '.config', 'bill-flow');
}

const dbFiles = ['billflow.db', 'billflow.db-wal', 'billflow.db-shm'];

console.log(`[Bill Flow] Factory Reset: Locating database in ${userDataPath}...`);

let wiped = false;

try {
  for (const file of dbFiles) {
    const filePath = path.join(userDataPath, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(` - Successfully deleted ${file}`);
      wiped = true;
    }
  }

  if (wiped) {
    console.log('[Bill Flow] Reset complete! The hardlock has been removed.');
    console.log('[Bill Flow] Run `npm start` to see the Onboarding Selection screen again.');
  } else {
    console.log('[Bill Flow] No database found. The app is already in a clean slate.');
  }
} catch (error) {
  console.error('[Bill Flow] Failed to wipe database:', error.message);
  console.error('Make sure the Electron app is completely closed before running this command.');
  process.exit(1);
}
