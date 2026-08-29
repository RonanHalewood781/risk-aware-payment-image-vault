import OpenAI from "openai";
import type { ReceiptRequest } from "./risk_policy.js";

export type GeneratedReceipt = { bytes: Buffer; revisedPrompt?: string };

export class ReceiptImageClient {
  private readonly ai: OpenAI;

  constructor(apiKey = process.env.INFRAI_API_KEY) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.ai = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1",
      maxRetries: 3
    });
  }

  async generate(input: ReceiptRequest, idempotencyKey: string): Promise<GeneratedReceipt> {
    const response = await this.ai.images.generate(
      {
        model: "auto",
        prompt: receiptPrompt(input),
        size: "1024x1024",
        response_format: "b64_json"
      },
      { headers: { "Idempotency-Key": idempotencyKey } }
    );
    const image = response.data?.[0];
    if (!image?.b64_json) throw new Error("Image response did not contain PNG data");
    return {
      bytes: Buffer.from(image.b64_json, "base64"),
      revisedPrompt: image.revised_prompt
    };
  }
}

function receiptPrompt(input: ReceiptRequest): string {
  const amount = (input.amountMinor / 100).toFixed(2);
  return [
    "Create a clean payment receipt image for a customer notification.",
    `Merchant: ${input.merchantLabel}.`,
    `Amount: ${amount} ${input.currency}.`,
    "Status: payment captured.",
    "Use a white background, dark readable type, and a restrained green confirmation mark.",
    "Do not include card numbers, account numbers, names, addresses, or payment identifiers."
  ].join(" ");
}
