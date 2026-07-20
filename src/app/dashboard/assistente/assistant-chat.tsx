"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { askAssistant, setRecommendationFeedback, type AssistantState } from "./actions";

const suggestions = [
  "Onde estamos gastando mais?",
  "Como reduzir os gastos neste mês?",
  "Estamos dentro dos orçamentos?",
];

function RecommendationFeedback({ messageId, initial }: { messageId: string; initial: "accepted" | "discarded" | null | undefined }) {
  const [status, setStatus] = useState(initial ?? null);
  return <form className="recommendation-feedback" action={setRecommendationFeedback} onSubmit={(event) => {
    const value = (event.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement
      ? (event.nativeEvent as SubmitEvent).submitter?.value as "accepted" | "discarded"
      : null;
    if (value) setStatus(value);
  }}><input type="hidden" name="message_id" value={messageId} /><small>{status === "accepted" ? "Recomendação aceita pela família" : status === "discarded" ? "Recomendação descartada pela família" : "Esta recomendação foi útil?"}</small><div><button className={status === "accepted" ? "selected" : ""} name="status" value="accepted" type="submit">✓ Aceitar</button><button className={status === "discarded" ? "selected discarded" : ""} name="status" value="discarded" type="submit">× Descartar</button></div></form>;
}

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
        {state.messages.map((message, index) => <article className={`chat-message ${message.role}`} key={message.id ?? `${message.role}-${index}`}><span>{message.role === "assistant" ? "P" : "Você"}</span><div className="chat-message-body"><p>{message.content}</p>{message.role === "assistant" && message.id && <RecommendationFeedback messageId={message.id} initial={message.feedback} />}</div></article>)}
        {pending && <article className="chat-message assistant loading"><span>P</span><div className="chat-message-body"><p>Analisando os dados da família…</p></div></article>}
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
