import { describe, expect, it } from "vitest";
import { cardBrandStyle } from "../src/lib/card-brand";

describe("cardBrandStyle", () => {
  it.each([
    [["Nu Pagamentos S.A."], "Nubank"],
    [["Meu cartão", "Banco Inter"], "Inter"],
    [["Ourocard Platinum"], "Banco do Brasil"],
    [["Cartão", "Itaú Unibanco"], "Itaú"],
  ])("reconhece %j como %s", (values, label) => {
    expect(cardBrandStyle(values).label).toBe(label);
  });

  it("preserva a cor personalizada quando a instituição é desconhecida", () => {
    expect(cardBrandStyle(["Banco Exemplo"], "#123456")).toMatchObject({ label: "Cartão", background: "#123456" });
  });
});
