import { forwardRef, type ComponentProps } from "react";
import "./Button.css";
import { buttonVariants } from "./buttonStyles";

export type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "text" | "danger" | "danger-secondary";
  size?: "sm" | "lg";
};


export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", type = "button", size, className = "", ...props }, ref) {
    return <button {...props} ref={ref} type={type} className={`btn btn-${buttonVariants[variant]} ds-button ${size ? `btn-${size}` : ""} ${className}`} />;
  },
);
