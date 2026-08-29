import { createServer, type ServerResponse } from "node:http";
import { ReceiptImageClient } from "./receipt_image_client.js";
import { ReceiptService } from "./receipt_service.js";
import { ReceiptStore } from "./receipt_store.js";
import { receiptRequestSchema } from "./risk_policy.js";

const store = new ReceiptStore();
const service = new ReceiptService(new ReceiptImageClient(), store);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "POST" && url.pathname === "/payment-receipts") {
      const parsed = receiptRequestSchema.safeParse(await readJson(request));
      if (!parsed.success) return json(response, 400, { error: "invalid_request", issues: parsed.error.issues });
      const outcome = await service.handle(parsed.data);
      return json(response, outcome.status === "stored" ? 201 : 202, outcome);
    }

    const match = url.pathname.match(/^\/receipts\/([0-9a-f-]{36})\.png$/);
    if (request.method === "GET" && match) {
      const bytes = await store.readImage(match[1]);
      response.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
        "Content-Length": bytes.length
      });
      return response.end(bytes);
    }
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_failed";
    return json(response, 500, { error: message });
  }
}).listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () => {
  console.log("Receipt service listening on http://127.0.0.1:3000");
});

async function readJson(request: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
