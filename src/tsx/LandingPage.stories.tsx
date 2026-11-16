import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { LandingPageView } from "./LandingPageView";
import { collection, score, songbook, user } from "./screenFixtures";

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
// More than the four the section can show, so "+artigos" expands first.
const manyArticles = [1, 2, 3, 4, 5].map((n) => ({
  title: `Artigo de exemplo ${n}`,
  summary: "Um resumo curto do artigo, em uma ou duas linhas.",
  href: `/artigos/exemplo-${n}`,
  kicker: "Guias",
  date: `2026-0${n}-10`,
}));
export const ManyArticles: Story = { args: { articles: manyArticles } };
export const ArticlesExpanded: Story = {
  args: { articles: manyArticles },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText("Artigo de exemplo 3")).toBeNull();
    await userEvent.click(canvas.getByRole("link", { name: "+artigos" }));
    await expect(canvas.getByText("Artigo de exemplo 4")).toBeVisible();
    await expect(canvas.queryByText("Artigo de exemplo 5")).toBeNull();
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
