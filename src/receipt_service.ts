import { createHash, randomUUID } from "node:crypto";
import { ReceiptImageClient } from "./receipt_image_client.js";
import { decideReceipt, type ReceiptRequest } from "./risk_policy.js";
import { ReceiptStore } from "./receipt_store.js";

export type ReceiptOutcome =
  | { status: "stored"; artifactId: string; imageUrl: string; auditReason: string; createdAt: string }
  | { status: "held"; auditReason: string };

export class ReceiptService {
  private readonly images: Pick<ReceiptImageClient, "generate">;
  private readonly store: ReceiptStore;

  constructor(
    images: Pick<ReceiptImageClient, "generate">,
    store: ReceiptStore
  ) {
    this.images = images;
    this.store = store;
  }

  async handle(input: ReceiptRequest): Promise<ReceiptOutcome> {
    const decision = decideReceipt(input);
    if (!decision.approved) return { status: "held", auditReason: decision.auditReason };

    const artifactId = randomUUID();
    const idempotencyKey = createHash("sha256")
      .update(`${input.paymentId}:captured-receipt:v1`)
      .digest("hex");
    const generated = await this.images.generate(input, idempotencyKey);
    const record = await this.store.save(artifactId, generated.bytes, {
      paymentId: input.paymentId,
      event: input.event,
      risk: input.risk,
      auditReason: decision.auditReason,
      imageSha256: createHash("sha256").update(generated.bytes).digest("hex")
    });
    return {
      status: "stored",
      artifactId,
      imageUrl: `/receipts/${artifactId}.png`,
      auditReason: decision.auditReason,
      createdAt: record.createdAt
    };
  }
}
