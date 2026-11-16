import { useCollectionContext } from "../../../../useCollectionContext";
import { ScoreCard } from "../../../components/scores/card/ScoreCard";
import {
  ScoreSearchResultsView,
  type ScoreSearchResultsProps,
} from "./ScoreSearchResultsView";
export function ScoreSearchResults(props: ScoreSearchResultsProps) {
  const collection = useCollectionContext();
  return (
    <ScoreSearchResultsView
      {...props}
      collection={collection}
      Card={ScoreCard}
    />
  );
}
