import { forwardRef } from "react";
import { FormSelect, type FormSelectProps } from "react-bootstrap";
import "./Input.css";

export const Select = forwardRef<HTMLSelectElement, FormSelectProps>(
  function Select({ className = "", ...props }, ref) {
    return <FormSelect {...props} ref={ref} className={`ds-field ds-select ${className}`} />;
  },
);
