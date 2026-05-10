import { invoke } from './client';

// ─── Projects (workspace persistence) ───────────────────────────────────────
// CRUD over the on-disk project records: each project is an unpacked mod
// folder + saved translations + metadata. Returns the IPC envelope unchanged
// so callers can still read `success`, `project`, `projects`, `data`, `error`.

/**
 * @returns {Promise<{ success: boolean, projects?: Array<any>, error?: string } | null>}
 */
export const loadAll = () => invoke('loadProjects');

/**
 * @param {string} id
 * @returns {Promise<{ success: boolean, project?: any, data?: any, error?: string } | null>}
 */
export const load = (id) => invoke('loadProject', id);

/**
 * Create or update a project record.
 * @param {object} projectData
 * @returns {Promise<{ success: boolean, project?: any, error?: string } | null>}
 */
export const save = (projectData) => invoke('saveProject', projectData);

/**
 * @param {string} id
 * @returns {Promise<{ success: boolean, error?: string } | null>}
 */
export const remove = (id) => invoke('deleteProject', id);
