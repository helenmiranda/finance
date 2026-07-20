import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/202607200031_family_dreams.sql"), "utf8");
const coverMigration = readFileSync(join(root, "supabase/migrations/202607200032_dream_covers.sql"), "utf8");
const page = readFileSync(join(root, "src/app/dashboard/sonhos/page.tsx"), "utf8");

describe("sonhos familiares", () => {
  it("protege sonhos e aportes pelo tenant", () => {
    expect(migration).toContain("dreams_member_access");
    expect(migration).toContain("dream_contributions_member_access");
    expect(migration).toContain("public.is_household_member");
  });

  it("registra o aporte e atualiza o total de forma atômica", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("saved_cents = new_total");
    expect(migration).toContain("status = case when new_total >= target_cents then 'achieved'");
  });

  it("exibe propósito, ritmo e marcos positivos", () => {
    expect(page).toContain("why_text");
    expect(page).toContain("Ritmo sugerido");
    expect(page).toContain("const milestones = [10, 25, 50, 75, 100]");
    expect(page).toContain("Histórico de aportes");
    expect(page).toContain("contributionStreak");
  });

  it("permite ajustar planos e protege a remoção definitiva", () => {
    expect(page).toContain("Gerenciar sonho");
    expect(page).toContain("Pausar sonho");
    expect(page).toContain('name="confirmation"');
  });

  it("mantém capas privadas e isoladas pelo espaço familiar", () => {
    expect(coverMigration).toContain("'dream-covers'");
    expect(coverMigration).toContain("public = excluded.public");
    expect(coverMigration).toContain("public.is_household_member");
    expect(page).toContain("createSignedUrl");
  });
});
