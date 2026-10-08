import { Container } from "react-bootstrap";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <Container className="mt-4">
      <h2>Página não encontrada</h2>
      <p>
        <Link to="/">Voltar para o início</Link>
      </p>
    </Container>
  );
}
