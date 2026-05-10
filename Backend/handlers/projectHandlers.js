const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { wrapHandler } = require('./handlerUtils');
const { extractPakFromZip, extractPakFromRar } = require('./archiveUtils');

function registerProjectHandlers(getUserDataPath, { projectManager, bg3Manager }) {
  ipcMain.handle('save-project', wrapHandler(async (_, projectData) => {
    const savedProject = projectManager.saveProject(getUserDataPath(), projectData);
    return { success: true, project: savedProject };
  }));

  ipcMain.handle('load-projects', wrapHandler(async () => {
    const projects = projectManager.loadProjectSummaries(getUserDataPath());
    return { success: true, projects };
  }));

  ipcMain.handle('delete-project', wrapHandler(async (_, id) => {
    const workspaceRoot = bg3Manager.workspaceDir;
    if (workspaceRoot) {
      bg3Manager.clearCachedDataForWorkspace(workspaceRoot);
    }
    await projectManager.deleteProject(getUserDataPath(), id, workspaceRoot);
    return { success: true };
  }));

  ipcMain.handle('load-project', wrapHandler(async (_, projectId) => {
    const projectRecord = projectManager.getProjectById(getUserDataPath(), projectId);
    if (!projectRecord) {
      return { success: false, error: 'Проект не найден или повреждён.' };
    }

    if (!fs.existsSync(projectRecord.pakPath)) {
      return {
        success: false,
        error: `Оригинальный файл больше не существует по пути: ${projectRecord.pakPath}`,
      };
    }

    const ext = path.extname(projectRecord.pakPath).toLowerCase();
    const isArchive = ext === '.zip' || ext === '.rar';

    if (!isArchive) {
      // Direct PAK — no extraction needed
      return projectManager.loadProjectForEditing({
        userDataPath: getUserDataPath(),
        projectId,
        bg3Manager,
      });
    }

    // Archive (ZIP/RAR) — extract the PAK to a temp dir, then load
    let tempDir = null;
    try {
      let extractedPakPath;
      if (ext === '.zip') {
        ({ pakPath: extractedPakPath, tempDir } = extractPakFromZip(projectRecord.pakPath));
      } else {
        ({ pakPath: extractedPakPath, tempDir } = await extractPakFromRar(projectRecord.pakPath));
      }

      return await projectManager.loadProjectForEditing({
        userDataPath: getUserDataPath(),
        projectId,
        bg3Manager,
        extractedPakPath,
      });
    } finally {
      if (tempDir) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }
  }));
}

module.exports = { registerProjectHandlers };
