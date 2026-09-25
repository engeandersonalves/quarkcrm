"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cx } from "./ui";

/** QR Code em SVG (nítido na impressão). */
export function QR({ texto, className, cor = "#07002a" }: { texto: string; className?: string; cor?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let vivo = true;
    QRCode.toString(texto, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: cor, light: "#ffffff00" } })
      .then((s) => vivo && setSvg(s))
      .catch(() => vivo && setSvg(""));
    return () => {
      vivo = false;
    };
  }, [texto, cor]);
  return <div className={cx("aspect-square [&>svg]:h-full [&>svg]:w-full", className)} dangerouslySetInnerHTML={{ __html: svg }} />;
}
