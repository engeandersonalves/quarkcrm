import { Inter } from "next/font/google";

/** Fonte da Apple (San Francisco) nos aparelhos Apple; Inter, a mais parecida, nos demais. */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export default function CaptureLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${inter.variable} ios-font`}>{children}</div>;
}
