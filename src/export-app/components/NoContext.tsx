import { useState, type FormEvent } from "react";
import { Button } from "../../tsx/atoms/Button";
import { Input } from "../../tsx/atoms/Input";
import {
  parseExportDeepLink,
  type ExportDeepLinkContext,
} from "../../../types/exportDeepLink";

export function NoContext({
  onContext,
  onLogout,
}: {
  onContext: (context: ExportDeepLinkContext) => void;
  onLogout: () => void;
}) {
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const context = parseExportDeepLink(link.trim());
    if (!context) {
      setError(
        "Link inválido ou incompleto. Copie o endereço do botão no site do cadern.in. O link deve começar com cadernin-export://.",
      );
      return;
    }
    onContext(context);
  };

  return (
    <form className="login-form" onSubmit={submit}>
      <h2>Nenhum destino selecionado</h2>
      <p>
        Abra o Exportador a partir da página de um projeto ou de uma
        partitura em um caderninho no site do cadern.in — o link abre este
        app já sabendo para onde enviar.
      </p>
      <label htmlFor="export-link">O link não abriu o app? Cole-o aqui</label>
      <Input
        id="export-link"
        type="text"
        value={link}
        placeholder="cadernin-export://upload?projectId=…"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby={`export-link-hint${error ? " export-link-error" : ""}`}
        onChange={(event) => {
          setLink(event.target.value);
          setError("");
        }}
      />
      <small id="export-link-hint">
        No site, clique com o botão direito em “Enviar partitura” ou “Enviar
        nova versão” e escolha “Copiar endereço do link”.
      </small>
      {error && (
        <div
          id="export-link-error"
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}
      <Button type="submit" disabled={!link.trim()}>
        Continuar
      </Button>
      <Button variant="text" onClick={onLogout}>
        Usar outra conta
      </Button>
    </form>
  );
}
