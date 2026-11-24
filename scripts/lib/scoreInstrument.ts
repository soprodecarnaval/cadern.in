import type { Instrument } from "../../types/instrument";
import { mapInstrumentId as mapId } from "../../src/lib/instruments";

// The exporter's view of the shared instrument table (src/lib/instruments):
// one part name, undefined for instruments cadern.in does not support.
export const mapInstrumentId = (
  instrumentId: string,
  name = "",
): Instrument | undefined => mapId(instrumentId, [name]) ?? undefined;
