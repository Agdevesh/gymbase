import { randomBytes } from "node:crypto";

export const newReceiptToken = () => randomBytes(16).toString("hex");
export const receiptUrl = (base: string, token: string) => `${base}/r/${token}`;

export function receiptMessage(o: { gymName: string; memberName: string; number: string; paidPaise: number; duePaise: number; url: string; method?: string }) {
  const rs = (p: number) => `Rs ${(p / 100).toLocaleString("en-IN")}`;
  const lines = [`Hi ${o.memberName}, thanks for your payment of ${rs(o.paidPaise)}${o.method ? ` by ${o.method}` : ""} at ${o.gymName}.`, `Receipt ${o.number}: ${o.url}`];
  if (o.duePaise > 0) lines.push(`Balance due: ${rs(o.duePaise)}.`);
  return lines.join("\n");
}
