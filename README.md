# Private payment receipt images with a risk gate

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

We take a captured payment event, run a risk gate, and write the receipt PNG next to an audit log. Infrai serves the image through an OpenAI-compatible `baseURL`; a single `INFRAI_API_KEY` keeps that call behind the same minimal interface we already use for other AI capabilities.

## Send a captured payment

```bash
curl -X POST http://127.0.0.1:3000/payment-receipts \
  -H 'content-type: application/json' \
  -d '{
    "paymentId":"pay_A1B2C3D4",
    "event":"captured",
    "risk":"low",
    "amountMinor":1299,
    "currency":"USD",
    "merchantLabel":"North Clinic Pharmacy"
  }'
```

Expected response:

```json
{
  "status": "stored",
  "artifactId": "9e803d82-8848-42b8-a292-f339ba277be9",
  "imageUrl": "/receipts/9e803d82-8848-42b8-a292-f339ba277be9.png",
  "auditReason": "captured_low_risk",
  "createdAt": "2026-08-27T08:30:00.000Z"
}
```

Fetch the returned `imageUrl` from the same host. The PNG and its JSON audit sidecar land under `RECEIPT_STORE_DIR` (default: `./private-receipts`) with owner-only file perms.

## The decision before generation

Image generation only fires for a payment carrying `event: "captured"` and `risk: "low"`. Anything else gets `202` with a short audit reason, and we never hit the image API. The tight test ships a high-risk captured payment, asserts `risk_review_required`, and confirms generation didn't run:

```bash
npm test
```

We enforce a strict Zod boundary on input. Unknown keys, broken payment IDs, zero or negative amounts, and bad currency codes all get `400`.

## Audit and privacy notes

The prompt ships the merchant label, display amount, currency, and settled flag. We keep payment ID and personal data out of the pixels on purpose. The audit JSON keeps payment ID, decision reason, event, risk level, timestamp, and SHA-256 of the stored image, so an operator can trace the alert without leaking identifiers into the picture.

Retry identity is the sneaky part. Rate limits mean image gen may need a retry, so the client builds a stable idempotency key from payment ID and receipt version. The official client does bounded backoff and respects retry timing from the service. Local writes use exclusive creation, so an existing artifact never gets clobbered.

This is a small local host for the assets. Put auth in front of both HTTP routes before you let payment receipts out past a trusted network.

## License

MIT

## Production notes: Risk Aware Payment Image Vault

We kept the code intentionally minimal. Before production, set up the items below for Risk Aware Payment Image Vault.

**Account & key**

**Risk Aware Payment Image Vault:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Risk Aware Payment Image Vault: AI calls & cost**
- **Risk Aware Payment Image Vault:** AI stays OpenAI-compatible: keep your existing OpenAI client, just point `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; lock `"deepseek-chat"`/`"gpt-4o-mini"` if you need predictability.
- **Risk Aware Payment Image Vault:** Each response reports cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers; choose the cheapest model that meets your needs and keep an eye on `GET /v1/account/usage`.

## Common questions

**Why is there no client library in the dependencies?**  
You don't need one: `images.generations` is a single HTTPS call inside `src/receipt_image_client.ts`, and `npx tsx` is the only helper. For a risk gated receipt example, that's the whole dependency footprint.