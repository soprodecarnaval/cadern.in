import "node:util";

// Native since Node 20.12; the pinned Node types predate this API.
declare module "node:util" {
  export function parseEnv(content: string): Record<string, string>;
}
