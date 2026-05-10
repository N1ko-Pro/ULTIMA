// ─────────────────────────────────────────────────────────────────────────────
//  dotnetManager.js
//  Checks for .NET 8.0 Desktop Runtime and handles installation via winget.
// ─────────────────────────────────────────────────────────────────────────────

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DotNetManager {
  constructor() {
    this._isInstalled = null;
  }

  /**
   * Check if .NET 8.0 Desktop Runtime (win-x64) is installed.
   * @returns {Promise<boolean>}
   */
  async checkDotNetRuntime() {
    if (this._isInstalled !== null) return this._isInstalled;

    const checks = [
      this._checkViaDotnetCommand,
      this._checkViaDirectory,
      this._checkViaRegistry,
      this._checkViaUninstallRegistry,
    ];

    for (const check of checks) {
      const result = await check();
      if (result) {
        this._isInstalled = true;
        return true;
      }
    }

    this._isInstalled = false;
    return false;
  }

  async _checkViaDotnetCommand() {
    try {
      const result = await execAsync('dotnet --list-runtimes', { windowsHide: true });
      return result.stdout?.includes('Microsoft.WindowsDesktop.App 8.0.');
    } catch {
      return false;
    }
  }

  async _checkViaDirectory() {
    const dotnetPaths = [
      'C:\\Program Files\\dotnet',
      'C:\\Program Files (x86)\\dotnet',
      path.join(process.env.LOCALAPPDATA, 'Microsoft\\dotnet'),
    ];

    for (const dotnetPath of dotnetPaths) {
      const runtimePath = path.join(dotnetPath, 'shared', 'Microsoft.WindowsDesktop.App', '8.0');
      if (fs.existsSync(runtimePath)) {
        console.log('DotNetManager: Found .NET 8.0 in directory:', runtimePath);
        return true;
      }
    }
    return false;
  }

  async _checkViaRegistry() {
    try {
      const result = await execAsync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Runtime\\dotnet\\8.0\\win-x64" /v Version 2>nul || reg query "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Runtime\\dotnet\\8.0\\win-x64" /v Version 2>nul',
        { windowsHide: true }
      );
      return result.stdout?.includes('Version');
    } catch {
      return false;
    }
  }

  async _checkViaUninstallRegistry() {
    try {
      const result = await execAsync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s 2>nul | findstr /i "Desktop Runtime"',
        { windowsHide: true }
      );
      return result.stdout?.includes('8.0');
    } catch {
      return false;
    }
  }

  /**
   * Install .NET 8.0 Desktop Runtime using winget.
   * Shows "installing" status since progress cannot be tracked when running through PowerShell with elevation.
   * @param {function(number): void} onProgress - Progress callback (-1 for installing)
   * @returns {Promise<void>}
   */
  async installDotNetRuntime(onProgress) {
    return new Promise((resolve, reject) => {
      // Use PowerShell to run winget with UAC in foreground
      const command = 'powershell -Command "Start-Process winget -ArgumentList \'install Microsoft.DotNet.DesktopRuntime.8 --accept-source-agreements --accept-package-agreements --silent\' -Verb RunAs -Wait"';
      
      // Show installing status immediately since process is displayed in PowerShell
      onProgress(-1);
      
      exec(command, {}, (error, stdout, stderr) => {
        if (error) {
          console.error('DotNetManager: Installation failed', { message: error.message, stdout, stderr });
          reject(new Error(`Installation failed: ${error.message}`));
        } else {
          console.log('DotNetManager: Installation completed successfully');
          this._isInstalled = true;
          resolve();
        }
      });
    });
  }
}

module.exports = new DotNetManager();
