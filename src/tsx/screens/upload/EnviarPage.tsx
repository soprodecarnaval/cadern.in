import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../auth";
import * as db from "../../../lib/db";
import { loadScoreLibrary } from "../../../lib/scoreEngine";
import { uploadContextFromSearchParams } from "../../../lib/uploadFlow";
import { uploadScore } from "../../../lib/uploadScore";
import { MidiPlayer } from "../../components/audio/MidiPlayer";
import { EnviarPageView } from "./EnviarPageView";
import { useEnviarFlow } from "./useEnviarFlow";

const services = { ...db };
const components = { MidiPlayer };

/** /:slug/enviar — send a score: format it in the browser and upload it (ticket 012). */
export function EnviarPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const { currentUser } = useAuth();
  const context = useMemo(() => uploadContextFromSearchParams(slug, params), [slug, params]);
  const flow = useEnviarFlow({ context, user: currentUser, services, loadLibrary: loadScoreLibrary, upload: uploadScore });
  return (
    <EnviarPageView
      state={flow.state}
      context={context}
      signedIn={!!currentUser}
      components={components}
      onFile={(file) => void flow.chooseFile(file)}
      onStep={(step) => void flow.goTo(step)}
      onRows={flow.setRows}
      onProfile={flow.setProfile}
      onEditing={flow.setEditing}
      onListen={(ordinal) => void flow.listen(ordinal)}
      onSend={() => void flow.send()}
      onCancel={flow.cancel}
      onDismissError={flow.dismissError}
      onReset={flow.reset}
    />
  );
}
