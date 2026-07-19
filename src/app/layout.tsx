import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Poupemos",
  description: "O painel financeiro familiar de Helen e Ramon",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
