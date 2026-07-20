import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("exclusão segura de dados", () => {
  it("exige responsável e nome exato para excluir um espaço", () => {
    const migration = source("supabase/migrations/202607200030_secure_data_deletion.sql");
    expect(migration).toContain("membership.role = 'owner'");
    expect(migration).toContain("trim(confirmation_name) <> target_name");
  });

  it("bloqueia a exclusão de responsável quando ainda existem membros", () => {
    expect(source("supabase/migrations/202607200030_secure_data_deletion.sql")).toContain("Transfira a responsabilidade");
  });

  it("revalida a senha e exige frase explícita para apagar a conta", () => {
    const route = source("src/app/api/privacy/delete/route.ts");
    expect(route).toContain("signInWithPassword");
    expect(route).toContain('body.confirmation !== "EXCLUIR MINHA CONTA"');
    expect(route).toContain("admin.auth.admin.deleteUser");
    expect(route).toContain('storage.from("dream-covers").remove');
  });
});
