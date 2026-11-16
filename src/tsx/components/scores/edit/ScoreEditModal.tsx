import { List } from "../../../atoms/List";
import { Modal } from "../../../atoms/Modal";
import { Input } from "../../../atoms/Input";
import { Button } from "../../../atoms/Button";
import { useState } from "react";
import { Form } from "react-bootstrap";
import type { ScoreViewModel, PartViewModel } from "../../../../../types/viewModels";

export type ScoreEditUpdate = {
  title: string;
  composer: string;
  sub: string;
  tags: string[];
  parts: Pick<PartViewModel, "name">[];
};

interface ScoreEditModalProps {
  show: boolean;
  score: ScoreViewModel;
  onHide: () => void;
  onSave: (update: ScoreEditUpdate) => void;
}

const ScoreEditModal = ({ show, score, onHide, onSave }: ScoreEditModalProps) => {
  const [title, setTitle] = useState(score.title);
  const [composer, setComposer] = useState(score.composer);
  const [sub, setSub] = useState(score.sub);
  const [tags, setTags] = useState(score.tags.join(", "));
  const [parts, setParts] = useState<PartViewModel[]>([...score.latestRevision.parts]);

  const handlePartNameChange = (index: number, name: string) => {
    setParts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
  };

  const handleSave = () => {
    onSave({
      title,
      composer,
      sub,
      tags: tags.split(",").map((t) => t.trim()).filter((t) => t),
      parts: parts.map((p) => ({ name: p.name })),
    });
    onHide();
  };

  const handleCancel = () => {
    setTitle(score.title);
    setComposer(score.composer);
    setSub(score.sub);
    setTags(score.tags.join(", "));
    setParts([...score.latestRevision.parts]);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleCancel} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Editar metadados</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3" controlId="score-edit-title">
            <Form.Label>Titulo</Form.Label>
            <Form.Control as={Input}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="score-edit-project">
            <Form.Label>Projeto</Form.Label>
            <Form.Control as={Input}
              type="text"
              value={score.projectTitle}
              disabled
              className="text-muted"
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="score-edit-composer">
            <Form.Label>Compositor</Form.Label>
            <Form.Control as={Input}
              type="text"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="score-edit-sub">
            <Form.Label>Subtitulo / Letra</Form.Label>
            <Form.Control as={Input}
              type="text"
              value={sub}
              onChange={(e) => setSub(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="score-edit-tags">
            <Form.Label>Tags (separadas por virgula)</Form.Label>
            <Form.Control as={Input}
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ex: funk, carnaval, rapido"
            />
          </Form.Group>

          <Form.Label>Partes ({parts.length})</Form.Label>
          <List className="mb-3">
            {parts.map((part, index) => (
              <List.Item key={index} className="d-flex gap-2 align-items-center">
                <Form.Control as={Input}
                  type="text"
                  aria-label={`Nome da parte ${index + 1}`}
                  value={part.name}
                  onChange={(e) => handlePartNameChange(index, e.target.value)}
                  style={{ flex: 2 }}
                />
                <span className="text-muted" style={{ flex: 1 }}>
                  {part.instrument}
                </span>
              </List.Item>
            ))}
          </List>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Salvar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export { ScoreEditModal };
