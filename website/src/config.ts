// Everything that links to the repository reads from here.
export const REPO_URL = 'https://github.com/notvasub/fanpilot';
export const REPO_LABEL = 'notvasub/fanpilot';
export const DEFAULT_BRANCH = 'main';

export const blobURL = (path: string, line?: string) =>
  `${REPO_URL}/blob/${DEFAULT_BRANCH}/${path}${line ? `#${line}` : ''}`;
