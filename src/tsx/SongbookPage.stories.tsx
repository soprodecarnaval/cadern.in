import type { Meta, StoryObj } from "@storybook/react";
import { SongbookPageView } from "./SongbookPageView";
import { generate, services, songbook, songbookComponents } from "./screenFixtures";
const meta = {
  title: "Screens/SongbookPage",
  component: SongbookPageView,
  parameters: {
    route: "/project/bloco-exemplo/songbook/carnaval",
    routePath: "/project/:slug/songbook/:songbookSlug",
  },
  args: {
    services: { ...services, generateSongbookPdfs: generate },
    components: songbookComponents,
  },
} satisfies Meta<typeof SongbookPageView>;
export default meta;
type Story = StoryObj<typeof SongbookPageView>;

export const Published: Story = {};
export const NotFound: Story = {
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getSongbook: () => Promise.resolve(null),
    },
  },
};
export const Unpublished: Story = {
  args: {
    services: {
      ...services,
      generateSongbookPdfs: generate,
      getSongbook: () => Promise.resolve({ ...songbook, isPublished: false }),
    },
  },
};
