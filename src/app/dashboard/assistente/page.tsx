import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedContext } from "@/lib/household";
import { AssistantChat } from "./assistant-chat";
import type { AssistantMessage } from "./actions";

export default async function AssistantPage() {
  const { supabase, membership, user } = await getAuthenticatedContext();
  const householdId = membership?.household_id;
  const { data: conversation } = householdId
    ? await supabase.from("ai_conversations").select("id").eq("household_id", householdId).eq("created_by", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const { data: messages } = conversation
    ? await supabase.from("ai_messages").select("role, content").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(20)
    : { data: [] };
  const initialMessages: AssistantMessage[] = (messages ?? []).map((message) => ({ role: message.role as "user" | "assistant", content: message.content }));

  return (
    <DashboardShell active="assistant">
      <section className="content assistant-page-content">
        <header><div><p className="eyebrow">ASSISTENTE FINANCEIRO</p><h1>Converse com seus dados.</h1><p className="muted">Pergunte, compare e encontre oportunidades de economia.</p></div></header>
        <AssistantChat initialState={{ conversationId: conversation?.id ?? null, messages: initialMessages, error: null }} />
      </section>
    </DashboardShell>
  );
}
