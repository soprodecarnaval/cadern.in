import type { ComponentProps } from "react";
import "./Page.css";

export function Page({ className = "", ...props }: ComponentProps<"main">) {
  return <main {...props} className={`container ds-page ${className}`} />;
}
