import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { Timestamp } from "firebase/firestore";
import { INSTRUMENT_KEY } from "../../../lib/preferredInstrument";
import { LibraryPageView, type LibrarySongbook } from "./LibraryPageView";
import { project, songbook, user } from "../../../../.storybook/fixtures/screens";

// A stand-in cover image, so stories show songbooks with and without one.
const coverUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 594">' +
    '<rect width="420" height="594" fill="#fcee21"/>' +
    '<text x="210" y="140" font-family="sans-serif" font-size="56" ' +
    'font-weight="700" text-anchor="middle">CAPA</text></svg>',
)}`;

// A trumpet cover, so choosing "Trompete" visibly changes those songbooks.
const trumpetCoverUrl = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 594">' +
    '<rect width="420" height="594" fill="#000"/>' +
    '<text x="210" y="140" font-family="sans-serif" font-size="48" ' +
    'font-weight="700" fill="#fcee21" text-anchor="middle">TROMPETE</text></svg>',
)}`;

const sample = (
  slug: string,
  title: string,
  updated: string,
  extra: Partial<LibrarySongbook> = {},
): LibrarySongbook => ({
  ...songbook,
  id: `${songbook.projectId}~${slug}`,
  slug,
  title,
  projectTitle: project.title,
  updatedAt: Timestamp.fromDate(new Date(`${updated}T12:00:00`)),
  ...extra,
});

const otherProject = { projectId: "sopro-de-carnaval", projectTitle: "Sopro de Carnaval" };

const songbooks: LibrarySongbook[] = [
  sample("carnaval", "Carnaval 2026", "2026-02-01", {
    coverUrl,
    coverUrls: { flauta: coverUrl, trompete: trumpetCoverUrl },
  }),
  sample("ensaio", "Ensaios de janeiro", "2026-01-12"),
  sample("marchinhas", "Marchinhas clássicas", "2025-11-30", { coverUrl }),
  sample("frevo", "Frevos", "2025-09-03"),
  sample("carnaval-2025", "Carnaval 2025", "2025-02-20", { ...otherProject, coverUrl }),
  sample("pre-carnaval", "Pré-carnaval", "2025-01-15", otherProject),
  sample("arraia", "Arraiá do Pisa", "2026-07-04", otherProject),
];

/** The songbooks shown, in order. */
const shownTitles = (canvasElement: HTMLElement) =>
  within(
    within(canvasElement).getByRole("list", { name: "Cadernos" }),
  )
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".library-caderno-title")?.textContent);

const meta = {
  title: "Screens/LibraryPage",
  component: LibraryPageView,
  parameters: { route: "/biblioteca", routePath: "/biblioteca", fullScreen: true },
  // "Instrumento" remembers its choice; each story starts without one.
  beforeEach: () => {
    try {
      localStorage.removeItem(INSTRUMENT_KEY);
    } catch {
      // Storage blocked: nothing was remembered either.
    }
  },
  args: {
    songbooks: { status: "ready", items: songbooks },
    currentUser: null,
    collabEnabled: true,
    inboxCount: 0,
    onOpenUserModal: fn(),
    onSignOut: fn(),
  },
} satisfies Meta<typeof LibraryPageView>;
export default meta;
type Story = StoryObj<typeof LibraryPageView>;

export const Default: Story = {};
export const SignedIn: Story = { args: { currentUser: user, inboxCount: 2 } };
export const Loading: Story = { args: { songbooks: { status: "loading" } } };
export const LoadError: Story = { args: { songbooks: { status: "error" } } };
export const Empty: Story = {
  args: { songbooks: { status: "ready", items: [] } },
};
export const ShowingInstrument: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Instrumento" }),
      "Trompete",
    );
    const list = canvas.getByRole("list", { name: "Cadernos" });
    const carnaval = within(list).getByRole("link", { name: /Carnaval 2026/ });
    await expect(carnaval.querySelector("img")).toHaveAttribute(
      "src",
      trumpetCoverUrl,
    );
  },
};
export const SortedByTitle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      canvas.getByRole("combobox", { name: "Ordenar por" }),
      "Título (A–Z)",
    );
    await expect(shownTitles(canvasElement)[0]).toBe("Arraiá do Pisa");
  },
};
export const Search: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox"), "marchinha");
    await expect(shownTitles(canvasElement)).toEqual(["Marchinhas clássicas"]);
  },
};
export const NoResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("searchbox"), "xyz");
    await expect(
      await canvas.findByText("Nenhum caderno encontrado."),
    ).toBeVisible();
  },
};
