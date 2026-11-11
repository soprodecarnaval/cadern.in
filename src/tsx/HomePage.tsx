import { useAuth } from "../auth";
import { FEATURE_FLAG_COLLAB_FLOW as collabEnabled } from "../featureFlags";
import * as storage from "../lib/builderStorage";
import { useCollectionContext } from "../useCollectionContext";
import { HomePageView } from "./HomePageView";
import { PDFGenerator } from "./PdfGenerator";
import { SaveSongbookModal } from "./SaveSongbookModal";
import { ScoreCard as Card } from "./ScoreCard";
const components = { Card, PDFGenerator, SaveSongbookModal };
export function HomePage(props: { onRequestLogin: () => void }) {
  const { currentUser } = useAuth();
  const collection = useCollectionContext();
  return (
    <HomePageView
      {...props}
      currentUser={currentUser}
      collection={collection}
      storage={storage}
      collabEnabled={collabEnabled}
      components={components}
    />
  );
}
