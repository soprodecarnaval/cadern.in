import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { articleCards, type ArticleCard } from "../articles";
import { ArticlesPageView } from "./ArticlesPageView";
import { user } from "./screenFixtures";

// Made-up articles, to see the page with a full list. Their pages don't exist.
const sample = (
  slug: string,
  title: string,
  summary: string,
  kicker: string,
  date: string,
  imageUrl?: string,
): ArticleCard => ({
  title,
  summary,
  href: `/artigos/${slug}`,
  kicker,
  date,
  imageUrl,
});

const manyArticles: ArticleCard[] = [
  ...articleCards,
  sample(
    "capa-2026",
    "Os bastidores da capa do caderninho de 2026",
    "Do primeiro rascunho à versão impressa: como a ilustração da capa ganhou forma.",
    "Bastidores",
    "2026-01-18",
    "/assets/capa_carnaval_2026_trombone.png",
  ),
  sample(
    "campanha-anti-assedio",
    "Carnaval sem assédio: a campanha nas páginas do caderninho",
    "Por que o caderninho reserva páginas para a campanha contra o assédio nos blocos.",
    "Notícias",
    "2026-01-30",
    "/assets/anti_assedio_2026_1.png",
  ),
  sample(
    "tiragem-2025",
    "Balanço da tiragem de 2025",
    "Quantos cadernos foram impressos, para quais instrumentos e como chegaram aos blocos.",
    "Notícias",
    "2025-03-12",
    "/assets/capa_carnaval_2025_sax_alto.png",
  ),
  sample(
    "pirata",
    "O que é a pirata e como ler uma",
    "Um guia da notação pensada para quem toca sopro e quer pegar o repertório rápido.",
    "Guias",
    "2025-11-02",
    "/assets/articles/cadernin-wanda/partitura-se-ta-solteira.jpg",
  ),
  sample(
    "capa-2025",
    "Uma capa para cada instrumento",
    "Como funcionam as capas por naipe, da flauta à tuba.",
    "Bastidores",
    "2025-01-20",
    "/assets/capa_carnaval_2025_flauta.png",
  ),
  sample(
    "primeiros-ensaios",
    "Lembranças dos primeiros ensaios com o caderninho",
    "Quem estava lá em 2013 conta como era tocar com as primeiras cópias.",
    "Na imprensa",
    "2024-02-08",
    "/assets/articles/cadernin-wanda/ensaio-2013.jpg",
  ),
  sample(
    "chuva",
    "Como proteger o caderninho da chuva",
    "Dicas simples para o caderno sobreviver a um cortejo debaixo de temporal.",
    "Guias",
    "2026-02-10",
  ),
];

const meta = {
  title: "Screens/ArticlesPage",
  component: ArticlesPageView,
  parameters: { route: "/artigos", routePath: "/artigos", fullScreen: true },
  args: {
    articles: manyArticles,
    currentUser: null,
    collabEnabled: true,
    inboxCount: 0,
    onOpenUserModal: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof ArticlesPageView>;
export default meta;
type Story = StoryObj<typeof ArticlesPageView>;

export const ManyArticles: Story = {};
export const Published: Story = { args: { articles: articleCards } };
export const SignedIn: Story = { args: { currentUser: user, inboxCount: 2 } };
export const Empty: Story = { args: { articles: [] } };
export const FilteredBySection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Guias" }));
    await expect(
      canvas.getByRole("button", { name: "Guias", pressed: true }),
    ).toBeVisible();
  },
};
export const NoResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox"), "xyz");
    await expect(
      await canvas.findByText("Nenhum artigo encontrado."),
    ).toBeVisible();
  },
};
