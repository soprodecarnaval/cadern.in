export type WarningCode =
  | "MULTIPLE_MSCZ"
  | "NO_MSCZ"
  | "METAJSON_MISSING"
  | "METAJSON_PARSE_FAILED"
  | "METAJSON_LEGACY"
  | "METAJSON_FILE_MISSING"
  | "INSTRUMENT_NOT_DETECTED"
  | "PART_NAME_EMPTY"
  | "PART_NO_SVG"
  | "PART_NO_MIDI"
  | "VALIDATION_ERROR"
  // Export app (scripts/lib/exportError.ts)
  | "EXPORT_FILE_NOT_FOUND"
  | "EXPORT_NOT_A_SCORE"
  | "EXPORT_UNSUPPORTED_VERSION"
  | "EXPORT_METADATA_UNREADABLE"
  | "EXPORT_NO_PARTS"
  | "EXPORT_SCORE_CHANGED"
  | "EXPORT_DESTINATION_NOT_DIRECTORY"
  | "EXPORT_DESTINATION_NOT_EMPTY"
  | "EXPORT_ASSETS_MISSING"
  | "EXPORT_MSCORE_NOT_SET"
  | "EXPORT_FAILED";

const messages: Record<WarningCode, string> = {
  MULTIPLE_MSCZ: "Múltiplos arquivos .mscz encontrados; usando o primeiro",
  NO_MSCZ: "Nenhum arquivo .mscz encontrado",
  METAJSON_MISSING: "Arquivo metajson não encontrado",
  METAJSON_PARSE_FAILED: "Falha ao ler o metajson",
  METAJSON_LEGACY:
    "Formato antigo de metajson. Exporte novamente pelo app exportador, " +
    "ou atualize a pasta com o script backfill:metajson.",
  METAJSON_FILE_MISSING: 'Arquivo "{file}" listado no metajson não foi enviado',
  INSTRUMENT_NOT_DETECTED: 'Instrumento não reconhecido em "{file}"',
  PART_NAME_EMPTY: 'Nome da parte vazio para "{entryPath}"',
  PART_NO_SVG: 'Parte "{partName}" não tem arquivos SVG',
  PART_NO_MIDI: 'Parte "{partName}" não tem arquivo MIDI',
  VALIDATION_ERROR: "Validação: {path} — {zodMessage}",

  EXPORT_FILE_NOT_FOUND: "Arquivo não encontrado",
  EXPORT_NOT_A_SCORE: "Este arquivo não parece ser uma partitura do MuseScore",
  EXPORT_UNSUPPORTED_VERSION:
    "Esta partitura foi salva no MuseScore {version}. Abra no MuseScore " +
    "{minimum} e salve novamente antes de exportar.",
  EXPORT_METADATA_UNREADABLE:
    "O MuseScore não conseguiu ler os dados desta partitura",
  EXPORT_NO_PARTS: "Selecione ao menos uma parte compatível",
  EXPORT_SCORE_CHANGED:
    "A partitura mudou desde que foi aberta. Recarregue e tente de novo.",
  EXPORT_DESTINATION_NOT_DIRECTORY: "A pasta de destino não existe",
  EXPORT_DESTINATION_NOT_EMPTY:
    "A pasta de destino já tem arquivos desta exportação: {files}",
  EXPORT_ASSETS_MISSING:
    "O MuseScore não gerou todos os arquivos: {missing}",
  EXPORT_MSCORE_NOT_SET: "Caminho do MuseScore não configurado",
  EXPORT_FAILED: "Falha ao exportar: {message}",
};

export function translateWarning(code: WarningCode, meta: Record<string, unknown> = {}): string {
  return messages[code].replace(/\{(\w+)\}/g, (_: string, key: string) => String(meta[key] ?? `{${key}}`));
}
