import { PluggyAutoCheck } from "@/components/pluggy-auto-check";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <><PluggyAutoCheck />{children}</>;
}
