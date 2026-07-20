import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { markAllNotificationsRead } from "./actions";
import { PushSettings } from "./push-settings";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function relatedTitle(value: { title: string } | { title: string }[] | null) {
  return Array.isArray(value) ? value[0]?.title : value?.title;
}

export default async function AlertsPage() {
  const { supabase, membership, user } = await getAuthenticatedContext();
  const householdId = membership?.household_id;
  const [{ data: notifications }, { data: reads }] = householdId ? await Promise.all([
    supabase.from("notifications").select("id, title, message, kind, severity, link_url, created_at, categories(name), dreams(title)").eq("household_id", householdId).order("created_at", { ascending: false }).limit(100),
    supabase.from("notification_reads").select("notification_id").eq("user_id", user.id),
  ]) : [{ data: [] }, { data: [] }];
  const readIds = new Set((reads ?? []).map((read) => read.notification_id));
  const unread = (notifications ?? []).filter((notification) => !readIds.has(notification.id)).length;

  return <DashboardShell active="alerts"><section className="content settings-content alerts-content">
    <header><div><p className="eyebrow">ACOMPANHAMENTO</p><h1>Alertas</h1><p className="muted">Limites, projeções e gastos fora do padrão em um só lugar.</p></div>{unread > 0 && <form action={markAllNotificationsRead}><button className="secondary-button" type="submit">Marcar todos como lidos</button></form>}</header>
    <section className="alert-summary"><span><strong>{unread}</strong> não lidos</span><span><strong>{notifications?.length ?? 0}</strong> avisos recentes</span></section>
    <article className="card push-card"><PushSettings publicKey={process.env.VAPID_PUBLIC_KEY} /></article>
    {!notifications?.length && <article className="card empty-state"><span>✓</span><h2>Tudo sob controle</h2><p className="muted">Os alertas aparecerão quando algum orçamento exigir atenção.</p><Link className="secondary-link" href="/dashboard/orcamentos">Configurar orçamentos →</Link></article>}
    <div className="alerts-list">{notifications?.map((notification) => <article className={`card alert-item ${notification.severity} ${readIds.has(notification.id) ? "read" : "unread"}`} key={notification.id}><span className="alert-dot" /><div><small>{relatedTitle(notification.dreams) ?? notification.categories?.[0]?.name ?? "Poupemos"} · {dateTime.format(new Date(notification.created_at))}</small><h2>{notification.title}</h2><p>{notification.message}</p></div>{notification.link_url && <Link href={notification.link_url}>{notification.kind === "dream_milestone" ? "Ver sonho" : "Ver detalhes"} →</Link>}</article>)}</div>
  </section></DashboardShell>;
}
