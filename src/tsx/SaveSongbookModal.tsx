import type { ComponentProps } from "react";
import * as db from "../lib/db";
import { saveAsNewSongbook } from "../lib/saveSongbook";
import { getOrCreateDefaultProject } from "../lib/uploadScore";
import { SaveSongbookModalView } from "./SaveSongbookModalView";
const services = { ...db, saveAsNewSongbook, getOrCreateDefaultProject };

export function SaveSongbookModal(
  props: Omit<ComponentProps<typeof SaveSongbookModalView>, "services">,
) {
  return <SaveSongbookModalView {...props} services={services} />;
}
