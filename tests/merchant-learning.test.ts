import { describe, expect, it } from "vitest";
import { learnableMerchantPatterns, merchantCandidate, normalizedMerchantText } from "../src/lib/merchant-learning";

describe("aprendizado de estabelecimentos", () => {
  it("normaliza acentos, pontuação e caixa", () => {
    expect(normalizedMerchantText("PÃO-DE-AÇÚCAR #123")).toBe("pao de acucar 123");
  });

  it("confia imediatamente em estabelecimentos conhecidos", () => {
    expect(merchantCandidate("COMPRA UBER *TRIP 9182")).toEqual({ pattern: "uber", trusted: true });
    expect(learnableMerchantPatterns(["UBER *TRIP"])).toEqual(["uber"]);
  });

  it("só generaliza um estabelecimento desconhecido quando o padrão se repete", () => {
    expect(learnableMerchantPatterns(["Compra Padaria Central 01"])).toEqual([]);
    expect(learnableMerchantPatterns(["Compra Padaria Central 01", "PIX PADARIA CENTRAL 02"])).toEqual(["padaria central"]);
  });
});
