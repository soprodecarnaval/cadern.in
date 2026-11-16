import { forwardRef, type ComponentProps } from "react";
import { Modal as BootstrapModal } from "react-bootstrap";
import { Link as RouterLink } from "react-router-dom";
import "../css/DesignPage.css";
import "../css/BrandModal.css";

export type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "text" | "danger" | "danger-secondary";
  size?: "sm" | "lg";
};

const variants = { primary: "primary", secondary: "outline-secondary", text: "link", danger: "danger", "danger-secondary": "outline-danger" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", type = "button", size, className = "", ...props }, ref) {
    return <button {...props} ref={ref} type={type} className={`btn btn-${variants[variant]} ds-button ${size ? `btn-${size}` : ""} ${className}`} />;
  },
);

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function Input({ className = "", ...props }, ref) {
    return <input {...props} ref={ref} className={`form-control ds-field ${className}`} />;
  },
);

function ModalSurface({ className = "", ...props }: ComponentProps<typeof BootstrapModal>) {
  return <BootstrapModal {...props} className={`brand-modal ${className}`} />;
}

export const Modal = Object.assign(ModalSurface, {
  Header: BootstrapModal.Header,
  Title: BootstrapModal.Title,
  Body: BootstrapModal.Body,
  Footer: BootstrapModal.Footer,
});


export const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof RouterLink> & Pick<ButtonProps, "variant" | "size">>(
  function Link({ variant = "secondary", size, className = "", ...props }, ref) {
    return <RouterLink {...props} ref={ref} className={`btn btn-${variants[variant]} ds-button ${size ? `btn-${size}` : ""} ${className}`} />;
  },
);

export function Page({ className = "", ...props }: ComponentProps<"main">) {
  return <main {...props} className={`container ds-page ${className}`} />;
}
