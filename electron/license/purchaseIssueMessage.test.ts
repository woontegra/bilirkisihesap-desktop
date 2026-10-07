import { describe, expect, it } from "vitest";
import { purchaseIssueFailureMessage } from "./purchaseIssueMessage";

describe("purchaseIssueFailureMessage", () => {
  it("shows the server message when purchase-token rejects the request", () => {
    expect(
      purchaseIssueFailureMessage({
        message: "Aktif deneme bulunamadı. Satın alma yalnız süren deneme cihazından açılır.",
        error: "Endpoint bulunamadı",
      }),
    ).toBe("Aktif deneme bulunamadı. Satın alma yalnız süren deneme cihazından açılır.");
  });

  it("shows the production 404 error field when message is absent", () => {
    expect(purchaseIssueFailureMessage({ error: "Endpoint bulunamadı" })).toBe("Endpoint bulunamadı");
  });

  it("keeps the generic fallback when the body has no safe text", () => {
    expect(purchaseIssueFailureMessage({})).toBe("Satın alma bağlantısı oluşturulamadı.");
    expect(purchaseIssueFailureMessage({ message: "  ", error: "  " })).toBe(
      "Satın alma bağlantısı oluşturulamadı.",
    );
  });
});
