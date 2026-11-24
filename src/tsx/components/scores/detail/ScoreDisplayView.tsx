import { Button } from "../../../atoms/Button";
import { useScoreSvg } from "../../../../lib/useSvgUrl";
import { PartTabs } from "../PartTabs";
import { useEffect, useRef, useState } from "react";
import { Badge, Card, Placeholder } from "react-bootstrap";
import { SiMidi } from "react-icons/si";
import type { CommentAnchor } from "../../../../../types/docs";
import { zScorePlaybackTiming, type PlaybackFrame } from "../../../../../types/scorePlayback";
import { notesAtTime } from "../../../../lib/browserScore/playbackNotes";
import type { MidiPlayerProps } from "../../audio/MidiPlayer";
import { ScoreSvgFrame } from "../ScoreSvgFrame";

/** A numbered comment pin on one page of one part. */
export interface ScorePin {
  id: string;
  number: number;
  anchor: CommentAnchor;
}

/** Review-comment overlay: pins, and picking a point for a new comment. */
export interface ScorePinsProps {
  pins: ScorePin[];
  selectedPinId: string | null;
  onPinClick: (id: string) => void;
  // While true, clicking a page reports the point instead.
  picking: boolean;
  onPick: (anchor: CommentAnchor) => void;
}

function SvgImage({
  url,
  partName,
  page,
  pinsProps,
  activeNotes,
  onPageReady,
}: {
  url: string;
  partName: string;
  page: number;
  pinsProps?: ScorePinsProps;
  activeNotes?: readonly string[];
  onPageReady?: (doc: Document, page: HTMLDivElement) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const shown = useScoreSvg(url, !!activeNotes);
  const [readyMarkup, setReadyMarkup] = useState<string | undefined>();
  const frameReady = !!shown.markup && readyMarkup === shown.markup;
  const picking = pinsProps?.picking ?? false;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinsProps || !picking) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    pinsProps.onPick({
      partName,
      page,
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    });
  };

  const pins =
    pinsProps?.pins.filter(
      (p) => p.anchor.partName === partName && p.anchor.page === page,
    ) ?? [];

  return (
    <div
      ref={container}
      style={{
        position: "relative",
        // A definite width: in the flex column, the page would otherwise be measured at its natural
        // size (a library page is 171.7 mm wide) and the scaled image would overflow the card.
        width: "100%",
        cursor: picking ? "crosshair" : undefined,
      }}
      onClick={handleClick}
    >
      {loaded &&
        pins.map((pin) => (
          <Button
            key={pin.id}
            type="button"
            title={`Comentário ${pin.number}`}
            onClick={(e) => {
              e.stopPropagation();
              pinsProps?.onPinClick(pin.id);
            }}
            variant={pinsProps?.selectedPinId === pin.id ? "danger" : "primary"}
            size="sm"
            className="rounded-circle p-0"
            style={{
              position: "absolute",
              left: `${pin.anchor.x * 100}%`,
              top: `${pin.anchor.y * 100}%`,
              width: 26,
              height: 26,
              transform: "translate(-50%, -50%)",
              fontSize: 12,
              zIndex: 1,
            }}
          >
            {pin.number}
          </Button>
        ))}
      {!loaded && (
        <Placeholder animation="glow">
          <Placeholder
            style={{ width: "100%", height: 200, display: "block" }}
          />
        </Placeholder>
      )}
      <img
        src={shown.url}
        alt=""
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          border: "var(--ds-border) solid var(--ds-ink)",
          background: "var(--ds-paper)",
          display: loaded ? "block" : "none",
          visibility: frameReady ? "hidden" : undefined,
        }}
      />
      {loaded && shown.markup && (
        <ScoreSvgFrame
          svg={shown.markup}
          label={`${partName} · Página ${page}`}
          activeNotes={activeNotes}
          tabIndex={-1}
          onReady={(doc) => {
            setReadyMarkup(shown.markup);
            if (container.current) {onPageReady?.(doc, container.current);}
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "var(--ds-border) solid var(--ds-ink)",
            background: "var(--ds-paper)",
            pointerEvents: "none",
            visibility: frameReady ? "visible" : "hidden",
          }}
        />
      )}
    </div>
  );
}

export interface ScoreDisplayPart {
  name: string;
  instrument: string;
  svgUrls: string[];
  midiUrl: string | null;
  playback?: { midiUrl: string; timingUrl: string };
  warnings?: string[];
}

export type ScoreDisplayArrangement = Pick<ScoreDisplayPart, "svgUrls" | "playback">;

interface Props {
  MidiPlayer: import("react").ComponentType<MidiPlayerProps>;
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  arrangementMidiUrl?: string | null;
  arrangement?: ScoreDisplayArrangement;
  parts: ScoreDisplayPart[];
  pinsProps?: ScorePinsProps;
}

function PartPages({ part, MidiPlayer, pinsProps, followPages = false }: {
  part: Pick<ScoreDisplayPart, "name" | "svgUrls" | "midiUrl" | "playback">;
  followPages?: boolean;
  MidiPlayer: Props["MidiPlayer"];
  pinsProps?: ScorePinsProps;
}) {
  const timingUrl = part.playback?.midiUrl ? part.playback.timingUrl : undefined;
  const [frames, setFrames] = useState<readonly PlaybackFrame[] | null | undefined>(timingUrl ? null : undefined);
  const [notes, setNotes] = useState<readonly string[]>([]);
  const pageByNote = useRef(new Map<string, HTMLDivElement>());
  const followedPage = useRef<HTMLDivElement | null>(null);
  const registerPage = (doc: Document, page: HTMLDivElement) => {
    for (const note of doc.querySelectorAll("g.note[id]")) {
      pageByNote.current.set(note.id, page);
    }
  };
  const follow = (active: readonly string[]) => {
    const page = active.map((id) => pageByNote.current.get(id)).find((element) => element?.isConnected);
    if (!page || page === followedPage.current) {return;}
    followedPage.current = page;
    page.scrollIntoView({ block: "nearest" });
  };
  useEffect(() => {
    if (!timingUrl) {return;}
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(timingUrl, { signal: controller.signal });
        if (!response.ok) {throw new Error(`Timing HTTP ${response.status}`);}
        const timing = zScorePlaybackTiming.parse(await response.json());
        if (!controller.signal.aborted) {setFrames(timing.frames);}
      } catch {
        if (!controller.signal.aborted) {setFrames(undefined);}
      }
    })();
    return () => controller.abort();
  }, [timingUrl]);

  const playerUrl = frames ? part.playback?.midiUrl : part.midiUrl;
  return (
    <>
      {frames === null ? <p role="status">Carregando áudio…</p> : playerUrl && (
        <MidiPlayer
          key={playerUrl}
          src={playerUrl}
          onPlaybackTime={frames ? (seconds) => {
            const active = notesAtTime(frames, seconds);
            setNotes(active);
            if (followPages && seconds !== null) {follow(active);}
            if (seconds === null) {followedPage.current = null;}
          } : undefined}
        />
      )}
      <div className="d-flex flex-column gap-2">
        {part.svgUrls.map((url, i) => (
          <SvgImage key={`${i}:${url}`} url={url} partName={part.name} page={i + 1}
            pinsProps={pinsProps} activeNotes={timingUrl ? notes : undefined} onPageReady={followPages ? registerPage : undefined} />
        ))}
      </div>
    </>
  );
}

function ArrangementPanel({ arrangement, midiUrl, title, MidiPlayer }: {
  arrangement?: ScoreDisplayArrangement;
  midiUrl: string | null;
  title: string;
  MidiPlayer: Props["MidiPlayer"];
}) {
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState(false);
  const print = async () => {
    if (!arrangement || printing) {return;}
    setPrinting(true);
    setPrintError(false);
    try {
      const { createArrangementPdf } = await import("../../../../createSongBook");
      await createArrangementPdf(arrangement.svgUrls, title);
    } catch {
      setPrintError(true);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Card className="mb-3">
      <Card.Body>
        <details onToggle={(event) => setOpen(event.currentTarget.open)}>
          <summary className="h5 mb-0">Arranjo completo</summary>
          {open && <div className="mt-3">
            {arrangement ? <>
              <Button variant="secondary" className="mb-3" disabled={printing} onClick={() => void print()}>
                {printing ? "Gerando PDF…" : "Imprimir arranjo"}
              </Button>
              {printError && <p role="alert">Não foi possível gerar o PDF do arranjo. Tente novamente.</p>}
              <PartPages key={JSON.stringify(arrangement.svgUrls)} part={{ name: "Arranjo", midiUrl, ...arrangement }}
                MidiPlayer={MidiPlayer} followPages />
            </> : <>
              <p>Esta versão ainda não tem a grade do arranjo. A grade fica disponível em uma nova versão reformatada.</p>
              {midiUrl && <MidiPlayer src={midiUrl} />}
            </>}
          </div>}
        </details>
      </Card.Body>
    </Card>
  );
}

export function ScoreDisplayView({
  MidiPlayer,
  title,
  composer,
  sub,
  tags,
  arrangementMidiUrl,
  arrangement,
  parts,
  pinsProps,
}: Props) {
  // One part at a time, in tabs; a selected comment pin shows its part.
  const [shownName, setShownName] = useState<string | null>(null);
  const selectedPinPart = pinsProps?.pins.find((pin) => pin.id === pinsProps.selectedPinId)?.anchor.partName;
  useEffect(() => {
    if (selectedPinPart) {setShownName(selectedPinPart);}
  }, [pinsProps?.selectedPinId, selectedPinPart]);
  const part = parts.find((candidate) => candidate.name === shownName) ?? parts[0];
  return (
    <>
      <Card className="mb-3">
        <Card.Body>
          <p>
            <strong>Título:</strong> {title || <em>não detectado</em>}
          </p>
          <p>
            <strong>Compositor:</strong> {composer || <em>não detectado</em>}
          </p>
          <p>
            <strong>Sub:</strong> {sub || <em>não detectado</em>}
          </p>
          <p className="mb-0">
            <strong>Tags:</strong>{" "}
            {tags.length > 0 ? tags.join(", ") : <em>nenhuma</em>}
          </p>
        </Card.Body>
      </Card>

      {(arrangement || arrangementMidiUrl) && (
        <ArrangementPanel arrangement={arrangement} midiUrl={arrangementMidiUrl ?? null} title={title} MidiPlayer={MidiPlayer} />
      )}

      {parts.length > 0 && (
        <Card className="mb-3">
          <Card.Body>
            <Card.Title>Partes</Card.Title>
            <PartTabs
              label="Partes"
              active={part?.name ?? ""}
              onChange={setShownName}
              tabs={parts.map((part) => ({ key: part.name, label: part.name, note: part.midiUrl ? undefined : "⚠" }))}
            >
              {part && (
              <div className="mb-3">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong>{part.name}</strong>
                  <span className="text-muted">— {part.instrument}</span>
                  {!part.midiUrl && <Badge bg="danger">sem MIDI</Badge>}
                  {part.midiUrl && (
                    <a href={part.midiUrl} target="_blank" rel="noreferrer" aria-label={`Baixar MIDI de ${part.name}`}>
                      <SiMidi />
                    </a>
                  )}
                  {part.warnings?.map((w, i) => (
                    <Badge bg="warning" text="dark" key={i}>
                      {w}
                    </Badge>
                  ))}
                </div>
                <PartPages key={JSON.stringify([part.name, part.midiUrl, part.playback?.timingUrl])}
                  part={part} MidiPlayer={MidiPlayer} pinsProps={pinsProps} />
              </div>
              )}
            </PartTabs>
          </Card.Body>
        </Card>
      )}
    </>
  );
}
