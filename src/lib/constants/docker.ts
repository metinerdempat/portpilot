/**
 * Valid container id / name shape. execFile runs no shell, but this still
 * rejects ids that could be read as a flag ("-…") or carry odd characters.
 */
export const CONTAINER_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
