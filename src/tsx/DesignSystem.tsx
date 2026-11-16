import { forwardRef, type ComponentProps } from "react";
import { Modal as BootstrapModal } from "react-bootstrap";
import "../css/BrandModal.css";

export type DesignButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "text";
};

const variants = { primary: "primary", secondary: "outline-secondary", text: "link" };

export const DesignButton = forwardRef<HTMLButtonElement, DesignButtonProps>(
  function DesignButton({ variant = "primary", type = "button", className = "", ...props }, ref) {
    return <button {...props} ref={ref} type={type} className={`btn btn-${variants[variant]} ds-button ${className}`} />;
  },
);

export const DesignField = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function DesignField({ className = "", ...props }, ref) {
    return <input {...props} ref={ref} className={`form-control ds-field ${className}`} />;
  },
);

function ModalSurface({ className = "", ...props }: ComponentProps<typeof BootstrapModal>) {
  return <BootstrapModal {...props} className={`brand-modal ${className}`} />;
}

export const DesignModal = Object.assign(ModalSurface, {
  Header: BootstrapModal.Header,
  Title: BootstrapModal.Title,
  Body: BootstrapModal.Body,
  Footer: BootstrapModal.Footer,
});
