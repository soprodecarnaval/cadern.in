import { useState } from "react";
import { Modal, Button, Form, ListGroup } from "react-bootstrap";
import { ScoreViewModel, Part } from "../../types";

interface ScoreEditModalProps {
  show: boolean;
  score: ScoreViewModel;
  onHide: () => void;
  onSave: (updatedScore: ScoreViewModel) => void;
}

const ScoreEditModal = ({ show, score, onHide, onSave }: ScoreEditModalProps) => {
  const [title, setTitle] = useState(score.title);
  const [composer, setComposer] = useState(score.composer);
  const [sub, setSub] = useState(score.sub);
  const [tags, setTags] = useState(score.tags.join(", "));
  const [parts, setParts] = useState<Part[]>([...score.parts]);

  const handlePartNameChange = (index: number, name: string) => {
    setParts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name };
      return next;
    });
  };

  const handleSave = () => {
    const updatedScore: ScoreViewModel = {
      ...score,
      title,
      composer,
      sub,
      tags: tags.split(",").map((t) => t.trim()).filter((t) => t),
      parts,
    };
    onSave(updatedScore);
    onHide();
  };

  const handleCancel = () => {
    // Reset to original values
    setTitle(score.title);
    setComposer(score.composer);
    setSub(score.sub);
    setTags(score.tags.join(", "));
    setParts([...score.parts]);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleCancel} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Editar metadados</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Titulo</Form.Label>
            <Form.Control
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Projeto</Form.Label>
            <Form.Control
              type="text"
              value={score.projectTitle}
              disabled
              className="text-muted"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Compositor</Form.Label>
            <Form.Control
              type="text"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Subtitulo / Letra</Form.Label>
            <Form.Control
              type="text"
              value={sub}
              onChange={(e) => setSub(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Tags (separadas por virgula)</Form.Label>
            <Form.Control
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ex: funk, carnaval, rapido"
            />
          </Form.Group>

          <Form.Label>Partes ({parts.length})</Form.Label>
          <ListGroup className="mb-3">
            {parts.map((part, index) => (
              <ListGroup.Item key={index} className="d-flex gap-2 align-items-center">
                <Form.Control
                  type="text"
                  value={part.name}
                  onChange={(e) => handlePartNameChange(index, e.target.value)}
                  style={{ flex: 2 }}
                />
                <span className="text-muted" style={{ flex: 1 }}>
                  {part.instrument}
                </span>
              </ListGroup.Item>
            ))}
          </ListGroup>
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
