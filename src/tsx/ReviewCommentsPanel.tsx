import { useEffect, useRef, useState } from "react";
import { Badge, Button, CloseButton, Form, Spinner } from "react-bootstrap";
import type { User } from "firebase/auth";
import {
  addComment,
  editComment,
  softDeleteComment,
  type WithId,
} from "../lib/db";
import { displayNameOf } from "../lib/displayName";
import { type CommentThread } from "../lib/comments";
import type { CommentAnchor, ReviewCommentDoc } from "../../types/docs";

type Comment = WithId<ReviewCommentDoc>;

const formatDate = (c: Comment) =>
  c.createdAt?.toDate().toLocaleDateString("pt-BR") ?? "agora";

const anchorLabel = (a: CommentAnchor) => `${a.partName} · pág. ${a.page}`;

/**
 * Comments on one score version (collab-flow §5.4): a composer pinned at the
 * top — optionally pointing at a spot picked on the score — and every thread
 * below. Selecting a pin scrolls to its thread.
 */
export function ReviewCommentsPanel({
  scoreId,
  revisionId,
  user,
  threads,
  selectedId,
  picking,
  pendingAnchor,
  onStartPicking,
  onClearAnchor,
  onChanged,
}: {
  scoreId: string;
  revisionId: string;
  user: User;
  threads: CommentThread[];
  selectedId: string | null;
  picking: boolean;
  pendingAnchor: CommentAnchor | null;
  onStartPicking: () => void;
  onClearAnchor: () => void;
  onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (selectedId) {
      const el = refs.current.get(selectedId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
    }
  }, [selectedId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await addComment(scoreId, revisionId, {
        authorId: user.uid,
        authorName: displayNameOf(user),
        body: body.trim(),
        parentId: null,
        anchor: pendingAnchor,
      });
      setBody("");
      onClearAnchor();
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao comentar");
    } finally {
      setPending(false);
    }
  };

  const live = threads.reduce(
    (n, t) => n + (t.root.deletedAt ? 0 : 1) + t.replies.length,
    0,
  );

  return (
    <div>
      <h5>Comentários ({live})</h5>
      <Form onSubmit={(e) => void handleSubmit(e)} className="mb-3">
        <Form.Control
          as="textarea"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário sobre esta versão"
        />
        {pendingAnchor && (
          <div className="mt-1">
            <Badge bg="warning" text="dark" className="d-inline-flex gap-1">
              📍 {anchorLabel(pendingAnchor)}
              <CloseButton
                aria-label="Remover ponto"
                style={{ fontSize: 8 }}
                onClick={onClearAnchor}
              />
            </Badge>
          </div>
        )}
        <div className="d-flex justify-content-end gap-2 mt-2">
          <Button
            size="sm"
            variant={picking ? "warning" : "outline-secondary"}
            onClick={onStartPicking}
          >
            {picking ? "Clique na partitura…" : "📍 Marcar ponto"}
          </Button>
          <Button size="sm" type="submit" disabled={pending || !body.trim()}>
            {pending ? <Spinner animation="border" size="sm" /> : "Enviar"}
          </Button>
        </div>
        {error && <div className="text-danger small mt-1">{error}</div>}
      </Form>

      {threads.length === 0 && (
        <p className="text-muted small">Nenhum comentário nesta versão.</p>
      )}
      {threads.map((thread) => (
        <div
          key={thread.root.id}
          ref={(el) => {
            if (el) {
              refs.current.set(thread.root.id, el);
            } else {
              refs.current.delete(thread.root.id);
            }
          }}
          tabIndex={-1}
          className={`border rounded p-2 mb-2 ${
            selectedId === thread.root.id ? "border-danger border-2" : ""
          }`}
        >
          <CommentItem
            scoreId={scoreId}
            revisionId={revisionId}
            comment={thread.root}
            user={user}
            label={
              thread.pinNumber !== null && thread.root.anchor ? (
                <Badge bg="warning" text="dark">
                  {thread.pinNumber} · {anchorLabel(thread.root.anchor)}
                </Badge>
              ) : (
                <Badge bg="light" text="dark">
                  geral
                </Badge>
              )
            }
            onChanged={onChanged}
          />
          <div className="ms-3">
            {thread.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                scoreId={scoreId}
                revisionId={revisionId}
                comment={reply}
                user={user}
                onChanged={onChanged}
              />
            ))}
            <ReplyForm
              scoreId={scoreId}
              revisionId={revisionId}
              rootId={thread.root.id}
              user={user}
              onChanged={onChanged}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentItem({
  scoreId,
  revisionId,
  comment,
  user,
  label,
  onChanged,
}: {
  scoreId: string;
  revisionId: string;
  comment: Comment;
  user: User;
  label?: React.ReactNode;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const mine = comment.authorId === user.uid;

  if (comment.deletedAt) {
    return (
      <p className="text-muted fst-italic small mb-1">comentário removido</p>
    );
  }

  const handleSave = async () => {
    await editComment(scoreId, revisionId, comment.id, draft.trim());
    setEditing(false);
    onChanged();
  };

  const handleDelete = async () => {
    if (confirm("Excluir este comentário?")) {
      await softDeleteComment(scoreId, revisionId, comment.id);
      onChanged();
    }
  };

  return (
    <div className="mb-1">
      <div className="small text-muted d-flex gap-2 align-items-center">
        {label}
        <strong className="text-body">{comment.authorName}</strong>
        <span>{formatDate(comment)}</span>
        {mine && !editing && (
          <>
            <Button
              variant="link"
              size="sm"
              className="p-0"
              onClick={() => setEditing(true)}
            >
              editar
            </Button>
            <Button
              variant="link"
              size="sm"
              className="p-0 text-danger"
              onClick={() => void handleDelete()}
            >
              excluir
            </Button>
          </>
        )}
      </div>
      {editing ? (
        <div className="d-flex gap-1 mt-1">
          <Form.Control
            size="sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!draft.trim()}
            onClick={() => void handleSave()}
          >
            Salvar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraft(comment.body);
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
          {comment.body}
        </p>
      )}
    </div>
  );
}

function ReplyForm({
  scoreId,
  revisionId,
  rootId,
  user,
  onChanged,
}: {
  scoreId: string;
  revisionId: string;
  rootId: string;
  user: User;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");

  if (!open) {
    return (
      <Button
        variant="link"
        size="sm"
        className="p-0"
        onClick={() => setOpen(true)}
      >
        responder
      </Button>
    );
  }

  const handleReply = async () => {
    await addComment(scoreId, revisionId, {
      authorId: user.uid,
      authorName: displayNameOf(user),
      body: body.trim(),
      parentId: rootId,
      anchor: null,
    });
    setBody("");
    setOpen(false);
    onChanged();
  };

  return (
    <div className="d-flex gap-1 mt-1">
      <Form.Control
        size="sm"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Responder"
        autoFocus
      />
      <Button
        size="sm"
        disabled={!body.trim()}
        onClick={() => void handleReply()}
      >
        Enviar
      </Button>
    </div>
  );
}
