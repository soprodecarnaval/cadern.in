import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { LandingPageView } from "./LandingPageView";
import { collection, score, songbook, user } from "../../../../.storybook/fixtures/screens";

// A stand-in cover image, so stories show songbooks with and without one.
const coverUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 594">' +
    '<rect width="420" height="594" fill="#fcee21"/>' +
    '<text x="210" y="140" font-family="sans-serif" font-size="56" ' +
    'font-weight="700" text-anchor="middle">CAPA</text></svg>',
)}`;

const songbooks = [
  { ...songbook, coverUrl },
  { ...songbook, id: "bloco-exemplo~ensaio", slug: "ensaio", title: "Ensaios de janeiro" },
  { ...songbook, id: "bloco-exemplo~marchinhas", slug: "marchinhas", title: "Marchinhas clássicas", coverUrl },
  { ...songbook, id: "bloco-exemplo~frevo", slug: "frevo", title: "Frevos" },
];

const meta = {
  title: "Screens/LandingPage",
  component: LandingPageView,
  parameters: { route: "/", routePath: "/", fullScreen: true },
  args: {
    currentUser: null,
    collabEnabled: true,
    inboxCount: 0,
    collection,
    songbooks: { status: "ready", items: songbooks },
    articles: [],
    onOpenUserModal: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof LandingPageView>;
export default meta;
type Story = StoryObj<typeof LandingPageView>;

export const SignedOut: Story = {};
export const SignedIn: Story = { args: { currentUser: user, inboxCount: 2 } };
export const AccountMenuOpen: Story = {
  args: { currentUser: user, inboxCount: 2 },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: /Ana Silva/ }),
    );
    await expect(
      await within(canvasElement).findByRole("button", { name: "Sair" }),
    ).toBeVisible();
  },
};
export const Legacy: Story = { args: { collabEnabled: false } };
export const LoadingSongbooks: Story = {
  args: { songbooks: { status: "loading" } },
};
export const NoSongbooks: Story = {
  args: { songbooks: { status: "ready", items: [] } },
};
export const SongbooksError: Story = {
  args: { songbooks: { status: "error" } },
};
export const WithArticles: Story = {
  args: {
    articles: [
      {
        title: "Como montar o caderninho do seu bloco",
        summary: "Um passo a passo da busca de partituras até o PDF impresso.",
        href: "/artigos/como-montar",
      },
      {
        title: "Formatando partituras no Musescore",
        summary: "Use a extensão cadern.in para deixar tudo no padrão.",
        href: "/artigos/musescore",
      },
    ],
  },
};
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox"), score.title.slice(0, 5));
    await expect(
      await canvas.findByRole("link", { name: new RegExp(score.title) }),
    ).toBeVisible();
  },
};
export const SearchNoResults: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByRole("searchbox"),
      "inexistente",
    );
  },
};
