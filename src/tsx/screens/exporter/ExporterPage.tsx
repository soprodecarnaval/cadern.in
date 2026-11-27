import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { uploadContextFromSearchParams } from "../../../lib/uploadPath";
import { ExporterPageView } from "./ExporterPageView";

const copy = (text: string) => navigator.clipboard.writeText(text);

/** /:slug/exportador — download the Exportador and open this upload in it;
 *  /exportador — the download only. */
export function ExporterPage() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const context = useMemo(() => slug ? uploadContextFromSearchParams(slug, params) : undefined, [slug, params]);
  return <ExporterPageView context={context} copy={copy} />;
}
