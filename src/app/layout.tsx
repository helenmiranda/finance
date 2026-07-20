import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { NetworkStatus } from "@/components/network-status";
import { NavigationFeedback } from "@/components/navigation-feedback";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Poupemos", template: "%s · Poupemos" },
  description: "Painel financeiro familiar para organizar contas, cartões, metas e gastos.",
  applicationName: "Poupemos",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Poupemos" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icons/poupemos-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/poupemos-180.png", sizes: "180x180", type: "image/png" }] },
};

export const viewport: Viewport = { themeColor: "#f6f8f3", colorScheme: "light", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><NavigationFeedback /><NetworkStatus />{children}<PwaRegister /></body>
    </html>
  );
}
