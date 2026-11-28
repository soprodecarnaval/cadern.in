import { comparePartsByInstrument, partInstrumentLabels } from "../../../../lib/preferredInstrument";
import { Button } from "../../../atoms/Button";
import { useScoreSvg } from "../../../../lib/useSvgUrl";
import { PartTabs } from "../PartTabs";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Card, Modal, Placeholder } from "react-bootstrap";
import { Badge } from "../../../atoms/Badge";
import { SiMidi } from "react-icons/si";
import type { CommentAnchor } from "../../../../../types/docs";
import { zScorePlaybackTiming, type PlaybackFrame } from "../../../../../types/scorePlayback";
import { notesAtTime } from "../../../../lib/browserScore/playbackNotes";
import type { MidiPlayerProps } from "../../audio/MidiPlayer";
import { ScoreSvgFrame } from "../ScoreSvgFrame";
import { cursorAnchors, cursorAt, type CursorSystem, type CursorTarget } from "../../../../lib/browserScore/playbackCursor";
import { PlaybackBand } from "../PlaybackBand";
import { measureCursorGeometry, type PageCursorGeometry } from "../cursorGeometry";

/** Where the playback band is drawn on one page, in the page's pixels. */
interface PageCursor {
  x: number;
  top: number;
  bottom: number;
}

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
  partLabel,
  page,
  pinsProps,
  activeNotes,
  cursor,
  onPageReady,
}: {
  url: string;
  partName: string;
  partLabel: string;
  page: number;
  pinsProps?: ScorePinsProps;
  activeNotes?: readonly string[];
  cursor?: PageCursor;
  // Called when the frame is drawn, and again when the page is resized.
  onPageReady?: (doc: Document, page: HTMLDivElement) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const frameDoc = useRef<Document | null>(null);
  const [loaded, setLoaded] = useState(false);
  const shown = useScoreSvg(url, !!activeNotes);
  const [readyMarkup, setReadyMarkup] = useState<string | undefined>();
  const frameReady = !!shown.markup && readyMarkup === shown.markup;
  const picking = pinsProps?.picking ?? false;
  const pageReady = useRef(onPageReady);
  pageReady.current = onPageReady;

  useEffect(() => {
    const element = container.current;
    if (!element) {return;}
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) {return;}
      width = element.clientWidth;
      if (frameDoc.current) {pageReady.current?.(frameDoc.current, element);}
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
        alt={`${partLabel} · Página ${page}`}
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          background: "var(--ds-paper)",
          display: loaded ? "block" : "none",
          visibility: frameReady ? "hidden" : undefined,
        }}
      />
      {loaded && shown.markup && (
        <ScoreSvgFrame
          svg={shown.markup}
          label={`${partLabel} · Página ${page}`}
          activeNotes={activeNotes}
          tabIndex={-1}
          onReady={(doc) => {
            frameDoc.current = doc;
            setReadyMarkup(shown.markup);
            if (container.current) {onPageReady?.(doc, container.current);}
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            // No stroke around the page; "none" also drops the iframe's own.
            border: "none",
            background: "var(--ds-paper)",
            pointerEvents: "none",
            visibility: frameReady ? "visible" : "hidden",
          }}
        />
      )}
      {frameReady && cursor && <PlaybackBand {...cursor} />}
    </div>
  );
}

/**
 * The part's systems in reading order across its pages, and each note's
 * position in that order, so one cursor timeline runs through every page.
 */
function partCursorGeometry(pages: readonly (PageCursorGeometry | undefined)[]) {
  const systems: (CursorSystem & { page: number })[] = [];
  const targets = new Map<string, CursorTarget>();
  let measures = 0;
  pages.forEach((geometry, page) => {
    if (!geometry) {return;}
    const offset = systems.length;
    systems.push(...geometry.systems.map((system) => ({ ...system, page })));
    for (const [id, target] of geometry.targets) {
      targets.set(id, { ...target, system: offset + target.system, measure: target.measure === undefined ? undefined : measures + target.measure });
    }
    measures += geometry.measures;
  });
  return { systems, targets };
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

function PartPages({ part, partLabel = part.name, MidiPlayer, pinsProps, followPages = false }: {
  part: Pick<ScoreDisplayPart, "name" | "svgUrls" | "midiUrl" | "playback">;
  partLabel?: string;
  followPages?: boolean;
  MidiPlayer: Props["MidiPlayer"];
  pinsProps?: ScorePinsProps;
}) {
  const timingUrl = part.playback?.midiUrl ? part.playback.timingUrl : undefined;
  const [frames, setFrames] = useState<readonly PlaybackFrame[] | null | undefined>(timingUrl ? null : undefined);
  const [notes, setNotes] = useState<readonly string[]>([]);
  const [playbackMs, setPlaybackMs] = useState<number | null>(null);
  const [pageGeometry, setPageGeometry] = useState<readonly (PageCursorGeometry | undefined)[]>([]);
  const pageByNote = useRef(new Map<string, HTMLDivElement>());
  const followedPage = useRef<HTMLDivElement | null>(null);
  const registerPage = (index: number, doc: Document, page: HTMLDivElement) => {
    for (const note of doc.querySelectorAll("g.note[id]")) {
      pageByNote.current.set(note.id, page);
    }
    const geometry = measureCursorGeometry(doc);
    setPageGeometry((current) => {
      const next = [...current];
      next[index] = geometry;
      return next;
    });
  };
  const geometry = useMemo(() => partCursorGeometry(pageGeometry), [pageGeometry]);
  const anchors = useMemo(
    () => (frames ? cursorAnchors(frames, (id) => geometry.targets.get(id), geometry.systems) : []),
    [frames, geometry],
  );
  const cursor = playbackMs === null ? null : cursorAt(anchors, geometry.systems, playbackMs);
  const cursorSystem = cursor ? geometry.systems[cursor.system] : undefined;
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
            setPlaybackMs(seconds === null ? null : seconds * 1000);
            if (followPages && seconds !== null) {follow(active);}
            if (seconds === null) {followedPage.current = null;}
          } : undefined}
        />
      )}
      <div className="d-flex flex-column gap-2">
        {part.svgUrls.map((url, i) => (
          <SvgImage key={`${i}:${url}`} url={url} partName={part.name} partLabel={partLabel} page={i + 1}
            pinsProps={pinsProps} activeNotes={timingUrl ? notes : undefined}
            cursor={cursor && cursorSystem?.page === i ? { x: cursor.x, top: cursorSystem.top, bottom: cursorSystem.bottom } : undefined}
            onPageReady={timingUrl ? (doc, page) => registerPage(i, doc, page) : undefined} />
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
  const headingId = useId();
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
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Arranjo completo</Button>
      <Modal show={open} onHide={() => setOpen(false)} fullscreen scrollable aria-labelledby={headingId}>
        <Modal.Header closeButton closeLabel="Fechar arranjo">
          <Modal.Title id={headingId}>Arranjo completo</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
        </Modal.Body>
      </Modal>
    </>
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
  const orderedParts = [...parts].sort(comparePartsByInstrument);
  const part = orderedParts.find((candidate) => candidate.name === shownName) ?? orderedParts[0];
  const labels = partInstrumentLabels(parts);
  const partLabel = part ? labels.get(part) ?? "" : "";
  return (
    <>
      <Card className="mb-3">
        <Card.Body>
          <div className="row g-3 align-items-start">
            <div className="col-sm">
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
            </div>
            {(arrangement || arrangementMidiUrl) && (
              <div className="col-sm-auto d-flex justify-content-end">
                <ArrangementPanel arrangement={arrangement} midiUrl={arrangementMidiUrl ?? null} title={title} MidiPlayer={MidiPlayer} />
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {parts.length > 0 && (
        <Card className="mb-3">
          <Card.Body>
            <Card.Title>Partes</Card.Title>
            <PartTabs
              label="Partes"
              active={part?.name ?? ""}
              onChange={setShownName}
              tabs={orderedParts.map((part) => ({ key: part.name, label: labels.get(part) ?? "", note: part.midiUrl ? undefined : "⚠" }))}
            >
              {part && (
              <div className="mb-3">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong>{partLabel}</strong>
                  {!part.midiUrl && <Badge variant="danger">sem MIDI</Badge>}
                  {part.midiUrl && (
                    <a href={part.midiUrl} target="_blank" rel="noreferrer" aria-label={`Baixar MIDI de ${partLabel}`}>
                      <SiMidi />
                    </a>
                  )}
                  {part.warnings?.map((w, i) => (
                    <Badge variant="accent" key={i}>
                      {w}
                    </Badge>
                  ))}
                </div>
                <PartPages key={JSON.stringify([part.name, part.midiUrl, part.playback?.timingUrl])}
                  part={part} partLabel={partLabel} MidiPlayer={MidiPlayer} pinsProps={pinsProps} />
              </div>
              )}
            </PartTabs>
          </Card.Body>
        </Card>
      )}
    </>
  );
}
