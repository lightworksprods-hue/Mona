param(
  [Parameter(Mandatory = $true)]
  [string] $PrinterName
)

# Sends ESC/POS drawer-kick: ESC p m t1 t2.
# XP-T80A pin 2 / drawer 1: 1B 70 00 19 FA.
Add-Type @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawWindowsPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DocInfo {
        public string pDocName;
        public string pOutputFile;
        public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string name, out IntPtr printer, IntPtr defaults);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr printer);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int StartDocPrinter(IntPtr printer, int level, [In] DocInfo document);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr printer);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr printer);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr printer);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr printer, byte[] data, int count, out int written);

    public static void Send(string printerName, byte[] data) {
        IntPtr printer;
        if (!OpenPrinter(printerName, out printer, IntPtr.Zero))
            throw new Win32Exception(Marshal.GetLastWin32Error());

        try {
            var document = new DocInfo { pDocName = "Mona POS Cash Drawer", pDataType = "RAW" };
            if (StartDocPrinter(printer, 1, document) == 0)
                throw new Win32Exception(Marshal.GetLastWin32Error());
            try {
                if (!StartPagePrinter(printer))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                try {
                    int written;
                    if (!WritePrinter(printer, data, data.Length, out written) || written != data.Length)
                        throw new Win32Exception(Marshal.GetLastWin32Error());
                } finally { EndPagePrinter(printer); }
            } finally { EndDocPrinter(printer); }
        } finally { ClosePrinter(printer); }
    }
}
"@

try {
  [RawWindowsPrinter]::Send($PrinterName, [byte[]](0x1B, 0x70, 0x00, 0x19, 0xFA))
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
