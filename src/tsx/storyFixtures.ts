import type { ScoreViewModel, PartViewModel } from "../../types/viewModels";

export const part: PartViewModel = {
  name: "Flauta",
  instrument: "flauta",
  midi: "#fixture-midi",
  svg: [
    "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><rect width="400" height="180" fill="white"/><text x="20" y="80">Partitura de exemplo — Flauta</text></svg>',
      ),
  ],
};
export const score: ScoreViewModel = {
  id: "fixture-score",
  title: "Carnaval em Belo Horizonte",
  composer: "Compositor de exemplo",
  sub: "Arranjo para bloco",
  tags: ["carnaval", "samba"],
  projectId: "fixture-project",
  projectTitle: "Bloco de exemplo",
  latestRevision: {
    id: "fixture-revision",
    revisionNumber: 1,
    uploadedBy: "fixture-user",
    uploadedAt: {
      seconds: 0,
      nanoseconds: 0,
    } as ScoreViewModel["latestRevision"]["uploadedAt"],
    mscz: "",
    metajson: "",
    midi: "",
    parts: [part],
    notes: "",
  },
};
export const noop = () => undefined;
