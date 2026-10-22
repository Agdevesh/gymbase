import QRCode from "qrcode";
import { paise } from "@/lib/payments";

// The QR and tap-to-pay button for one request. Server component: the SVG is rendered once.
export async function UpiQrPanel({ uri, amountPaise, code, upiId, size = 240 }: { uri: string; amountPaise: number; code: string; upiId: string; size?: number }) {
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1, width: size, errorCorrectionLevel: "M" });
  return (
    <div className="text-center">
      <div className="mx-auto" style={{ width: size }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="mt-2 text-3xl font-semibold">{paise(amountPaise)}</div>
      <p className="text-sm text-neutral-600">Scan with any UPI app. Amount is fixed; it cannot be changed.</p>
      <p className="mt-1 text-xs text-neutral-500">To {upiId} · ref <span className="font-mono">{code}</span></p>
      <a href={uri} className="mt-3 inline-flex rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Pay {paise(amountPaise)} in UPI app</a>
    </div>
  );
}
