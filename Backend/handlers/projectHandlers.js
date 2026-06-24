const { ipcMain } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const CH = require('../ipcChannels');

// Generic project handlers. Persistence (save/load summaries) is game-agnostic;
// game-specific work (loading a project for editing, cleaning up on-disk
// artifacts) is delegated to the owning game's module, resolved from the
// project record's `game` field.
function registerProjectHandlers(getUserDataPath, { projectManager, games }) {
  ipcMain.handle(CH.PROJECT_SAVE, wrapHandler(async (_, projectData) => {
    const savedProject = projectManager.saveProject(getUserDataPath(), projectData);
    return { success: true, project: savedProject };
  }));

  ipcMain.handle(CH.PROJECT_LOAD_ALL, wrapHandler(async () => {
    const projects = projectManager.loadProjectSummaries(getUserDataPath());
    return { success: true, projects };
  }));

  ipcMain.handle(CH.PROJECT_DELETE, wrapHandler(async (_, id) => {
    const projectRecord = projectManager.getProjectById(getUserDataPath(), id);
    const gameModule = projectRecord ? games.getGameModule(projectRecord.game) : null;
    if (gameModule?.deleteProjectArtifacts) {
      await gameModule.deleteProjectArtifacts(projectRecord);
    }
    await projectManager.deleteProjectRecord(getUserDataPath(), id);
    return { success: true };
  }));

  ipcMain.handle(CH.PROJECT_LOAD, wrapHandler(async (_, projectId) => {
    const projectRecord = projectManager.getProjectById(getUserDataPath(), projectId);
    if (!projectRecord) {
      return { success: false, error: 'Проект не найден или повреждён.' };
    }

    const gameModule = games.getGameModule(projectRecord.game);
    if (!gameModule?.loadProject) {
      return { success: false, error: 'Открытие проектов для этой игры пока не поддерживается.' };
    }

    return gameModule.loadProject(projectRecord);
  }));
}

module.exports = { registerProjectHandlers };
