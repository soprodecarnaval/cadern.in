import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { buildExportDeepLink, type UploadContext } from "../../../../types/exportDeepLink";
import { EXPORTER_RELEASE } from "../../../lib/exporterRelease";
import { uploadPath } from "../../../lib/uploadPath";
import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { Page } from "../../atoms/Page";
import "./ExporterPage.css";

export interface ExporterPageViewProps {
  /** The upload to start in the Exportador: the project, and the score or
   *  songbook when it came from one. Without it (the footer's link), the
   *  page only offers the download. */
  context?: UploadContext;
  /** Puts the link on the clipboard (the browser's, outside stories). */
  copy: (text: string) => Promise<void>;
}

/**
 * /:slug/exportador — the desktop Exportador: download it, then open this
 * upload in it, or copy the link to open it by hand. /exportador: the
 * download only.
 */
export function ExporterPageView({ context, copy }: ExporterPageViewProps) {
  const link = context && buildExportDeepLink(context);
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  const handleCopy = async () => {
    if (!link) {return;}
    try {
      await copy(link);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <Page className="exporter-page">
      <h1>Exportador cadern.in</h1>
      <p className="exporter-intro">
        O programa para computador que envia partituras do MuseScore para os projetos do cadern.in.
      </p>

      <section aria-labelledby="exporter-download">
        <h2 id="exporter-download">Baixe o Exportador</h2>
        <p>
          Versão {EXPORTER_RELEASE.version}.{" "}
          <a href={EXPORTER_RELEASE.page} target="_blank" rel="noreferrer">
            Notas da versão e outros arquivos
          </a>
        </p>
        <ul className="exporter-downloads">
          {EXPORTER_RELEASE.downloads.map((download) => (
            <li key={download.system}>
              <a className="btn btn-outline-secondary ds-button" href={download.url}>
                Baixar para {download.system}
              </a>
              <span className="exporter-download-detail">{download.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {!context || !link ? (
        <p className="exporter-start">
          Para enviar uma partitura, abra o Exportador pela página de envio de um projeto.
        </p>
      ) : (
        <>
          <section aria-labelledby="exporter-open">
            <h2 id="exporter-open">Abra este envio no Exportador</h2>
            <p>
              Com o Exportador instalado, este botão abre o envio já no projeto
              {context.scoreId ? ", como nova versão da partitura" : ""}.
            </p>
            <div className="exporter-actions">
              <a className="btn btn-primary ds-button" href={link}>
                Abrir no Exportador
              </a>
            </div>
            <p className="exporter-copy-hint">
              Se o botão não abrir o programa, copie o link e cole no Exportador.
            </p>
            <div className="exporter-copy">
              <Input
                readOnly
                value={link}
                aria-label="Link do envio"
                onFocus={(event) => event.target.select()}
              />
              <Button variant="secondary" onClick={() => void handleCopy()}>
                Copiar link
              </Button>
            </div>
            <p className="exporter-copy-status" role="status">
              {copied === "yes" && "Link copiado."}
              {copied === "failed" && "Não foi possível copiar. Selecione o link e copie."}
            </p>
          </section>

          <p>
            <RouterLink to={uploadPath(context)}>Voltar ao envio pelo navegador</RouterLink>
          </p>
        </>
      )}
    </Page>
  );
}
