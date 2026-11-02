import type { Migration, MigrationContext, SchemaDoc } from "./migration";
import { setVersion, setCleanedVersion } from "./migration";
import { migrationPlan } from "./migrationPlan";
import type { MigrationOptions } from "./migrationOptions";

interface Step {
  migration: Migration;
  operation: "up" | "down" | "cleanup";
  version: string | null;
}

function stepsFor(registry: Migration[], schema: SchemaDoc, options: MigrationOptions): Step[] {
  const ids = registry.map((migration) => migration.id);
  const plan = migrationPlan(ids, schema.version, options.targetId, options.forwardOnly);
  if (options.command !== "cleanup") {
    return plan.ids.map((id) => {
      const index = ids.indexOf(id);
      return {
        migration: registry[index], operation: plan.direction,
        version: plan.direction === "up" ? id : ids[index - 1] ?? null,
      };
    });
  }

  // Cleanup is bounded by applied history, including the explicitly selected target.
  migrationPlan(ids, schema.cleanedVersion, schema.cleanedVersion);
  const currentIndex = schema.version === null ? -1 : ids.indexOf(schema.version);
  const cleanedIndex = schema.cleanedVersion === null ? -1 : ids.indexOf(schema.cleanedVersion);
  const targetIndex = options.targetId === null ? currentIndex : ids.indexOf(options.targetId);
  if (targetIndex > currentIndex) throw new Error("Cleanup target has not been applied");
  return registry.slice(cleanedIndex + 1, targetIndex + 1)
    .filter((migration) => migration.cleanup)
    .map((migration) => ({ migration, operation: "cleanup", version: migration.id }));
}

export async function runMigrations(
  ctx: MigrationContext, registry: Migration[], schema: SchemaDoc, options: MigrationOptions,
): Promise<void> {
  if (ctx.dryRun !== !options.execute) throw new Error("Migration context disagrees with --execute");
  if (options.includeDataset && options.targetId === null) {
    throw new Error("--include-dataset requires an explicit --to <id>");
  }
  const steps = stepsFor(registry, schema, options);
  if (!steps.length) {
    console.log("Nothing to do.");
    return;
  }
  for (const { migration, operation } of steps) {
    console.log(`${operation} [${migration.kind ?? "schema"}] ${migration.id} — ${migration.description}`);
  }

  // Preflight the entire path before invoking even a schema step or checkpoint write.
  const datasets = steps.filter(({ migration }) => migration.kind === "dataset");
  if (!ctx.dryRun && datasets.length && !options.includeDataset) {
    throw new Error(
      `Dataset migrations require --include-dataset and an explicit --to <id>: ` +
      `${datasets.map(({ migration }) => migration.id).join(", ")}. No migrations executed.`,
    );
  }
  for (const { migration, operation, version } of steps) {
    console.log(`\n-> ${operation} [${migration.kind ?? "schema"}] ${migration.id}`);
    if (operation === "cleanup") {
      await migration.cleanup!(ctx);
      await setCleanedVersion(ctx.db, migration.id, ctx.dryRun);
    } else {
      await migration[operation](ctx);
      await setVersion(ctx.db, version, ctx.dryRun);
    }
  }
}
