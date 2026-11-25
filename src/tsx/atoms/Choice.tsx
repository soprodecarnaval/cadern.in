import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import "./Choice.css";

type ChoiceProps = Omit<ComponentProps<"input">, "type"> & {
  /**
   * The text beside the box; clicking it toggles the box. Leave it out only
   * where something else labels the box (a row that toggles it), and give
   * the box an `aria-label` instead.
   */
  label?: ReactNode;
};
// Inline by default; `className="is-block"` puts one on its own line.

/** A checkbox with its label. `indeterminate` shows a dash, for "some". */
export const Checkbox = forwardRef<
  HTMLInputElement,
  ChoiceProps & { indeterminate?: boolean }
>(function Checkbox({ label, indeterminate = false, className = "", ...props }, ref) {
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => input.current as HTMLInputElement);
  // Only settable from script: there is no HTML attribute for it.
  useEffect(() => {
    if (input.current) {
      input.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  const box = <input {...props} ref={input} type="checkbox" className={`ds-check-input ${label === undefined ? className : ""}`} />;
  return label === undefined ? box : (
    <label className={`ds-check ${className}`}>
      {box}
      <span>{label}</span>
    </label>
  );
});

/** A radio with its label. Give every radio of a set the same `name`. */
export const Radio = forwardRef<HTMLInputElement, ChoiceProps>(function Radio(
  { label, className = "", ...props },
  ref,
) {
  const box = <input {...props} ref={ref} type="radio" className={`ds-check-input ${label === undefined ? className : ""}`} />;
  return label === undefined ? box : (
    <label className={`ds-check ${className}`}>
      {box}
      <span>{label}</span>
    </label>
  );
});

/**
 * Checkboxes or radios under a title (a fieldset and its legend), stacked or
 * `inline`, with an optional hint or error below the title.
 */
export function ChoiceGroup({
  legend,
  hint,
  error,
  inline = false,
  className = "",
  children,
  ...props
}: Omit<ComponentProps<"fieldset">, "children"> & {
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  inline?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      {...props}
      className={`ds-choice-group ${inline ? "is-inline" : ""} ${className}`}
    >
      <legend>{legend}</legend>
      {hint && <p className="ds-choice-hint">{hint}</p>}
      {children}
      {error && <p className="invalid-feedback" role="alert">{error}</p>}
    </fieldset>
  );
}
