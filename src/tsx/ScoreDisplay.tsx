import { Badge, Card } from "react-bootstrap";

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
  parts: ScoreDisplayPart[];
}

export function ScoreDisplay({ title, composer, sub, tags, parts }: Props) {
  return (
    <>
      <Card className="mb-3">
        <Card.Body>
          <p><strong>Título:</strong> {title || <em>não detectado</em>}</p>
          <p><strong>Compositor:</strong> {composer || <em>não detectado</em>}</p>
          <p><strong>Sub:</strong> {sub || <em>não detectado</em>}</p>
          <p className="mb-0">
            <strong>Tags:</strong>{" "}
            {tags.length > 0 ? tags.join(", ") : <em>nenhuma</em>}
          </p>
        </Card.Body>
      </Card>

      {parts.length > 0 && (
        <Card className="mb-3">
          <Card.Body>
            <Card.Title>Partes</Card.Title>
            {parts.map((part) => (
              <div key={part.name} className="mb-3">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong>{part.name}</strong>
                  <span className="text-muted">— {part.instrument}</span>
                  {part.midiUrl ? (
                    <Badge bg="secondary">MIDI</Badge>
                  ) : (
                    <Badge bg="danger">sem MIDI</Badge>
                  )}
                  {part.warnings?.map((w, i) => (
                    <Badge bg="warning" text="dark" key={i}>{w}</Badge>
                  ))}
                </div>
                <div className="d-flex flex-column gap-2">
                  {part.svgUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      style={{ width: "100%", border: "1px solid #dee2e6", background: "#fff" }}
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
