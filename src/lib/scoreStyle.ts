import type { ScoreViewModel } from "../../types/viewModels";

/** The first tag is the musical style in the existing Montar convention. */
export const scoreStyleLabel = (score: Pick<ScoreViewModel, "tags">) =>
  (score.tags[0] ?? "").trim();

export const scoreStyleKey = (score: Pick<ScoreViewModel, "tags">) =>
  scoreStyleLabel(score).toLocaleLowerCase("pt-BR");
