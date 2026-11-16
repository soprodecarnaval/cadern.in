import type { ComponentProps } from "react";
import { Modal as BootstrapModal } from "react-bootstrap";
import "./Modal.css";

function ModalSurface({ className = "", ...props }: ComponentProps<typeof BootstrapModal>) {
  return <BootstrapModal {...props} className={`brand-modal ${className}`} />;
}

export const Modal = Object.assign(ModalSurface, {
  Header: BootstrapModal.Header,
  Title: BootstrapModal.Title,
  Body: BootstrapModal.Body,
  Footer: BootstrapModal.Footer,
});
