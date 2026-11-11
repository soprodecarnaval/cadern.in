import type { PartViewModel } from "../../types/viewModels";

export function PartItemView({ part }: { part: PartViewModel }) {
  return <span className="badge rounded-pill text-bg-light border">{part.instrument}</span>;
}
