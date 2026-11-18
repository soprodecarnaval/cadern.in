import type { User } from "firebase/auth";
import type { FormEvent } from "react";

import { Button } from "../../atoms/Button";
import { Input } from "../../atoms/Input";
import { TextArea } from "../../atoms/TextArea";
import { LandingFooter, LandingHeader } from "../landing/LandingPageView";
import type { ProfileTab } from "../account/ProfileModalView";

// A stand-in photo until the page has its own.
import caderninhos from "../../../assets/about/caderninhos-2026.webp";

import "../landing/LandingPage.css";
import "./AboutPage.css";

// There is no backend for messages: the form opens the visitor's email app
// with the message addressed here.
const CONTACT_EMAIL = "soprodecarnaval@gmail.com";

/** Who makes cadern.in, with a contact form. The copy is a placeholder. */
export function AboutPageView({
  currentUser,
  collabEnabled,
  inboxCount,
  onOpenUserModal,
  onSignOut,
}: {
  currentUser: User | null;
  collabEnabled: boolean;
  inboxCount: number;
  onOpenUserModal: (tab?: ProfileTab) => void;
  onSignOut: () => void;
}) {
  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "").trim();
    const name = [field("firstName"), field("lastName")].filter(Boolean).join(" ");
    const subject = `Contato pelo cadern.in${name ? ` · ${name}` : ""}`;
    const body = `${field("message")}\n\n${name}\n${field("email")}`.trim();
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="landing">
      <LandingHeader
        currentUser={currentUser}
        collabEnabled={collabEnabled}
        inboxCount={inboxCount}
        onOpenUserModal={onOpenUserModal}
        onSignOut={onSignOut}
      />
      <main className="landing-main">
        <div className="about">
          <div className="about-text">
            <h1 className="about-headline">
              Uma frase de título maior para apresentar o projeto
            </h1>
            <p>
              Texto do corpo da página. Colocamos um texto de exemplo para
              mostrar como a página fica preenchida:
            </p>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>

            <section className="about-contact" aria-labelledby="fale-conosco">
              <h2 id="fale-conosco" className="landing-section-title">
                Fale conosco
              </h2>
              <form className="about-form" onSubmit={sendMessage}>
                <label className="about-field">
                  <span>Nome</span>
                  <Input name="firstName" autoComplete="given-name" placeholder="Maria" />
                </label>
                <label className="about-field">
                  <span>Sobrenome</span>
                  <Input name="lastName" autoComplete="family-name" placeholder="da Silva" />
                </label>
                <label className="about-field about-field-wide">
                  <span>E-mail</span>
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                  />
                </label>
                <label className="about-field about-field-wide">
                  <span>Mensagem</span>
                  <TextArea
                    name="message"
                    rows={6}
                    required
                    placeholder="Escreva sua pergunta ou mensagem"
                  />
                </label>
                <Button type="submit" className="about-field-wide about-submit">
                  Enviar
                </Button>
              </form>
            </section>
          </div>

          <img
            src={caderninhos}
            alt="Caderninhos 2026 de trombone, presos com elástico, numa caixa"
            className="about-image"
            width={949}
            height={1265}
          />
        </div>
      </main>
      <LandingFooter
        currentUser={currentUser}
        collabEnabled={collabEnabled}
        onOpenUserModal={onOpenUserModal}
      />
    </div>
  );
}
