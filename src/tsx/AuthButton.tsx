import { Button } from "react-bootstrap";
import { useAuth } from "../auth";

interface AuthButtonProps {
  onOpenAuthModal: () => void;
}

export function AuthButton({ onOpenAuthModal }: AuthButtonProps) {
  const { currentUser, logout } = useAuth();

  if (currentUser) {
    return (
      <>
        <button
          type="button"
          className="btn btn-link p-0 d-flex align-items-center gap-2 text-light text-decoration-none"
          onClick={onOpenAuthModal}
        >
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="Avatar"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#888",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "#fff",
              }}
            >
              {(currentUser.displayName?.[0] ?? "?").toUpperCase()}
            </div>
          )}
          <span>{currentUser.displayName}</span>
        </button>
        <Button variant="outline-light" size="sm" onClick={() => void logout()}>
          Sair
        </Button>
      </>
    );
  }
  return (
    <Button
      variant="outline-light"
      size="sm"
      onClick={(_e) => onOpenAuthModal()}
    >
      Entrar
    </Button>
  );
}
