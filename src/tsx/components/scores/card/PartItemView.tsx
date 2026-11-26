import { Badge } from "../../../atoms/Badge";
import type { PartViewModel } from "../../../../../types/viewModels";

export function PartItemView({ part }: { part: PartViewModel }) {
  return <Badge pill>{part.instrument}</Badge>;
}
