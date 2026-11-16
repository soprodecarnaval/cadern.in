import { forwardRef, type ComponentProps } from "react";
import "./Input.css";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function Input({ className = "", ...props }, ref) {
    return <input {...props} ref={ref} className={`form-control ds-field ${className}`} />;
  },
);
