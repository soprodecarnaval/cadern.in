import { FirebaseError } from "firebase/app";

/**
 * Firebase throws codes like `auth/invalid-credential`. The UI is pt-BR per
 * CONTRIBUTING.md, so translate rather than surfacing the raw code.
 */
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "E-mail inválido",
  "auth/invalid-credential": "E-mail ou senha incorretos",
  "auth/wrong-password": "E-mail ou senha incorretos",
  "auth/user-not-found": "E-mail ou senha incorretos",
  "auth/user-disabled": "Esta conta foi desativada",
  "auth/too-many-requests":
    "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed":
    "Sem conexão. Verifique sua internet e tente de novo.",
};

export function describeAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    // Wrong credentials and a missing account are reported identically, so a
    // stranger cannot use the form to discover which e-mails are registered.
    return MESSAGES[error.code] ?? `Não foi possível entrar (${error.code})`;
  }
  return "Não foi possível entrar";
}
