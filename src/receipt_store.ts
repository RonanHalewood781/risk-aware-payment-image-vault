import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ReceiptRecord = {
  artifactId: string;
  imagePath: string;
  auditPath: string;
  createdAt: string;
};

export class ReceiptStore {
  private readonly root: string;

  constructor(root = process.env.RECEIPT_STORE_DIR ?? "./private-receipts") {
    this.root = root;
  }

  async save(artifactId: string, bytes: Buffer, audit: object): Promise<ReceiptRecord> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const imagePath = join(this.root, `${artifactId}.png`);
    const auditPath = join(this.root, `${artifactId}.audit.json`);
    const createdAt = new Date().toISOString();
    await writeFile(imagePath, bytes, { mode: 0o600, flag: "wx" });
    await writeFile(auditPath, JSON.stringify({ ...audit, artifactId, createdAt }, null, 2), {
      mode: 0o600,
      flag: "wx"
    });
    return { artifactId, imagePath, auditPath, createdAt };
  }

  readImage(artifactId: string): Promise<Buffer> {
    return readFile(join(this.root, `${artifactId}.png`));
  }
}
