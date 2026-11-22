import { Button } from "../../../atoms/Button";
import { useSvgUrl } from "../../../../lib/useSvgUrl";
import { PartTabs } from "../PartTabs";
import { useEffect, useState } from "react";
import { Badge, Card, Placeholder } from "react-bootstrap";
import { SiMidi } from "react-icons/si";
import type { CommentAnchor } from "../../../../../types/docs";

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
}: {
  url: string;
  partName: string;
  page: number;
  pinsProps?: ScorePinsProps;
}) {
  const [loaded, setLoaded] = useState(false);
  const shown = useSvgUrl(url);
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
      style={{
        position: "relative",
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
        src={shown}
        alt=""
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          border: "var(--ds-border) solid var(--ds-ink)",
          background: "var(--ds-paper)",
          display: loaded ? "block" : "none",
        }}
      />
    </div>
  );
}

export interface ScoreDisplayPart {
  name: string;
  instrument: string;
  svgUrls: string[];
  midiUrl: string | null;
  warnings?: string[];
}

interface Props {
  MidiPlayer: import("react").ComponentType<{ src: string }>;
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  arrangementMidiUrl?: string | null;
  parts: ScoreDisplayPart[];
  pinsProps?: ScorePinsProps;
}

export function ScoreDisplayView({
  MidiPlayer,
  title,
  composer,
  sub,
  tags,
  arrangementMidiUrl,
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

      {arrangementMidiUrl && (
        <Card className="mb-3">
          <Card.Body>
            <Card.Title>Arranjo completo</Card.Title>
            <MidiPlayer src={arrangementMidiUrl} />
          </Card.Body>
        </Card>
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
                {part.midiUrl && <MidiPlayer src={part.midiUrl} />}
                <div className="d-flex flex-column gap-2">
                  {part.svgUrls.map((url, i) => (
                    <SvgImage
                      key={i}
                      url={url}
                      partName={part.name}
                      page={i + 1}
                      pinsProps={pinsProps}
                    />
                  ))}
                </div>
              </div>
              )}
            </PartTabs>
          </Card.Body>
        </Card>
      )}
    </>
  );
}
