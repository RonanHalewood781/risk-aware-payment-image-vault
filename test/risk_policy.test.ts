import assert from "node:assert/strict";
import test from "node:test";
import { ReceiptService } from "../src/receipt_service.js";
import { ReceiptStore } from "../src/receipt_store.js";

test("a high-risk captured payment is held without generating an image", async () => {
  let generationCalls = 0;
  const images = {
    async generate() {
      generationCalls += 1;
      return { bytes: Buffer.from("unused") };
    }
  };
  const service = new ReceiptService(images, new ReceiptStore("/tmp/unused-receipt-store"));

  const outcome = await service.handle({
    paymentId: "pay_A1B2C3D4",
    event: "captured",
    risk: "high",
    amountMinor: 1299,
    currency: "USD",
    merchantLabel: "North Clinic Pharmacy"
  });

  assert.deepEqual(outcome, { status: "held", auditReason: "risk_review_required" });
  assert.equal(generationCalls, 0);
});
