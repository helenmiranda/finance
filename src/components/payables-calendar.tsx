"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type PayableCalendarEvent = { id: string; date: string; title: string; amountCents: number; kind: "payable" | "card"; status: "pending" | "paid" | "cancelled" | "card"; meta: string };
type Props = { selectedMonth: string; monthLabel: string; previousMonth: string; nextMonth: string; today: string; events: PayableCalendarEvent[] };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" });

export function PayablesCalendar({ selectedMonth, monthLabel, previousMonth, nextMonth, today, events }: Props) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const firstWeekday = new Date(`${selectedMonth}-01T12:00:00`).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedEvents = events.filter((event) => event.date === selectedDate);

  useEffect(() => {
    if (!selectedDate) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedDate(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [selectedDate]);

  return <>
    <section className="payables-calendar"><header><Link aria-label="Mês anterior" href={`/dashboard/contas-a-pagar?month=${previousMonth}`}>←</Link><div><p className="eyebrow">CALENDÁRIO</p><h2>{monthLabel}</h2></div><Link aria-label="Próximo mês" href={`/dashboard/contas-a-pagar?month=${nextMonth}`}>→</Link></header><div className="calendar-weekdays">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((weekday) => <span key={weekday}>{weekday}</span>)}</div><div className="calendar-grid">{days.map((day, index) => { if (!day) return <span className="calendar-day empty" key={`empty-${index}`} />; const dayDate = `${selectedMonth}-${String(day).padStart(2, "0")}`; const dayEvents = events.filter((event) => event.date === dayDate); return <button aria-label={`Abrir ${day} de ${monthLabel}${dayEvents.length ? `, ${dayEvents.length} compromissos` : ", sem compromissos"}`} className={`calendar-day ${dayDate === today ? "today" : ""} ${dayEvents.length ? "has-events" : ""}`} key={dayDate} onClick={() => setSelectedDate(dayDate)} type="button"><strong>{day}</strong><div>{dayEvents.slice(0, 2).map((event) => <span className={event.status === "card" ? "card-event" : event.status} key={event.id}>{event.title}<small>{money.format(event.amountCents / 100)}</small></span>)}{dayEvents.length > 2 && <small className="calendar-more">+{dayEvents.length - 2}</small>}</div>{dayEvents.length > 0 && <span className="calendar-mobile-count">{dayEvents.length}</span>}</button>; })}</div><div className="calendar-legend"><span><i className="pending" />Conta agendada</span><span><i className="paid" />Paga</span><span><i className="card-event" />Cartão</span></div></section>
    {selectedDate && <div className="calendar-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDate(null); }}><section aria-labelledby="calendar-modal-title" aria-modal="true" className="calendar-day-modal" role="dialog"><header><div><p className="eyebrow">AGENDA DO DIA</p><h2 id="calendar-modal-title">{fullDate.format(new Date(`${selectedDate}T12:00:00`))}</h2></div><button aria-label="Fechar" onClick={() => setSelectedDate(null)} type="button">×</button></header>{!selectedEvents.length ? <div className="calendar-modal-empty"><span>✓</span><strong>Nenhum compromisso</strong><p>Este dia está livre na agenda financeira.</p></div> : <div className="calendar-modal-events">{selectedEvents.map((event) => <article key={event.id}><span className={event.kind}>{event.kind === "card" ? "▣" : "↗"}</span><div><strong>{event.title}</strong><small>{event.meta}</small></div><strong>{money.format(event.amountCents / 100)}</strong></article>)}</div>}<button className="calendar-modal-close" onClick={() => setSelectedDate(null)} type="button">Fechar e ver agenda abaixo</button></section></div>}
  </>;
}
