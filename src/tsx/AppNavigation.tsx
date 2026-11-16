import { Container, Nav, Navbar } from "react-bootstrap";
import { Link } from "react-router-dom";
import "../css/App.css";
import "../css/DesignPage.css";
import { AuthButtonView } from "./AuthButtonView";
export function AppNavigation({
  currentUser,
  collabEnabled,
  inboxCount,
  onOpenUserModal,
}: {
  currentUser: import("firebase/auth").User | null;
  collabEnabled: boolean;
  inboxCount: number;
  onOpenUserModal: () => void;
}) {
  return (
    <Navbar
      expand="lg"
      className="ds-navigation"
    >
      <Container>
        <Navbar.Brand as={Link} to="/" className="nav-bar-title fs-3">
          cadern.in
        </Navbar.Brand>
        <Nav className="me-3">
          <Nav.Link as={Link} to="/montar">
            Montar caderninho
          </Nav.Link>
        </Nav>
        <div className="banner-container">
          <a href="/2026" className="banner banner-yellow">
            Carnaval BH 2026
          </a>
          <a href="/plugin" className="banner banner-blue">
            Plugin de Musescore
          </a>
        </div>
        {collabEnabled && (
          <Nav className="ms-auto d-flex align-items-center gap-2">
            {currentUser && (
              <Nav.Link as={Link} to="/projects">
                Meus projetos
              </Nav.Link>
            )}
            <AuthButtonView
              currentUser={currentUser}
              onOpenUserModal={onOpenUserModal}
              inboxCount={inboxCount}
            />
          </Nav>
        )}
      </Container>
    </Navbar>
  );
}
