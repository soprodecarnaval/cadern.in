import type { Meta, StoryObj } from "@storybook/react";
import publicMeta from "../../src/tsx/screens/songbooks/public/SongbookPage.stories";
import manageMeta from "../../src/tsx/screens/songbooks/manage/SongbookManagePage.stories";
import readerMeta from "../../src/tsx/components/songbooks/reader/SongbookReader.stories";
import { SongbookPageView } from "../../src/tsx/screens/songbooks/public/SongbookPageView";
import { SongbookManagePageView } from "../../src/tsx/screens/songbooks/manage/SongbookManagePageView";
import { SongbookScorePageView } from "../../src/tsx/screens/songbooks/review/SongbookScorePageView";
import { SongbookReader } from "../../src/tsx/components/songbooks/reader/SongbookReader";
import { SongbookGenerationPanelView } from "../../src/tsx/components/songbooks/generation/SongbookGenerationPanelView";
import { ReviewCommentsPanelView } from "../../src/tsx/components/review/ReviewCommentsPanelView";
import { Page } from "../../src/tsx/atoms/Page";
import "../../src/tsx/atoms/Modal.css";
import { services, user, scoreComponents, songbook, bookRevision, numberedItems, generate } from "../fixtures/screens";
import { coverPreviewFixture } from "../fixtures/components";

const meta = {
  title: "Design System/Songbook batch",
  component: SongbookPageView,
  args: publicMeta.args,
  parameters: publicMeta.parameters,
  decorators: [(Story) => (
    <Page className="py-4">
      <p className="text-muted">Proposta · lote 3 · cadernos, leitura e revisão. Dados fictícios; mídia e geração simuladas.</p>
      <Story />
    </Page>
  )],
} satisfies Meta<typeof SongbookPageView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Public: Story = {};
export const Manage: Story = {
  parameters: manageMeta.parameters,
  render: () => <SongbookManagePageView {...manageMeta.args} />,
};
export const Reader: Story = {
  parameters: { route: "/", routePath: "/" },
  render: () => <SongbookReader {...readerMeta.args} />,
};
export const Review: Story = {
  parameters: {
    route: "/project/bloco-exemplo/songbook/carnaval/manage/score/fixture-score",
    routePath: "/project/:slug/songbook/:songbookSlug/manage/score/:scoreId",
  },
  render: () => <SongbookScorePageView services={services} currentUser={user} role="owner" components={{ ScoreDisplay: scoreComponents.ScoreDisplay, ReviewCommentsPanel: ReviewCommentsPanelView }} />,
};
export const Generation: Story = {
  render: () => (
    <SongbookGenerationPanelView
      currentUser={user}
      songbook={songbook}
      revision={bookRevision}
      items={numberedItems}
      canEditCovers
      generateSongbookPdfs={generate}
      saveSongbookCovers={(input) => Promise.resolve(input.current.covers)}
      createCoverPreview={coverPreviewFixture}
      onCoversSaved={() => undefined}
    />
  ),
};
