"use client";

import { useActionState, useEffect, useRef } from "react";
import { askAssistant, type AssistantState } from "./actions";

const suggestions = [
  "Onde estamos gastando mais?",
  "Como reduzir os gastos neste mês?",
  "Estamos dentro dos orçamentos?",
];

export function AssistantChat({ initialState }: { initialState: AssistantState }) {
  const [state, formAction, pending] = useActionState(askAssistant, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pending, state]);

  return (
    <div className="assistant-chat">
      <section className="chat-messages" aria-live="polite">
        {!state.messages.length && <div className="chat-welcome"><span className="assistant-icon">✦</span><h2>Como posso ajudar hoje?</h2><p>Posso analisar gastos, orçamentos, faturas e metas usando os dados da família.</p><div className="suggestion-list">{suggestions.map((suggestion) => <span key={suggestion}>{suggestion}</span>)}</div></div>}
        {state.messages.map((message, index) => <article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "P" : "Você"}</span><p>{message.content}</p></article>)}
        {pending && <article className="chat-message assistant loading"><span>P</span><p>Analisando os dados da família…</p></article>}
        {state.error && <p className="form-message error" role="alert">{state.error}</p>}
        <div ref={endRef} />
      </section>
      <form action={formAction} className="chat-form" ref={formRef}>
        <input type="hidden" name="conversation_id" value={state.conversationId ?? ""} />
        <label htmlFor="assistant-question">Pergunte sobre suas finanças</label>
        <div><textarea id="assistant-question" name="question" rows={2} maxLength={800} placeholder="Ex.: quanto gastamos com alimentação nos últimos meses?" required disabled={pending} /><button type="submit" disabled={pending}>{pending ? "Analisando" : "Enviar"}</button></div>
        <small>O assistente oferece análises e sugestões, não aconselhamento financeiro profissional.</small>
      </form>
    </div>
  );
}
