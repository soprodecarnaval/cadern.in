export function scoreRevisionStoragePath(
  projectId: string,
  scoreId: string,
  revisionId: string,
): string {
  return `projects/${projectId}/scores/${scoreId}/${revisionId}`;
}

export function songbookRevisionStoragePath(
  projectId: string,
  songbookId: string,
  revisionId: string,
): string {
  return `projects/${projectId}/songbooks/${songbookId}/${revisionId}`;
}
