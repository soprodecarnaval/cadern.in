export type WarningCode =
  | "MULTIPLE_MSCZ"
  | "NO_MSCZ"
  | "METAJSON_MISSING"
  | "METAJSON_PARSE_FAILED"
  | "INSTRUMENT_NOT_DETECTED"
  | "PART_NAME_EMPTY"
  | "PART_NO_SVG"
  | "PART_NO_MIDI"
  | "VALIDATION_ERROR";

const messages: Record<WarningCode, string> = {
  MULTIPLE_MSCZ: "Múltiplos arquivos .mscz encontrados; usando o primeiro",
  NO_MSCZ: "Nenhum arquivo .mscz encontrado",
  METAJSON_MISSING: "Arquivo metajson não encontrado",
  METAJSON_PARSE_FAILED: "Falha ao ler o metajson",
  INSTRUMENT_NOT_DETECTED: "Instrumento não reconhecido no nome do arquivo",
  PART_NAME_EMPTY: 'Nome da parte vazio para "{entryPath}"',
  PART_NO_SVG: 'Parte "{partName}" não tem arquivos SVG',
  PART_NO_MIDI: 'Parte "{partName}" não tem arquivo MIDI',
  VALIDATION_ERROR: "Validação: {path} — {zodMessage}",
};

export function translateWarning(code: WarningCode, meta: Record<string, unknown> = {}): string {
  return messages[code].replace(/\{(\w+)\}/g, (_, key) => String(meta[key] ?? `{${key}}`));
}
