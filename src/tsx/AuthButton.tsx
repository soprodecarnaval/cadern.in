import { Button } from "react-bootstrap";
import { useAuth } from "../auth";

interface AuthButtonProps {
  onOpenUserModal: () => void;
  inboxCount?: number;
}

export function AuthButton({ onOpenUserModal, inboxCount }: AuthButtonProps) {
  const { currentUser } = useAuth();

  if (currentUser) {
    return (
      <Button
        type="button"
        className="btn btn-link p-0 d-flex align-items-center gap-2 text-light text-decoration-none"
        onClick={(_e) => onOpenUserModal()}
        style={{ position: "relative" }}
      >
        <span style={{ position: "relative", display: "inline-flex" }}>
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
          {!!inboxCount && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "#dc3545",
                color: "#fff",
                borderRadius: "50%",
                width: 14,
                height: 14,
                fontSize: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
              }}
            >
              {inboxCount > 9 ? "9+" : inboxCount}
            </span>
          )}
        </span>
        <span>{currentUser.displayName}</span>
      </Button>
    );
  }
  return (
    <Button
      variant="outline-light"
      size="sm"
      onClick={(_e) => onOpenUserModal()}
    >
      Entrar
    </Button>
  );
}
