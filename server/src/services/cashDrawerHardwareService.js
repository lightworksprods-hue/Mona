const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function openCashDrawer() {
  if (process.platform !== 'win32') {
    throw { status: 503, message: 'Cash drawer hardware control is available on the Windows POS computer only.' };
  }

  const printerName = String(process.env.CASH_DRAWER_PRINTER_NAME || 'POS80').trim();
  if (!printerName) {
    throw { status: 503, message: 'Set CASH_DRAWER_PRINTER_NAME to the Windows printer name.' };
  }

  const scriptPath = path.join(__dirname, '../../scripts/openCashDrawer.ps1');
  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-PrinterName', printerName,
    ], { windowsHide: true, timeout: 10000 });
  } catch (error) {
    const detail = String(error.stderr || error.message || '').trim();
    console.error(`[cash-drawer] Printer command failed for "${printerName}": ${detail}`);
    throw {
      status: 502,
      code: 'CASH_DRAWER_HARDWARE_ERROR',
      message: 'The cash drawer could not be opened. Check that the receipt printer is on and connected.',
    };
  }

  return { printerName };
}

module.exports = { openCashDrawer };
