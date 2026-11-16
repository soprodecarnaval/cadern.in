import { forwardRef, type ComponentProps } from "react";
import "./Input.css";

export const TextArea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
  function TextArea({ className = "", ...props }, ref) {
    return <textarea {...props} ref={ref} className={`form-control ds-field ds-textarea ${className}`} />;
  },
);
