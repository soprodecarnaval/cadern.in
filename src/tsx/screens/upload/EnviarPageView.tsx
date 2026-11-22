import { useEffect, useRef, useState, type ComponentType } from "react";
import { zInstrument, type Instrument } from "../../../../types/instrument";
import type { FormattingProfile, PartFormatting } from "../../../../types/formattingProfile";
import { SONGBOOK_FIT_AREA } from "../../../../types/formattingProfile";
import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Page } from "../../atoms/Page";
import { Select } from "../../atoms/Select";
import { PartTabs } from "../../components/scores/PartTabs";
import { projectPath, ROUTE_PATTERNS } from "../../../lib/routes";
import type { UploadContext } from "../../../../types/exportDeepLink";
import {
  STEPS,
  formattingOf,
  hasOverride,
  warningText,
  withFingerings,
  withFormatting,
  withInstrument,
  withoutOverride,
  MAX_SCORE_BYTES,
  type EnviarState,
  type PartRow,
  type Preview,
  type Step,
} from "./enviarState";

import "./EnviarPage.css";

export type EnviarPageViewProps = {
  state: EnviarState;
  context: UploadContext;
  signedIn: boolean;
  onFile: (file: File) => void;
  onStep: (step: Step) => void;
  onRows: (rows: PartRow[]) => void;
  onProfile: (profile: FormattingProfile) => void;
  onEditing: (ordinal: number | null) => void;
  onListen: (ordinal: number) => void;
  onSend: () => void;
  onCancel: () => void;
  onDismissError: () => void;
  onReset: () => void;
  components: { MidiPlayer: ComponentType<{ src: string }> };
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

function PartsStep({ state, context, onRows, onStep }: Pick<EnviarPageViewProps, "state" | "context" | "onRows" | "onStep">) {
  const set = (ordinal: number, change: (row: PartRow) => PartRow) =>
    onRows(state.rows.map((row) => (row.ordinal === ordinal ? change(row) : row)));
  const included = state.rows.filter((row) => row.include && row.instrument).length;
  return (
    <section aria-labelledby="enviar-partes">
      <h2 id="enviar-partes" tabIndex={-1}>Partes</h2>
      <p>
        Confira o instrumento de cada parte. Partes sem instrumento ficam de fora. Com piratas, trompete e
        trombone entram como <em>trompete pirata</em> e <em>trombone pirata</em>.
      </p>
      <div className="table-responsive">
        <table className="table enviar-parts">
          <thead>
            <tr>
              <th scope="col">Enviar</th>
              <th scope="col">Parte</th>
              <th scope="col">No MuseScore</th>
              <th scope="col">Instrumento</th>
              <th scope="col">Piratas</th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row) => (
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
                <th scope="row">{row.name}</th>
                <td className="text-muted">{row.museScoreInstrument}</td>
                <td>
                  <Select
                    aria-label={`Instrumento de ${row.name}`}
                    value={row.instrument ?? ""}
                    onChange={(event) =>
                      set(row.ordinal, (current) => withInstrument(current, (event.target.value || null) as Instrument | null))
                    }
                  >
                    <option value="">— escolha —</option>
                    {zInstrument.options.map((instrument) => (
                      <option key={instrument} value={instrument}>{instrument}</option>
                    ))}
                  </Select>
                  {row.guessed && <small className="text-muted d-block">Adivinhado pelo nome; confira.</small>}
                  {!row.instrument && <small className="text-danger d-block">Sem instrumento: fica de fora.</small>}
                </td>
                <td>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label={`Piratas em ${row.name}`}
                    checked={row.fingerings}
                    disabled={!row.fingeringsAvailable}
                    onChange={(event) => set(row.ordinal, (current) => withFingerings(current, event.target.checked))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="enviar-actions">
        {context.mode !== "reformat" && <Button variant="secondary" onClick={() => onStep("arquivo")}>Trocar arquivo</Button>}
        <Button disabled={!included} onClick={() => onStep("formatacao")}>
          Formatar {included} {included === 1 ? "parte" : "partes"}
        </Button>
      </div>
    </section>
  );
}

function Choice({ label, value, options, onChange, name }: {
  label: string; name: string; value: string; options: [string, string][]; onChange: (value: string) => void;
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
    </fieldset>
  );
}

function AutoNumber({ label, name, value, min, max, step, unit, onChange }: {
  label: string; name: string; value: "auto" | number | undefined; min: number; max: number; step: number; unit?: string;
  onChange: (value: "auto" | number) => void;
}) {
  const manual = typeof value === "number";
  return (
    <fieldset className="enviar-choice">
      <legend>{label}</legend>
      <label className="form-check form-check-inline">
        <input type="radio" className="form-check-input" name={name} checked={!manual} onChange={() => onChange("auto")} />
        <span className="form-check-label">Automático</span>
      </label>
      <label className="form-check form-check-inline">
        <input type="radio" className="form-check-input" name={name} checked={manual} onChange={() => onChange(manual ? value : min + (max - min) / 2)} />
        <span className="form-check-label">Fixo</span>
      </label>
      {manual && (
        <span className="enviar-number">
          <Input
            type="number"
            aria-label={`${label}${unit ? ` (${unit})` : ""}`}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => {
              const number = Number(event.target.value);
              if (Number.isFinite(number) && number >= min && number <= max) {onChange(number);}
            }}
          />
          {unit && <span>{unit}</span>}
        </span>
      )}
    </fieldset>
  );
}

function Controls({ state, onProfile, onEditing }: Pick<EnviarPageViewProps, "state" | "onProfile" | "onEditing">) {
  const editingRow = state.rows.find((row) => row.ordinal === state.editing) ?? null;
  const partName = editingRow?.name ?? null;
  const settings = formattingOf(state.profile, partName);
  const change = (patch: PartFormatting) => onProfile(withFormatting(state.profile, partName, patch));
  const included = state.rows.filter((row) => row.include && row.instrument);
  const families = new Set((editingRow ? [editingRow] : included).filter((row) => row.fingerings).map((row) => row.family));
  const notation = settings.fingering?.notation ?? "positions";
  return (
    <form className="enviar-controls" onSubmit={(event) => event.preventDefault()} aria-label="Formatação">
      <label className="form-label" htmlFor="enviar-editing">Ajustar</label>
      <Select id="enviar-editing" value={state.editing ?? ""} onChange={(event) => onEditing(event.target.value ? Number(event.target.value) : null)}>
        <option value="">Todas as partes</option>
        {included.map((row) => (
          <option key={row.ordinal} value={row.ordinal}>
            Só {row.name}{hasOverride(state.profile, row.name) ? " (ajustada)" : ""}
          </option>
        ))}
      </Select>
      <AutoNumber label="Tamanho da pauta" name="staff" unit="mm" value={settings.staffSize} min={0.8} max={2.4} step={0.05}
        onChange={(staffSize) => change({ staffSize })} />
      <AutoNumber label="Sistemas na página" name="systems" value={settings.systemsPerPage} min={1} max={12} step={1}
        onChange={(systemsPerPage) => change({ systemsPerPage })} />
      {families.size > 0 && (
        <>
          <Choice label="Piratas" name="notation" value={notation}
            options={[["positions", "Posições (1–7)"], ["valves", "Pistos"]]}
            onChange={(value) => change({ fingering: { notation: value as "positions" | "valves" } })} />
          {notation === "positions" && families.has("trombone") && (
            <label className="form-check">
              <input type="checkbox" className="form-check-input" checked={settings.fingering?.dynamicTrombone ?? false}
                onChange={(event) => change({ fingering: { dynamicTrombone: event.target.checked } })} />
              <span className="form-check-label">Trombone dinâmico (posições alternativas)</span>
            </label>
          )}
          <AutoNumber label="Tamanho dos números" name="fingering-size" value={settings.fingering?.size} min={0.4} max={1.6} step={0.05}
            onChange={(size) => change({ fingering: { size } })} />
        </>
      )}
      <fieldset className="enviar-choice">
        <legend>Limpeza</legend>
        {([["credits", "Tirar título e textos de cabeçalho"], ["fingerings", "Tirar dedilhados do arquivo"], ["staffText", "Tirar textos de pauta"]] as const).map(([key, text]) => (
          <label key={key} className="form-check">
            <input type="checkbox" className="form-check-input" checked={settings.cleanup?.[key] ?? true}
              onChange={(event) => change({ cleanup: { [key]: event.target.checked } })} />
            <span className="form-check-label">{text}</span>
          </label>
        ))}
      </fieldset>
      {editingRow && hasOverride(state.profile, editingRow.name) && (
        <Button variant="text" onClick={() => onProfile(withoutOverride(state.profile, editingRow.name))}>
          Voltar {editingRow.name} para o ajuste de todas as partes
        </Button>
      )}
    </form>
  );
}

function PreviewCard({ row, preview, title, midi, onEditing, onListen, MidiPlayer }: {
  row: PartRow; preview: Preview | undefined; title: string; midi: string | undefined;
  onEditing: (ordinal: number) => void; onListen: (ordinal: number) => void; MidiPlayer: ComponentType<{ src: string }>;
}) {
  const warnings = (preview?.warnings ?? []).map(warningText).filter((text): text is string => !!text);
  if (preview && preview.pages > 1 && !warnings.some((text) => text.startsWith("Não coube"))) {warnings.unshift("Não coube em uma página.");}
  return (
    <article className="enviar-preview" aria-busy={preview?.rendering ?? true} aria-label={`Prévia de ${row.name}`}>
      <header className="enviar-sheet-header">
        <span className="enviar-sheet-number">00</span>
        <span className="enviar-sheet-title">{title}</span>
        <span className="enviar-sheet-instrument">{row.name}</span>
      </header>
      <div className="enviar-sheet" style={{ aspectRatio: `${SONGBOOK_FIT_AREA.widthMm} / ${SONGBOOK_FIT_AREA.heightMm}` }}>
        {preview?.svg ? (
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`} alt={`Página de ${row.name}`} />
        ) : (
          <span className="enviar-sheet-placeholder">{preview?.error ?? "Desenhando…"}</span>
        )}
        {preview?.rendering && preview.svg && <span className="enviar-sheet-updating">Atualizando…</span>}
      </div>
      <p className="enviar-preview-info">
        {preview?.layout
          ? `Pauta de ${decimal(preview.layout.staffSpaceMm)} mm · ${preview.layout.systems} ${preview.layout.systems === 1 ? "sistema" : "sistemas"} · ocupa ${Math.round(preview.layout.fillRatio * 100)}% da altura`
          : " "}
      </p>
      {warnings.length > 0 && (
        <ul className="enviar-warnings">{warnings.map((text) => <li key={text}>{text}</li>)}</ul>
      )}
      <div className="enviar-preview-actions">
        <Button size="sm" variant="secondary" onClick={() => onEditing(row.ordinal)}>Ajustar só esta parte</Button>
        <Button size="sm" variant="text" onClick={() => onListen(row.ordinal)}>Ouvir</Button>
      </div>
      {midi && <MidiPlayer src={midi} />}
    </article>
  );
}

function FormatStep(props: EnviarPageViewProps) {
  const { state, onStep, onEditing, onListen, components } = props;
  const included = state.rows.filter((row) => row.include && row.instrument);
  const rendering = included.some((row) => state.previews[row.ordinal]?.rendering);
  // One part at a time; picking a part to adjust shows it.
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (state.editing !== null) {setShown(state.editing);}
  }, [state.editing]);
  const shownRow = included.find((row) => row.ordinal === shown) ?? included[0];
  return (
    <section aria-labelledby="enviar-formatacao">
      <h2 id="enviar-formatacao" tabIndex={-1}>Formatação</h2>
      <p>As prévias mostram cada parte no tamanho em que sai no caderninho ({decimal(SONGBOOK_FIT_AREA.widthMm, 1)} × {decimal(SONGBOOK_FIT_AREA.heightMm, 1)} mm).</p>
      <div className="enviar-format">
        <Controls {...props} />
        <div className="enviar-previews">
          {shownRow && (
            <PartTabs
              label="Partes"
              active={String(shownRow.ordinal)}
              onChange={(key) => setShown(Number(key))}
              tabs={included.map((row) => {
                const preview = state.previews[row.ordinal];
                const warned = !!preview && (preview.pages > 1 || preview.warnings.some((warning) => warningText(warning)) || !!preview.error);
                return { key: String(row.ordinal), label: row.name, note: preview?.rendering ? "…" : warned ? "⚠" : undefined };
              })}
            >
              <PreviewCard row={shownRow} preview={state.previews[shownRow.ordinal]} title={state.title}
                midi={state.midi[shownRow.ordinal]} onEditing={onEditing} onListen={onListen} MidiPlayer={components.MidiPlayer} />
            </PartTabs>
          )}
        </div>
      </div>
      <div className="enviar-actions">
        <Button variant="secondary" onClick={() => onStep("partes")}>Voltar às partes</Button>
        {rendering && <Button variant="text" onClick={props.onCancel}>Parar prévias</Button>}
        <Button onClick={() => onStep("enviar")}>Continuar</Button>
      </div>
    </section>
  );
}

function SendStep({ state, onStep, onSend }: Pick<EnviarPageViewProps, "state" | "onStep" | "onSend">) {
  const target = state.target;
  const count = state.rows.filter((row) => row.include && row.instrument).length;
  const destination = !target
    ? null
    : target.kind === "new"
      ? `Partitura nova: “${state.title}”`
      : target.kind === "version"
        ? `Nova versão de “${target.title}”`
        : `Cópia de “${target.sourceTitle}”, do projeto ${target.sourceProjectTitle}, neste projeto`;
  const sending = state.status.kind === "rendering" || state.status.kind === "uploading";
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
      <div className="enviar-actions">
        <Button variant="secondary" disabled={busy(state)} onClick={() => onStep("formatacao")}>Voltar à formatação</Button>
        <Button disabled={!target || sending} onClick={onSend}>{sending ? "Enviando…" : "Enviar partitura"}</Button>
      </div>
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
      <h1>{reformat ? `Reformatar ${state.title || "partitura"}` : "Enviar partitura"}</h1>
      {reformat && (
        <p>A música fica como está; só a formatação muda. O resultado é salvo como uma nova versão da partitura.</p>
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
        {state.step === "formatacao" && <FormatStep {...props} />}
        {state.step === "enviar" && <SendStep {...props} />}
        {state.step === "feito" && state.result && <DoneStep {...props} />}
      </div>
    </Page>
  );
}
