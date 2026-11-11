import { useCollectionContext } from "../useCollectionContext";
import type { ScoreViewModel } from "../../types/viewModels";
import { SearchBarView } from "./SearchBarView";

export function SearchBar(props: {
  handleResults: (results: ScoreViewModel[], query: string) => void;
}) {
  const { status, search } = useCollectionContext();
  return <SearchBarView {...props} status={status} search={search} />;
}
