import type { User } from "firebase/auth";

import { LandingFooter, LandingHeader } from "../landing/LandingPageView";
import type { ProfileTab } from "../account/ProfileModalView";

import "../landing/LandingPage.css";
import "../articles/ArticlePage.css";
import "./ContributePage.css";

// Served as static files from /public, alongside the 2026 caderninhos.
const PIX_QR_CODE = "/2026/qrcode.png";
const SOPRO_LOGO = "/2026/soprodecarnaval.png";
const PIX_KEY = "soprodecarnaval@gmail.com";

/** How to contribute to the caderninhos: the PIX QR code and key. */
export function ContributePageView({
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
        <article className="article contribute">
          <header className="article-header">
            <h1 className="landing-section-title">Contribua!</h1>
            <p className="contribute-text">
              Ajude o cadern.in e o Sopro de Carnaval na produção dos
              caderninhos que vão trazer música para as ruas de BH!
            </p>
          </header>

          <section className="contribute-pix-section" aria-label="PIX">
            <div className="contribute-pix">
              <img
                src={PIX_QR_CODE}
                alt="QR Code PIX"
                className="contribute-pix-qr"
                width={218}
                height={217}
              />
              <div className="contribute-pix-key">
                <span className="contribute-pix-label">Chave PIX</span>
                <strong>{PIX_KEY}</strong>
                <span>(em nome de Alexandre Guido)</span>
              </div>
            </div>
          </section>

          <section className="contribute-credits" aria-label="Realização">
            <span className="contribute-pix-label">Realização</span>
            <img
              src={SOPRO_LOGO}
              alt="Sopro de Carnaval"
              className="contribute-logo"
              width={200}
              height={96}
            />
          </section>
        </article>
      </main>
      <LandingFooter
        currentUser={currentUser}
        collabEnabled={collabEnabled}
        onOpenUserModal={onOpenUserModal}
      />
    </div>
  );
}
