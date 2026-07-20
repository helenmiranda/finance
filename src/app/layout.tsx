import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { NetworkStatus } from "@/components/network-status";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { PwaSplash } from "@/components/pwa-splash";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Poupemos", template: "%s · Poupemos" },
  description: "Painel financeiro familiar para organizar contas, cartões, metas e gastos.",
  applicationName: "Poupemos",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true, statusBarStyle: "black-translucent", title: "Poupemos",
    startupImage: [
      { url: "/splash/poupemos-1290x2796.jpg", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/poupemos-1179x2556.jpg", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/poupemos-1170x2532.jpg", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/poupemos-1125x2436.jpg", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/poupemos-828x1792.jpg", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" },
      { url: "/splash/poupemos-750x1334.jpg", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" },
    ],
  },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icons/poupemos-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/poupemos-180.png", sizes: "180x180", type: "image/png" }] },
};

export const viewport: Viewport = { themeColor: "#163300", colorScheme: "light", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><PwaSplash /><NavigationFeedback /><NetworkStatus />{children}<PwaRegister /></body>
    </html>
  );
}
