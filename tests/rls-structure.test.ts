import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");
const sql = readdirSync(migrationDirectory).filter((file) => file.endsWith(".sql")).sort().map((file) => readFileSync(join(migrationDirectory, file), "utf8")).join("\n").toLowerCase();

function hasRlsEnabled(table: string) {
  if (sql.includes(`alter table public.${table} enable row level security`)) return true;
  const dynamicBlocks = [...sql.matchAll(/foreach table_name in array array\[([\s\S]*?)\][\s\S]*?alter table public\.%i enable row level security/g)];
  return dynamicBlocks.some((match) => match[1].includes(`'${table}'`));
}

describe("estrutura multi-tenant", () => {
  it.each(["households", "accounts", "credit_cards", "transactions", "categories", "budgets", "pluggy_items", "investments", "ai_conversations", "ai_messages", "ai_recommendation_feedback"])("mantém RLS habilitado em %s", (table) => {
    expect(hasRlsEnabled(table)).toBe(true);
  });

  it("protege a substituição de categorias por associação familiar", () => {
    expect(sql).toContain("not public.is_household_member(source_category.household_id)");
    expect(sql).toContain("source_category.household_id <> target_category.household_id");
  });
});
