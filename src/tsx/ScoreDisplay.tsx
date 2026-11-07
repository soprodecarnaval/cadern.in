import { useState } from "react";
import { Badge, Card, Placeholder } from "react-bootstrap";
import type { CommentAnchor } from "../../types/docs";
import { MidiPlayer } from "./MidiPlayer";

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
          <button
            key={pin.id}
            type="button"
            title={`Comentário ${pin.number}`}
            onClick={(e) => {
              e.stopPropagation();
              pinsProps?.onPinClick(pin.id);
            }}
            className={`btn btn-sm rounded-circle p-0 ${
              pinsProps?.selectedPinId === pin.id ? "btn-danger" : "btn-warning"
            }`}
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
          </button>
        ))}
      {!loaded && (
        <Placeholder animation="glow">
          <Placeholder
            style={{ width: "100%", height: 200, display: "block" }}
          />
        </Placeholder>
      )}
      <img
        src={url}
        alt=""
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          border: "1px solid #dee2e6",
          background: "#fff",
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
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  arrangementMidiUrl?: string | null;
  parts: ScoreDisplayPart[];
  pinsProps?: ScorePinsProps;
}

export function ScoreDisplay({
  title,
  composer,
  sub,
  tags,
  arrangementMidiUrl,
  parts,
  pinsProps,
}: Props) {
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
            {parts.map((part) => (
              <div key={part.name} className="mb-3">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong>{part.name}</strong>
                  <span className="text-muted">— {part.instrument}</span>
                  {!part.midiUrl && <Badge bg="danger">sem MIDI</Badge>}
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
            ))}
          </Card.Body>
        </Card>
      )}
    </>
  );
}
