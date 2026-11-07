export interface MigrationOptions {
  command: "migrate" | "cleanup";
  execute: boolean;
  forwardOnly: boolean;
  includeDataset: boolean;
  targetId: string | null;
}

export function parseMigrationOptions(args: string[]): MigrationOptions {
  const options: MigrationOptions = {
    command: args[0] === "cleanup" ? "cleanup" : "migrate",
    execute: false, forwardOnly: false, includeDataset: false, targetId: null,
  };
  const seen = new Set<string>();
  for (let i = options.command === "cleanup" ? 1 : 0; i < args.length; i++) {
    const arg = args[i];
    const flag = arg.startsWith("--to=") ? "--to" : arg;
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    switch (flag) {
      case "--execute": options.execute = true; break;
      case "--forward-only": options.forwardOnly = true; break;
      case "--include-dataset": options.includeDataset = true; break;
      case "--to": {
        const target = arg.startsWith("--to=") ? arg.slice(5) : args[++i];
        if (!target || target.startsWith("--")) throw new Error("--to requires a migration ID");
        options.targetId = target;
        break;
      }
      default: throw new Error(`Unknown migration option: ${arg}`);
    }
  }
  if (options.includeDataset && options.targetId === null) {
    throw new Error("--include-dataset requires an explicit --to <id>");
  }
  if (options.command === "cleanup" && options.forwardOnly) {
    throw new Error("--forward-only does not apply to cleanup");
  }
  return options;
}
