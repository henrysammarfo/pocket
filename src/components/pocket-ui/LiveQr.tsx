import { useEffect, useState } from "react";
import QRCode from "qrcode";

type LiveQrProps = {
  value: string;
  size?: number;
  alt?: string;
};

/** Live QR for wallet address — center mark overlays the Figma spiral logo. */
export function LiveQr({ value, size = 245, alt = "Receive QR" }: LiveQrProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#123C32", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div className="bb-qr-frame bb-qr-loading" style={{ width: size, height: size }} aria-busy>
        <img src="/brand/logo.svg" alt="" width={48} height={48} />
      </div>
    );
  }

  return (
    <div className="bb-qr-frame" style={{ width: size, height: size }}>
      <img src={src} alt={alt} width={size} height={size} />
      <span className="bb-qr-mark" aria-hidden>
        <img src="/brand/logo.svg" alt="" width={44} height={44} />
      </span>
    </div>
  );
}
