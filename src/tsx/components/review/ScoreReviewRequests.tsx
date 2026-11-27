import { useEffect, useState } from "react";
import { Button } from "../../atoms/Button";
import { Select } from "../../atoms/Select";
import { getProjectMembers } from "../../../lib/db";
import {
  changeScoreReviewRequest, listScoreReviewRequests, reviewOutcomes,
  type ReviewOutcome, type ScoreReviewRequest,
} from "../../../lib/scoreReviewRequests";

const outcomes: ReviewOutcome[] = ["approved", "changes-requested", "commented"];

export function ScoreReviewRequests({ projectId, scoreId, revisionId, uid, admin }: {
  projectId: string; scoreId: string; revisionId: string; uid: string; admin: boolean;
}) {
  const [members, setMembers] = useState<Awaited<ReturnType<typeof getProjectMembers>>>([]);
  const [requests, setRequests] = useState<ScoreReviewRequest[] | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const message = (err: unknown) =>
    err instanceof Error ? err.message : "Não foi possível atualizar as revisões.";

  useEffect(() => {
    let active = true;
    void Promise.all([getProjectMembers(projectId), listScoreReviewRequests(projectId, scoreId, revisionId)])
      .then(([people, reviews]) => {
        if (active) {
          setMembers(people);
          setRequests(reviews);
        }
      }, (err: unknown) => { if (active) { setError(message(err)); } });
    return () => { active = false; };
  }, [projectId, scoreId, revisionId, reload]);

  const run = async (action: Parameters<typeof changeScoreReviewRequest>[0]) => {
    setPending(true);
    setError("");
    try {
      await changeScoreReviewRequest(action);
      setReload((value) => value + 1);
    } catch (err) {
      setError(message(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mb-4" aria-label="Solicitações de revisão">
      <h3 className="h5">Solicitações de revisão</h3>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {requests === null && !error && <p role="status">Carregando revisões…</p>}
      {requests !== null && (
        <>
          <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={(event) => {
            event.preventDefault();
            if (!assigneeId || pending) { return; }
            void run({ action: "request", projectId, scoreId, revisionId, assigneeId });
          }}>
            <Select aria-label="Pessoa revisora" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              <option value="">Selecione uma pessoa</option>
              {members.filter((person) => person.uid !== uid).map((person) => (
                <option key={person.uid} value={person.uid} disabled={requests.some(
                  (request) => request.assigneeId === person.uid && request.status === "pending",
                )}>{person.displayName}</option>
              ))}
            </Select>
            <Button type="submit" disabled={!assigneeId || pending || requests.some(
              (request) => request.assigneeId === assigneeId && request.status === "pending",
            )}>Solicitar revisão</Button>
          </form>
          {requests.length === 0 && <p>Nenhuma solicitação nesta versão.</p>}
          <ul className="list-unstyled">
            {requests.map((request) => {
              const own = request.assigneeId === uid;
              const actions = request.status !== "pending" ? [] :
                own ? [...outcomes, "dismissed" as const] : admin ? ["dismissed" as const] : [];
              return (
                <li className="mb-2" key={request.id}>
                  {members.find((person) => person.uid === request.assigneeId)?.displayName ?? "Ex-integrante"}
                  {" — "}{request.status === "pending" ? "Pendente" : reviewOutcomes[request.status]}
                  {actions.length > 0 && (
                    <div className="d-flex flex-wrap gap-2">
                      {actions.map((status) => (
                        <Button key={status} size="sm" variant="secondary" disabled={pending}
                          onClick={() => void run({ action: "close", projectId, requestId: request.id, status })}>
                          {status === "dismissed" ? "Dispensar" : reviewOutcomes[status]}
                        </Button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
