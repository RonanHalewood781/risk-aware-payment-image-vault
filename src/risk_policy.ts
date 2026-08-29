import { z } from "zod";

export const receiptRequestSchema = z.object({
  paymentId: z.string().regex(/^pay_[A-Za-z0-9]{8,40}$/),
  event: z.enum(["authorized", "captured", "refunded"]),
  risk: z.enum(["low", "review", "high"]),
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  merchantLabel: z.string().trim().min(1).max(60)
}).strict();

export type ReceiptRequest = z.infer<typeof receiptRequestSchema>;

export type ReceiptDecision =
  | { approved: true; auditReason: "captured_low_risk" }
  | { approved: false; auditReason: "payment_not_captured" | "risk_review_required" };

export function decideReceipt(input: ReceiptRequest): ReceiptDecision {
  if (input.event !== "captured") {
    return { approved: false, auditReason: "payment_not_captured" };
  }
  if (input.risk !== "low") {
    return { approved: false, auditReason: "risk_review_required" };
  }
  return { approved: true, auditReason: "captured_low_risk" };
}
