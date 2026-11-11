import { Link, useLocation } from "react-router-dom";
export function NavigationResult({ back }: { back: string }) {
  const location = useLocation();
  return (
    <div className="alert alert-info">
      Navegação:{" "}
      <code>
        {location.pathname}
        {location.search}
      </code>{" "}
      · <Link to={back}>Voltar à história</Link>
    </div>
  );
}
