import { forwardRef, type ComponentProps } from "react";
import { Link as RouterLink } from "react-router-dom";
import type { ButtonProps } from "./Button";
import { buttonVariants } from "./buttonStyles";
import "./Button.css";

export const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof RouterLink> & Pick<ButtonProps, "variant" | "size">>(
  function Link({ variant = "secondary", size, className = "", ...props }, ref) {
    return <RouterLink {...props} ref={ref} className={`btn btn-${buttonVariants[variant]} ds-button ${size ? `btn-${size}` : ""} ${className}`} />;
  },
);
