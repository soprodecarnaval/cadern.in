import type { ComponentProps } from "react";
import * as db from "../lib/db";
import { saveAsNewSongbook } from "../lib/saveSongbook";
import { SaveSongbookModalView } from "./SaveSongbookModalView";
const services = { ...db, saveAsNewSongbook };

export function SaveSongbookModal(
  props: Omit<ComponentProps<typeof SaveSongbookModalView>, "services">,
) {
  return <SaveSongbookModalView {...props} services={services} />;
}
