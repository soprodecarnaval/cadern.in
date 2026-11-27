// The desktop Exportador's latest release on GitHub (release-export-app.yaml
// publishes them). Update the version and file names with each release.
const VERSION = "0.1.1";
const RELEASE = `https://github.com/soprodecarnaval/cadern.in/releases/download/export-app-v${VERSION}`;

export const EXPORTER_RELEASE = {
  version: VERSION,
  /** The release page, with its notes and every file. */
  page: `https://github.com/soprodecarnaval/cadern.in/releases/tag/export-app-v${VERSION}`,
  downloads: [
    {
      system: "Mac",
      detail: "Apple Silicon (M1 ou mais novo)",
      url: `${RELEASE}/Exportador.cadern.in-${VERSION}-arm64.dmg`,
    },
    {
      system: "Windows",
      detail: "64 bits",
      url: `${RELEASE}/Exportador.cadern.in.Setup.${VERSION}.exe`,
    },
    {
      system: "Linux",
      detail: "AppImage, 64 bits",
      url: `${RELEASE}/Exportador.cadern.in-${VERSION}.AppImage`,
    },
  ],
} as const;
