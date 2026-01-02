/** Builds encoded editor URL for a learning path */
export function buildEditorUrl(
  baseUrl: string,
  community: string,
  pathId: string,
): string {
  return `${baseUrl}editor/${encodeURIComponent(community)}/${encodeURIComponent(pathId)}`;
}

/** Builds encoded view URL for a learning path */
export function buildViewUrl(
  baseUrl: string,
  community: string,
  pathId: string,
): string {
  return `${baseUrl}view/${encodeURIComponent(community)}/${encodeURIComponent(pathId)}`;
}

/** Builds view URL with optional community (backwards compatibility) */
export function buildViewUrlLegacy(
  baseUrl: string,
  pathId: string,
  community?: string,
): string {
  if (community) {
    return buildViewUrl(baseUrl, community, pathId);
  }
  return `${baseUrl}view/${encodeURIComponent(pathId)}`;
}
