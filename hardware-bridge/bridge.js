const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const appDirectory = process.pkg ? path.dirname(process.execPath) : __dirname;
const config = loadEnv(path.join(appDirectory, '.env'));
const apiUrl = String(config.HARDWARE_API_URL || '').replace(/\/$/, '');
const token = String(config.HARDWARE_BRIDGE_TOKEN || '').trim();
const printerName = String(config.CASH_DRAWER_PRINTER_NAME || 'POS80 Printer').trim();
const pollInterval = Math.max(1000, Number(config.POLL_INTERVAL_MS || 2000));
const scriptPath = path.join(appDirectory, 'openCashDrawer.ps1');

if (!apiUrl || !token) {
  console.error('Missing HARDWARE_API_URL or HARDWARE_BRIDGE_TOKEN in hardware-bridge/.env');
  process.exit(1);
}

async function request(url, options = {}) {
  const response = await fetch(`${apiUrl}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Hardware-Bridge-Token': token,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Server responded with ${response.status}`);
  return data;
}

async function processCommand(command) {
  if (command.type !== 'OPEN_DRAWER') {
    throw new Error(`Unsupported hardware command: ${command.type}`);
  }

  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-PrinterName', printerName,
  ], { windowsHide: true, timeout: 10000 });
}

async function poll() {
  try {
    const response = await request('/hardware/bridge/commands/next');
    const command = response.data;
    if (!command) return;

    try {
      await processCommand(command);
      await request(`/hardware/bridge/commands/${command.id}/result`, {
        method: 'POST',
        body: JSON.stringify({ success: true, result: `Drawer opened through ${printerName}.` }),
      });
      console.log(`[${new Date().toISOString()}] Drawer opened.`);
    } catch (error) {
      const detail = String(error.stderr || error.message || 'Printer command failed').trim();
      console.error(`[${new Date().toISOString()}] Drawer failed: ${detail}`);
      await request(`/hardware/bridge/commands/${command.id}/result`, {
        method: 'POST',
        body: JSON.stringify({ success: false, result: detail }),
      }).catch((resultError) => console.error(`Could not report failure: ${resultError.message}`));
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Bridge connection failed: ${error.message}`);
  }
}

console.log(`Mona POS hardware bridge started for printer "${printerName}".`);
setInterval(poll, pollInterval);
poll();

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#') && trimmed.includes('=');
  }).map((line) => {
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    return [key, value];
  }));
}
