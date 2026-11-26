import { DEFAULT_SPACING } from "../../../lib/scoreRender/profile";
import { comparePartsByInstrument, partInstrumentLabels } from "../../../lib/preferredInstrument";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { zInstrument, type Instrument } from "../../../../types/instrument";
import { pirataInstrument } from "../../../lib/instruments";
import type { FingeringSettings, FormattingProfile, PartFormatting } from "../../../../types/formattingProfile";
import { SONGBOOK_FIT_AREA } from "../../../../types/formattingProfile";
import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Page } from "../../atoms/Page";
import { Select } from "../../atoms/Select";
import { PartTabs } from "../../components/scores/PartTabs";
import { projectPath, ROUTE_PATTERNS } from "../../../lib/routes";
import type { UploadContext } from "../../../../types/exportDeepLink";
import type { ScoreMetadata } from "../../../../types/docs";
import {
  STEPS,
  formattingOf,
  hasOverride,
  metadataProblem,
  tagsFromText,
  warningText,
  withFingerings,
  withFormatting,
  withFormattingForAll,
  withInstrument,
  withoutOverride,
  MAX_SCORE_BYTES,
  type ArrangementPreview,
  type CollisionDraft,
  type EnviarState,
  type PartRow,
  type Preview,
  type PreviewAudio,
  type Step,
} from "./enviarState";
import type { MidiPlayerProps } from "../../components/audio/MidiPlayer";
import { notesAtTime } from "../../../lib/browserScore/playbackNotes";
import { withTextFonts } from "../../../lib/sharedFonts";
import { CollisionPage } from "./CollisionPage";
import { manualOffsetsFor, type MarkingMove } from "../../../lib/scoreRender/collisionSvg";
import { FINGERING_SIZE, STAFF_SIZE, stepSize, type SizeRange } from "./fingeringSize";

import "./EnviarPage.css";

type FingeringNotation = NonNullable<FingeringSettings["notation"]>;

export type EnviarPageViewProps = {
  state: EnviarState;
  context: UploadContext;
  signedIn: boolean;
  onFile: (file: File) => void;
  onStep: (step: Step) => void;
  onRows: (rows: PartRow[], profile?: FormattingProfile) => boolean | void;
  onProfile: (profile: FormattingProfile) => boolean | void;
  onArrangementPreview: (signal: AbortSignal) => Promise<ArrangementPreview>;
  onCollision: (ordinal: number, action: MarkingMove | "undo" | "reset") => void;
  onMetadata: (metadata: ScoreMetadata) => void;
  onEditing: (ordinal: number | null) => void;
  onListen: (ordinal: number) => void;
  onSend: () => void;
  onCancel: () => void;
  onDismissError: () => void;
  onReset: () => void;
  components: { MidiPlayer: ComponentType<MidiPlayerProps> };
};

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;
const decimal = (value: number, digits = 2) => value.toFixed(digits).replace(".", ",");

function statusText(state: EnviarState): string {
  const { status } = state;
  switch (status.kind) {
    case "loading-engine":
      return "Baixando o motor de partituras. Isso só demora na primeira vez.";
    case "opening":
      return `Abrindo ${state.fileName ?? "o arquivo"}…`;
    case "preparing":
      return "Conferindo o destino do envio…";
    case "rendering": {
      const { progress } = status;
      if (progress?.step === "render" || progress?.step === "midi") {
        return `Preparando ${progress.part ?? "parte"} (${progress.done + 1} de ${progress.total})…`;
      }
      return "Preparando as partes…";
    }
    case "uploading": {
      const progress = status.progress;
      return progress && progress.stage === "uploading"
        ? `Enviando arquivos (${progress.filesUploaded} de ${progress.filesTotal})…`
        : "Salvando a partitura…";
    }
    default:
      return "";
  }
}

const busy = (state: EnviarState) => !["idle", "error"].includes(state.status.kind);

function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((item) => item.step === step);
  return (
    <ol className="enviar-steps" aria-label="Etapas do envio">
      {STEPS.map((item, index) => (
        <li
          key={item.step}
          className={index === current ? "is-current" : index < current || step === "feito" ? "is-done" : ""}
          aria-current={index === current ? "step" : undefined}
        >
          <span className="enviar-step-number" aria-hidden>{index + 1}</span> {item.label}
        </li>
      ))}
    </ol>
  );
}

function FileStep({ state, onFile }: Pick<EnviarPageViewProps, "state" | "onFile">) {
  return (
    <section aria-labelledby="enviar-arquivo">
      <h2 id="enviar-arquivo" tabIndex={-1}>Arquivo</h2>
      <p>
        Envie o arquivo exatamente como salvou no MuseScore depois de editar a música. A formatação do
        caderninho é feita aqui, no navegador: não precisa do plugin nem do programa de exportação.
      </p>
      <label
        className="enviar-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) {onFile(file);}
        }}
      >
        <strong>Arraste o arquivo .mscz para cá</strong>
        <span>ou clique para escolher</span>
        <input
          type="file"
          accept=".mscz,.mscx"
          disabled={busy(state)}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {onFile(file);}
            event.target.value = "";
          }}
        />
      </label>
      <p className="enviar-hint">Arquivos .mscz ou .mscx do MuseScore 4, até {mb(MAX_SCORE_BYTES)}.</p>
    </section>
  );
}

function PartsStep({ state, onRows }: Pick<EnviarPageViewProps, "state" | "onRows">) {
  const set = (ordinal: number, change: (row: PartRow) => PartRow) =>
    onRows(state.rows.map((row) => (row.ordinal === ordinal ? change(row) : row)));
  const rows = [...state.rows].sort(comparePartsByInstrument);
  return (
    <section aria-labelledby="enviar-partes">
      <h2 id="enviar-partes" tabIndex={-1}>Partes</h2>
      <p>
        Confira o instrumento de cada parte. Partes sem instrumento ficam de fora. Os piratas (números de
        posição ou pisto) se escolhem na formatação.
      </p>
      <div className="table-responsive">
        <table className="table enviar-parts">
          <thead>
            <tr>
              <th scope="col">Enviar</th>
              <th scope="col">Parte</th>
              <th scope="col" className="enviar-parts-file">No MuseScore</th>
              <th scope="col">Instrumento</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ordinal}>
                <td>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label={`Enviar ${row.name}`}
                    checked={row.include && !!row.instrument}
                    disabled={!row.instrument}
                    onChange={(event) => set(row.ordinal, (current) => ({ ...current, include: event.target.checked }))}
                  />
                </td>
                <th scope="row">
                  {row.name}
                  <span className="enviar-parts-file-inline">{row.museScoreInstrument}</span>
                </th>
                <td className="enviar-parts-file">{row.museScoreInstrument}</td>
                <td>
                  <Select
                    aria-label={`Instrumento de ${row.name}`}
                    value={row.instrument ? pirataInstrument(row.instrument, false) : ""}
                    onChange={(event) =>
                      set(row.ordinal, (current) => withInstrument(current, (event.target.value || null) as Instrument | null))
                    }
                  >
                    <option value="">— escolha —</option>
                    {zInstrument.options.filter((instrument) => !instrument.endsWith(" pirata")).map((instrument) => (
                      <option key={instrument} value={instrument}>{instrument}</option>
                    ))}
                  </Select>
                  {row.guessed && <small className="enviar-part-note">Adivinhado pelo nome; confira.</small>}
                  {row.idInstrument && <small className="enviar-part-note">No MuseScore: {pirataInstrument(row.idInstrument, false)}. Usando o nome da parte; confira.</small>}
                  {!row.instrument && <small className="enviar-part-note is-error">Sem instrumento: fica de fora.</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DataStep({ state, onMetadata, onStep }: Pick<EnviarPageViewProps, "state" | "onMetadata" | "onStep">) {
  const { metadata } = state;
  // Tags are typed as one comma-separated line; the text is kept as typed.
  const [tagsText, setTagsText] = useState(metadata.tags.join(", "));
  const problem = metadataProblem(metadata);
  const field = (key: "title" | "composer" | "sub", label: string, hint?: string) => (
    <div className="enviar-field">
      <label htmlFor={`enviar-${key}`}>{label}</label>
      <Input id={`enviar-${key}`} value={metadata[key]} required={key === "title"}
        aria-describedby={hint ? `enviar-${key}-hint` : undefined}
        onChange={(event) => onMetadata({ ...metadata, [key]: event.target.value })} />
      {hint && <p id={`enviar-${key}-hint`} className="enviar-hint">{hint}</p>}
    </div>
  );
  return (
    <section aria-labelledby="enviar-dados">
      <h2 id="enviar-dados" tabIndex={-1}>Dados</h2>
      <p>Confira os dados lidos do arquivo. As correções valem para o que é guardado no cadern.in; o arquivo .mscz vai como você enviou.</p>
      <form id="enviar-data-form" className="enviar-data" onSubmit={(event) => { event.preventDefault(); if (!problem) {onStep("formatacao");} }}>
        {field("title", "Título")}
        {field("composer", "Compositor")}
        {field("sub", "Trecho")}
        <div className="enviar-field">
          <label htmlFor="enviar-tags">Tags</label>
          <Input id="enviar-tags" value={tagsText} aria-describedby="enviar-tags-hint"
            onChange={(event) => { setTagsText(event.target.value); onMetadata({ ...metadata, tags: tagsFromText(event.target.value) }); }} />
          <p id="enviar-tags-hint" className="enviar-hint">Separe as tags com vírgulas.</p>
        </div>
        {problem && <p className="enviar-field-error" role="alert">{problem}</p>}
      </form>
    </section>
  );
}

function Choice({ label, value, options, onChange, name, children }: {
  label: string; name: string; value: string; options: [string, string][]; onChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <fieldset className="enviar-choice">
      <legend>{label}</legend>
      {options.map(([option, text]) => (
        <label key={option} className="form-check form-check-inline">
          <input
            type="radio"
            className="form-check-input"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span className="form-check-label">{text}</span>
        </label>
      ))}
      {children}
    </fieldset>
  );
}

function AutoNumber({ label, name, value, min, max, step, unit, stepper, onChange, children }: {
  label: string; name: string; value: "auto" | number | undefined; min: number; max: number; step: number; unit?: string;
  /** Shown under the field, e.g. a link to apply the value elsewhere. */
  children?: ReactNode;
  /** −/+ buttons, and the value the automatic fit chose shown (and used as the start) while automatic. */
  stepper?: { automatic: number | undefined; range: SizeRange };
  onChange: (value: "auto" | number) => boolean | void;
}) {
  const manual = typeof value === "number";
  const displayedValue = manual ? value : stepper?.automatic;
  const fixedDefault = stepper ? stepper.automatic ?? stepper.range.default : min + (max - min) / 2;
  // What is being typed: applied as soon as it is a number in range (typing fixes the value);
  // anything else waits, with a hint, and leaving the field shows the applied value again.
  const [draft, setDraft] = useState<string | null>(null);
  const validNumber = (text: string, number: number) =>
    text.trim() !== "" && Number.isFinite(number) && number >= min && number <= max && (step < 1 || Number.isInteger(number));
  const invalid = draft !== null && !validNumber(draft, Number(draft.trim().replace(",", ".")));
  const hintId = `${name}-range`;
  return (
    <fieldset className="enviar-choice">
      <legend>{label}</legend>
      <label className="form-check form-check-inline">
        <input type="radio" className="form-check-input" name={name} checked={!manual} onChange={() => onChange("auto")} />
        <span className="form-check-label">Automático</span>
      </label>
      <label className="form-check form-check-inline">
        <input type="radio" className="form-check-input" name={name} checked={manual} onChange={() => onChange(fixedDefault)} />
        <span className="form-check-label">Fixo</span>
      </label>
      {(manual || stepper) && (
        <span className="enviar-number">
          {stepper && (
            <Button variant="secondary" size="sm" aria-label={`Diminuir: ${label}`}
              disabled={displayedValue === undefined || displayedValue <= min}
              onClick={() => { if (displayedValue !== undefined) {onChange(stepSize(stepper.range, displayedValue, -1));} }}>−</Button>
          )}
          <Input
            type="text"
            inputMode="decimal"
            role="spinbutton"
            aria-label={`${label}${unit ? ` (${unit})` : ""}`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={displayedValue}
            value={draft ?? (displayedValue === undefined ? "" : decimal(displayedValue, step < 1 ? 2 : 0))}
            placeholder={stepper ? "auto" : undefined}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? hintId : undefined}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {return;}
              event.preventDefault();
              const from = displayedValue ?? fixedDefault;
              const direction = event.key === "ArrowUp" ? 1 : -1;
              const next = stepper ? stepSize(stepper.range, from, direction) : Math.min(max, Math.max(min, from + direction * step));
              setDraft(null);
              onChange(next);
            }}
            onChange={(event) => {
              const text = event.target.value;
              setDraft(text);
              const number = Number(text.trim().replace(",", "."));
              if (validNumber(text, number) &&
                  onChange(Math.round(number * 100) / 100) === false) {setDraft(null);}
            }}
            onBlur={() => setDraft(null)}
          />
          {stepper && (
            <Button variant="secondary" size="sm" aria-label={`Aumentar: ${label}`}
              disabled={displayedValue === undefined || displayedValue >= max}
              onClick={() => { if (displayedValue !== undefined) {onChange(stepSize(stepper.range, displayedValue, 1));} }}>+</Button>
          )}
          {unit && <span>{unit}</span>}
        </span>
      )}
      {invalid && (
        <p id={hintId} className="enviar-field-error">
          Use um {step < 1 ? "valor" : "valor inteiro"} de {decimal(min, step < 1 ? 2 : 0)} a {decimal(max, step < 1 ? 2 : 0)}{unit ? ` ${unit}` : ""}.
        </p>
      )}
      {children}
    </fieldset>
  );
}

function Controls({ state, onProfile, onRows, onCollision, shownRow, shownPreview, shownLabel }: Pick<EnviarPageViewProps, "state" | "onProfile" | "onRows" | "onCollision"> & {
  shownRow: PartRow | undefined; shownPreview: Preview | undefined; shownLabel: string;
}) {
  const ready = !!shownPreview && !shownPreview.rendering && !shownPreview.error;
  // Confirmations float over the page, so the column never shifts; kept here so a tab switch keeps them.
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  return (
    <form className="enviar-controls" onSubmit={(event) => event.preventDefault()} aria-label="Formatação">
      <Toast notice={notice} onClose={() => setNotice(null)} />
      {shownRow && (
        <section className="enviar-controls-section" aria-labelledby="enviar-parte">
          <header>
            <h3 id="enviar-parte">Parte: {shownLabel}</h3>
            <p>Vale só para a parte aberta na prévia; escolha outra nas abas.</p>
          </header>
          <PartControls key={shownRow.ordinal} state={state} onProfile={onProfile} onRows={onRows} row={shownRow} label={shownLabel}
            onApplied={(text) => setNotice((current) => ({ id: (current?.id ?? 0) + 1, text }))}
            automaticStaff={ready ? shownPreview.layout?.staffSpaceMm : undefined}
            automaticFingering={ready ? shownPreview.automaticFingeringSize : undefined} />
          <PositioningControls state={state} row={shownRow} preview={shownPreview} onCollision={onCollision} />
        </section>
      )}
    </form>
  );
}

function PositioningControls({ state, row, preview, onCollision }: {
  state: EnviarState;
  row: PartRow;
  preview: Preview | undefined;
  onCollision: EnviarPageViewProps["onCollision"];
}) {
  const ready = !!preview?.pageSvg && !preview.rendering && !preview.error;
  const draft = state.collisions[row.ordinal];
  const canUndo = !!draft?.history.length && draft.original === preview?.pageSvg && draft.signature === preview?.signature;
  const canReset = canUndo || !!manualOffsetsFor(state.profile, row.ordinal)?.length;
  const warnings = (preview?.warnings ?? []).map(warningText).filter((text): text is string => !!text);
  if (preview && preview.pages > 1 && !warnings.some((text) => text.startsWith("Não coube"))) {warnings.unshift("Não coube em uma página.");}
  return (
    <fieldset className="enviar-choice">
      <legend>Posicionamento</legend>
      <p className="enviar-hint">Arraste números dos piratas, indicações de texto ou marcas de repetição na prévia.</p>
      <div className="enviar-position-actions">
        <Button size="sm" variant="secondary" disabled={!ready || !canUndo}
          onClick={() => onCollision(row.ordinal, "undo")}>Desfazer último movimento</Button>
        <Button size="sm" variant="secondary" disabled={!ready || !canReset}
          onClick={() => onCollision(row.ordinal, "reset")}>Restaurar posições</Button>
      </div>
      {warnings.length > 0 && <ul className="enviar-warnings">{warnings.map((text) => <li key={text}>{text}</li>)}</ul>}
    </fieldset>
  );
}

/** The settings of the part shown in the preview. */
/** How long a confirmation stays on screen. */
export const TOAST_MS = 5000;

/**
 * A short confirmation at the top right of the window, over the page, gone after TOAST_MS.
 * The live region is always there, so screen readers announce each new text.
 */
function Toast({ notice, onClose }: { notice: { id: number; text: string } | null; onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!notice) {return;}
    const timer = setTimeout(() => close.current(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  return createPortal(
    <div className="enviar-toast-region" role="status" aria-live="polite">
      {notice && (
        <div className="enviar-toast" key={notice.id}>
          <span>{notice.text}</span>
          <button type="button" className="enviar-toast-close" aria-label="Fechar aviso" onClick={onClose}>×</button>
        </div>
      )}
    </div>,
    document.body,
  );
}

function PartControls({ state, onProfile, onRows, row, label, automaticStaff, automaticFingering, onApplied }: Pick<EnviarPageViewProps, "state" | "onProfile" | "onRows"> & {
  row: PartRow; label: string; automaticStaff: number | undefined; automaticFingering: number | undefined;
  onApplied: (text: string) => void;
}) {
  const settings = formattingOf(state.profile, row);
  const evenNoteSpacing = settings.spacing?.evenNoteSpacing ?? DEFAULT_SPACING.evenNoteSpacing;
  const change = (patch: PartFormatting) => onProfile(withFormatting(state.profile, row, patch));
  const included = state.rows.filter((candidate) => candidate.include && candidate.instrument);
  // This part's choice (a fixed size, or automatic) made the choice of every other part.
  const names = (targets: readonly PartRow[]) => [row, ...targets.filter((target) => target.ordinal !== row.ordinal)];
  const countText = (count: number) => `${count} ${count === 1 ? "outra parte" : "outras partes"}`;
  const applyToAll = (field: string, targets: readonly PartRow[], patch: PartFormatting) => {
    if (onProfile(withFormattingForAll(state.profile, names(targets), patch)) === false) {return;}
    onApplied(`${field} aplicado a ${countText(targets.length)}.`);
  };
  const link = (field: string, targets: readonly PartRow[], apply: () => void) => targets.length > 0 && (
    <Button variant="text" size="sm" className="enviar-apply-all" aria-label={`Aplicar a todas as partes: ${field}`} onClick={apply}>
      Aplicar a todas as partes
    </Button>
  );
  const applyLink = (field: string, targets: readonly PartRow[], patch: PartFormatting) =>
    link(field, targets, () => applyToAll(field, targets, patch));
  const others = included.filter((candidate) => candidate.ordinal !== row.ordinal);
  // Piratas: off (the part goes without numbers, and is filed under its plain instrument), or on in a
  // notation: generated positions or valves, or the fingerings the file already has.
  const notation = settings.fingering?.notation ?? "positions";
  const piratas: "off" | FingeringNotation = row.fingerings ? notation : "off";
  const setPiratas = (targets: readonly PartRow[], value: string) => {
    const on = value !== "off";
    const affected = new Set([row.ordinal, ...targets.map((target) => target.ordinal)]);
    const rows = state.rows.map((candidate) => affected.has(candidate.ordinal) ? withFingerings(candidate, on) : candidate);
    const profile = on ? withFormattingForAll(state.profile, names(targets), { fingering: { notation: value as FingeringNotation } }) : state.profile;
    onRows(rows, profile);
  };
  const fingeredOthers = others.filter((candidate) => candidate.fingeringsAvailable);
  return (
    <>
      <fieldset className="enviar-choice">
        <legend>Espaçamento</legend>
        <label className="form-check">
          <input type="checkbox" className="form-check-input" checked={evenNoteSpacing}
            onChange={(event) => change({ spacing: { evenNoteSpacing: event.target.checked } })} />
          <span className="form-check-label">Espaçamento uniforme de notas e pausas</span>
        </label>
        {applyLink("Espaçamento uniforme", others, { spacing: { evenNoteSpacing } })}
      </fieldset>
      <AutoNumber label="Tamanho da pauta" name="part-staff-size" unit="mm" value={settings.staffSize}
        min={STAFF_SIZE.min} max={STAFF_SIZE.max} step={STAFF_SIZE.step}
        stepper={{ range: STAFF_SIZE, automatic: automaticStaff }}
        onChange={(staffSize) => change({ staffSize })}>
        {applyLink("Tamanho da pauta", others, { staffSize: settings.staffSize ?? "auto" })}
      </AutoNumber>
      {row.fingerings && (
        <AutoNumber label="Tamanho dos números" name="fingering-size" value={settings.fingering?.size}
          min={FINGERING_SIZE.min} max={FINGERING_SIZE.max} step={FINGERING_SIZE.step}
          stepper={{ range: FINGERING_SIZE, automatic: automaticFingering }}
          onChange={(size) => change({ fingering: { size } })}>
          {applyLink("Tamanho dos números", others.filter((candidate) => candidate.fingerings), { fingering: { size: settings.fingering?.size ?? "auto" } })}
        </AutoNumber>
      )}
      {row.fingeringsAvailable && (
        <Choice label="Piratas" name="part-notation" value={piratas}
          options={[["positions", "Posições (1–7)"], ["valves", "Pistos"], ["file", "Do arquivo"], ["off", "Desligado"]]}
          onChange={(value) => setPiratas([], value)}>
          {link("Piratas", fingeredOthers, () => {
            setPiratas(fingeredOthers, piratas);
            onApplied(`Piratas aplicados a ${countText(fingeredOthers.length)}.`);
          })}
        </Choice>
      )}
      <FingeringAndCleanupControls settings={settings} onChange={change}
        showTrombone={row.fingerings && notation === "positions" && row.family === "trombone"} />
      {hasOverride(state.profile, row) && (
        <Button variant="text" onClick={() => onProfile(withoutOverride(state.profile, row))}>
          Voltar {label} ao padrão
        </Button>
      )}
    </>
  );
}

function FingeringAndCleanupControls({ settings, onChange, showTrombone }: {
  settings: PartFormatting;
  onChange: (patch: PartFormatting) => void;
  showTrombone: boolean;
}) {
  return (
    <>
      {showTrombone && (
        <label className="form-check">
          <input type="checkbox" className="form-check-input" checked={settings.fingering?.dynamicTrombone ?? false}
            onChange={(event) => onChange({ fingering: { dynamicTrombone: event.target.checked } })} />
          <span className="form-check-label">Trombone dinâmico (posições alternativas)</span>
        </label>
      )}
      <fieldset className="enviar-choice">
        <legend>Limpeza</legend>
        {([["credits", "Tirar título e textos de cabeçalho"], ["staffText", "Tirar textos de pauta"]] as const).map(([key, text]) => (
          <label key={key} className="form-check">
            <input type="checkbox" className="form-check-input" checked={settings.cleanup?.[key] ?? true}
              onChange={(event) => onChange({ cleanup: { [key]: event.target.checked } })} />
            <span className="form-check-label">{text}</span>
          </label>
        ))}
      </fieldset>
    </>
  );
}

function PreviewCard({ row, label, preview, draft, midi, onListen, onCollision, MidiPlayer }: {
  row: PartRow; label: string; preview: Preview | undefined; draft: CollisionDraft | undefined; midi: PreviewAudio | undefined;
  onListen: (ordinal: number) => void; onCollision: EnviarPageViewProps["onCollision"];
  MidiPlayer: ComponentType<MidiPlayerProps>;
}) {
  const ready = !!preview?.pageSvg && !preview.rendering && !preview.error;
  const pageSvg = ready ? preview.pageSvg : undefined;
  const audio = pageSvg && midi?.pageSvg === pageSvg ? midi : undefined;
  const loadAudio = useRef(onListen);
  loadAudio.current = onListen;
  useEffect(() => {
    if (pageSvg) {loadAudio.current(row.ordinal);}
  }, [pageSvg, row.ordinal]);
  const [playing, setPlaying] = useState<{ url: string; notes: readonly string[] } | null>(null);
  const onPlaybackTime = (seconds: number | null) => {
    if (!audio) {return;}
    const notes = notesAtTime(audio.frames, seconds);
    setPlaying((current) => current?.url === audio.url && current.notes === notes ? current : { url: audio.url, notes });
  };
  const corrected = draft && draft.signature === preview?.signature && draft.original === preview?.pageSvg
    ? draft.history.at(-1) : undefined;
  const svg = corrected
    ? (preview?.fontCss ? withTextFonts(corrected, preview.fontCss) : corrected)
    : preview?.svg;
  return (
    <article className="enviar-preview" aria-busy={preview?.rendering ?? true} aria-label={`Prévia de ${label}`} data-part-name={row.name} data-part-ordinal={row.ordinal}>
      <div className="enviar-sheet" style={{ aspectRatio: `${SONGBOOK_FIT_AREA.widthMm} / ${SONGBOOK_FIT_AREA.heightMm}` }}>
        {ready && svg ? (
          <CollisionPage svg={svg} label={`Página de ${label}`} activeNotes={playing?.url === audio?.url ? playing?.notes : undefined} onMove={(move) => onCollision(row.ordinal, move)} />
        ) : svg ? (
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt={`Página de ${label}`} />
        ) : (
          <span className="enviar-sheet-placeholder">{preview?.error ?? "Desenhando…"}</span>
        )}
        {preview?.rendering && preview.svg && <span className="enviar-sheet-updating">Atualizando…</span>}
      </div>
      <MidiPlayer key={audio?.url ?? "pending"} src={audio?.url ?? ""} onPlaybackTime={audio ? onPlaybackTime : undefined} />
    </article>
  );
}

const ARRANGEMENT_MARGIN: SizeRange = { min: 5, max: 20, step: 1, default: 10 };
const ARRANGEMENT_SPACING: SizeRange = { min: 0, max: 48, step: 1, default: 4 };

function ArrangementFormatting({ state, onProfile, onArrangementPreview }: Pick<EnviarPageViewProps, "state" | "onProfile" | "onArrangementPreview">) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState({ page: null as ArrangementPreview | null, error: "", loading: false });
  useEffect(() => {
    if (!open) {return;}
    const controller = new AbortController();
    setPreview((current) => ({ ...current, loading: true, error: "" }));
    const timeout = window.setTimeout(() => {
      void onArrangementPreview(controller.signal).then((page) => {
        if (!controller.signal.aborted) {setPreview({ page, error: "", loading: false });}
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setPreview((current) => ({ ...current, error: error instanceof Error ? error.message : "Não foi possível desenhar o arranjo.", loading: false }));
        }
      });
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, onArrangementPreview]);

  const change = (field: "arrangementMarginMm" | "arrangementStaffSizeMm" | "arrangementStaffSpacing", value: number | "auto") =>
    onProfile({ ...state.profile, [field]: value === "auto" ? undefined : value });
  const staffSize = state.profile.arrangementStaffSizeMm;
  const actualSize = !preview.loading && !preview.error ? preview.page?.staffSpaceMm : undefined;
  return (
    <details className="mt-3" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Formatar arranjo (opcional)</summary>
      {open && <div className="mt-2">
        <div className="enviar-format">
          <div className="enviar-controls">
            <AutoNumber label="Margens do arranjo" name="arrangement-margin" unit="mm" value={state.profile.arrangementMarginMm}
              min={ARRANGEMENT_MARGIN.min} max={ARRANGEMENT_MARGIN.max} step={ARRANGEMENT_MARGIN.step} stepper={{ range: ARRANGEMENT_MARGIN, automatic: ARRANGEMENT_MARGIN.default }}
              onChange={(value) => change("arrangementMarginMm", value)} />
            <AutoNumber label="Tamanho da pauta" name="arrangement-staff-size" unit="mm" value={staffSize}
              min={STAFF_SIZE.min} max={STAFF_SIZE.max} step={STAFF_SIZE.step} stepper={{ range: STAFF_SIZE, automatic: actualSize === undefined ? undefined : Number(actualSize.toFixed(2)) }}
              onChange={(value) => change("arrangementStaffSizeMm", value)} />
            <AutoNumber label="Espaço entre pautas" name="arrangement-spacing" value={state.profile.arrangementStaffSpacing}
              min={ARRANGEMENT_SPACING.min} max={ARRANGEMENT_SPACING.max} step={ARRANGEMENT_SPACING.step} stepper={{ range: ARRANGEMENT_SPACING, automatic: ARRANGEMENT_SPACING.default }}
              onChange={(value) => change("arrangementStaffSpacing", value)} />
            <p className="enviar-preview-info">O tamanho da pauta pode ser reduzido para caber em uma página A4 horizontal.</p>
            {staffSize !== undefined && actualSize !== undefined && actualSize < staffSize - 0.01 &&
              <p className="enviar-preview-info">Tamanho na página: {decimal(actualSize)} mm.</p>}
          </div>
          <div>
            {preview.loading && <p role="status">Atualizando arranjo…</p>}
            {preview.error && <p role="alert">{preview.error}</p>}
            {preview.page && <div className="enviar-sheet" style={{ aspectRatio: "297 / 210" }}>
              <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.page.svg)}`} alt="Prévia do arranjo" />
            </div>}
          </div>
        </div>
      </div>}
    </details>
  );
}

function FormatStep(props: EnviarPageViewProps) {
  const { state, onEditing, onListen, components } = props;
  const included = state.rows.filter((row) => row.include && row.instrument)
    .sort(comparePartsByInstrument);
  // One part at a time: the active tab is also the part the "Parte" settings change.
  const shownRow = included.find((row) => row.ordinal === state.editing) ?? included[0];
  const shownPreview = shownRow && state.previews[shownRow.ordinal];
  const labels = partInstrumentLabels(state.rows.filter((row) => row.include && row.instrument));
  const shownLabel = shownRow ? labels.get(shownRow) ?? "" : "";
  return (
    <section aria-labelledby="enviar-formatacao">
      <h2 id="enviar-formatacao" tabIndex={-1}>Formatação</h2>
      <p>As prévias mostram cada parte no tamanho em que sai no caderninho ({decimal(SONGBOOK_FIT_AREA.widthMm, 1)} × {decimal(SONGBOOK_FIT_AREA.heightMm, 1)} mm).</p>
      <div className="enviar-format">
        <Controls {...props} shownRow={shownRow} shownPreview={shownPreview} shownLabel={shownLabel} />
        <div className="enviar-previews">
          {shownRow && (
            <PartTabs
              label="Partes"
              active={String(shownRow.ordinal)}
              onChange={(key) => onEditing(Number(key))}
              tabs={included.map((row) => {
                const preview = state.previews[row.ordinal];
                const warned = !!preview && (preview.pages > 1 || preview.warnings.some((warning) => warningText(warning)) || !!preview.error);
                return { key: String(row.ordinal), label: labels.get(row) ?? "", note: !preview?.rendering && warned ? "⚠" : undefined };
              })}
            >
              <PreviewCard key={`${shownRow.ordinal}:${shownPreview?.signature ?? ""}`} row={shownRow} label={shownLabel} preview={shownPreview}
                draft={state.collisions[shownRow.ordinal]} onCollision={props.onCollision}
                midi={state.midi[shownRow.ordinal]} onListen={onListen} MidiPlayer={components.MidiPlayer} />
            </PartTabs>
          )}
        </div>
      </div>
      <ArrangementFormatting {...props} />
    </section>
  );
}

function SendStep({ state }: Pick<EnviarPageViewProps, "state">) {
  const target = state.target;
  const count = state.rows.filter((row) => row.include && row.instrument).length;
  const destination = !target
    ? null
    : target.kind === "new"
      ? `Partitura nova: “${state.metadata.title}”`
      : target.kind === "version"
        ? `Nova versão de “${target.title}”`
        : `Cópia de “${target.sourceTitle}”, do projeto ${target.sourceProjectTitle}, neste projeto`;
  return (
    <section aria-labelledby="enviar-enviar">
      <h2 id="enviar-enviar" tabIndex={-1}>Enviar</h2>
      {destination && (
        <dl className="enviar-summary">
          <dt>Destino</dt>
          <dd>{destination}</dd>
          <dt>Partes</dt>
          <dd>{count} {count === 1 ? "parte" : "partes"}</dd>
          {state.checks?.resolved.songbookTitle && (<><dt>Caderninho</dt><dd>{state.checks.resolved.songbookTitle} (a versão fixada é atualizada)</dd></>)}
        </dl>
      )}
      {state.checks?.targetMismatch && <div className="alert alert-warning">{state.checks.targetMismatch}</div>}
    </section>
  );
}

function DoneStep({ state, context, onReset }: Pick<EnviarPageViewProps, "state" | "context" | "onReset">) {
  const result = state.result!;
  const scorePath = ROUTE_PATTERNS.scoreRevision
    .replace(":scoreId", encodeURIComponent(result.identity.scoreId))
    .replace(":revisionId", encodeURIComponent(result.identity.revisionId));
  return (
    <section aria-labelledby="enviar-feito">
      <h2 id="enviar-feito" tabIndex={-1}>Partitura enviada</h2>
      <p>
        {context.mode === "reformat"
          ? "A partitura reformatada foi salva como uma nova versão."
          : result.target.kind === "version" ? "A nova versão foi salva." : "A partitura foi salva."}
      </p>
      {result.repin === "updated" && <p>O caderninho passou a usar esta versão.</p>}
      {result.repin === "skipped-stale" && (
        <div className="alert alert-warning">O caderninho mudou durante o envio e continua com a versão anterior. Atualize a versão fixada na página do caderninho.</div>
      )}
      <div className="enviar-actions">
        <a className="btn btn-primary ds-button" href={scorePath}>Ver a partitura</a>
        <a className="btn btn-outline-secondary ds-button" href={projectPath(context.projectId)}>Voltar ao projeto</a>
        {context.mode !== "reformat" && <Button variant="text" onClick={onReset}>Enviar outra</Button>}
      </div>
    </section>
  );
}

function StepActions({ state, context, onStep, onSend, onCancel }: Pick<EnviarPageViewProps, "state" | "context" | "onStep" | "onSend" | "onCancel">) {
  const included = state.rows.filter((row) => row.include && row.instrument);
  let secondary: ReactNode;
  let primary: ReactNode;
  switch (state.step) {
    case "partes":
      secondary = context.mode !== "reformat" && <Button variant="secondary" onClick={() => onStep("arquivo")}>Trocar arquivo</Button>;
      primary = <Button disabled={!included.length} onClick={() => onStep("dados")}>Continuar</Button>;
      break;
    case "dados":
      secondary = <Button variant="secondary" onClick={() => onStep("partes")}>Voltar às partes</Button>;
      primary = <Button form="enviar-data-form" type="submit" disabled={!!metadataProblem(state.metadata) || !included.length}>
        Formatar {included.length} {included.length === 1 ? "parte" : "partes"}
      </Button>;
      break;
    case "formatacao":
      secondary = <>
        <Button variant="secondary" onClick={() => onStep("dados")}>Voltar aos dados</Button>
        {included.some((row) => state.previews[row.ordinal]?.rendering) &&
          <Button variant="text" onClick={onCancel}>Parar prévias</Button>}
      </>;
      primary = <Button onClick={() => onStep("enviar")}>Continuar</Button>;
      break;
    case "enviar": {
      const sending = state.status.kind === "rendering" || state.status.kind === "uploading";
      secondary = <Button variant="secondary" disabled={busy(state)} onClick={() => onStep("formatacao")}>Voltar à formatação</Button>;
      primary = <Button disabled={!state.target || sending} onClick={onSend}>{sending ? "Enviando…" : "Enviar partitura"}</Button>;
      break;
    }
    default:
      return null;
  }
  // Keyed by step: reusing the clicked button as the next step's submit button
  // would let the click's default action submit the Dados form, skipping it.
  return <div className="enviar-step-actions" key={state.step}>
    <div className="enviar-step-secondary">{secondary}</div>
    {primary}
  </div>;
}

export function EnviarPageView(props: EnviarPageViewProps) {
  const { state, signedIn } = props;
  const main = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  // Focus moves to the new step's heading (not on arrival).
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    main.current?.querySelector<HTMLElement>("h2[tabindex]")?.focus();
  }, [state.step]);
  const status = statusText(state);
  const reformat = props.context.mode === "reformat";
  return (
    <Page className="enviar-page">
      <h1>{reformat ? `Reformatar ${state.metadata.title || "partitura"}` : "Enviar partitura"}</h1>
      {reformat && (
        <p>As correções manuais são reaplicadas quando as indicações são reconhecidas na nova versão.</p>
      )}
      <Stepper step={state.step} />
      <p className="enviar-status" role="status" aria-live="polite">
        {status}
        {busy(state) && state.status.kind !== "uploading" && (
          <Button size="sm" variant="text" onClick={props.onCancel}>Cancelar</Button>
        )}
      </p>
      {state.status.kind === "error" && (
        <div className="alert alert-danger d-flex justify-content-between align-items-start gap-2" role="alert">
          <span>{state.status.message}</span>
          <Button size="sm" variant="text" onClick={props.onDismissError}>Fechar</Button>
        </div>
      )}
      {!signedIn && <div className="alert alert-info">Entre na sua conta para enviar. Você pode formatar a partitura antes.</div>}
      <div ref={main}>
        {state.step === "arquivo" && !reformat && <FileStep {...props} />}
        {state.step === "partes" && <PartsStep {...props} />}
        {state.step === "dados" && <DataStep {...props} />}
        {state.step === "formatacao" && <FormatStep {...props} />}
        {state.step === "enviar" && <SendStep {...props} />}
        {state.step === "feito" && state.result && <DoneStep {...props} />}
      </div>
      <StepActions {...props} />
    </Page>
  );
}
