import { useEffect, useId, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { createRoot } from "react-dom/client";

import { CircleAlert, X } from "lucide-react";



type DeleteOptions = {

  title: string;

  name: string;

  description: string;

  phrase: string;

  actionLabel?: string;

  warning?: string;

  onConfirm: () => unknown | Promise<unknown>;

};



export function DeleteConfirmation({ title, name, description, phrase, actionLabel = "Delete", warning = "This action cannot be undone.", onConfirm, onClose }: DeleteOptions & { onClose: () => void }) {

  const id = useId();

  const dialog = useRef<HTMLDialogElement>(null);

  const [typedName, setTypedName] = useState("");

  const [typedPhrase, setTypedPhrase] = useState("");

  const [touched, setTouched] = useState({ name: false, phrase: false });

  const [pending, setPending] = useState(false);

  const [error, setError] = useState("");

  const matchesName = typedName === name;

  const matchesPhrase = typedPhrase === phrase;

  useEffect(() => {

    const previous = document.activeElement;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const modal = dialog.current;

    if (modal?.showModal) modal.showModal(); else modal?.setAttribute("open", "");

    modal?.querySelector("input")?.focus();

    return () => {

      document.body.style.overflow = previousOverflow;

      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();

    };

  }, []);

  async function submit(event: React.FormEvent) {

    event.preventDefault();

    if (pending || !matchesName || !matchesPhrase) return;

    setPending(true); setError("");

    try { await onConfirm(); onClose(); }

    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to complete this action. Try again."); setPending(false); }

  }

  const inputClass = "mt-2 min-h-11 w-full rounded-md border bg-white px-3 py-2 text-xs text-[var(--fs-text)] outline-none focus:border-[var(--fs-primary)] focus:ring-2 focus:ring-blue-100 disabled:opacity-50";

  return createPortal(<dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(440px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[var(--fs-border)] bg-white p-0 text-[var(--fs-text)] shadow-2xl backdrop:bg-slate-950/40">

    <form onSubmit={submit} aria-busy={pending}>

      <header className="px-4 py-3"><div className="flex items-center justify-between gap-3"><h2 id={`${id}-title`} className="m-0 text-base font-semibold">{title}</h2><button type="button" aria-label="Close confirmation" disabled={pending} onClick={onClose} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-md text-[var(--fs-muted)] hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fs-primary)] disabled:cursor-not-allowed disabled:opacity-50"><X size={18} aria-hidden="true" /></button></div><p id={`${id}-description`} className="mb-0 mt-2 whitespace-pre-line text-xs leading-5 text-[var(--fs-muted)]">{description}</p></header>

      <div className="space-y-3 border-y border-[var(--fs-border)] bg-[var(--fs-canvas)] px-4 py-3">

        <div><label htmlFor={`${id}-name`} className="text-xs">To confirm, type <strong>“{name}”</strong></label><input id={`${id}-name`} autoComplete="off" spellCheck={false} value={typedName} disabled={pending} onChange={event => setTypedName(event.target.value)} onBlur={() => setTouched(value => ({ ...value, name: true }))} aria-invalid={touched.name && !matchesName} aria-describedby={touched.name && !matchesName ? `${id}-name-error` : undefined} className={`${inputClass} ${touched.name && !matchesName ? "border-red-500 ring-2 ring-red-500/20" : "border-[var(--fs-control-border)]"}`} />{touched.name && !matchesName && <p id={`${id}-name-error`} className="mb-0 mt-2 flex items-center gap-2 text-xs text-red-700"><CircleAlert size={14} aria-hidden="true" />Typing “{name}” exactly is required.</p>}</div>

        <div><label htmlFor={`${id}-phrase`} className="text-xs">To confirm, type <strong>“{phrase}”</strong></label><input id={`${id}-phrase`} autoComplete="off" spellCheck={false} value={typedPhrase} disabled={pending} onChange={event => setTypedPhrase(event.target.value)} onBlur={() => setTouched(value => ({ ...value, phrase: true }))} aria-invalid={touched.phrase && !matchesPhrase} aria-describedby={touched.phrase && !matchesPhrase ? `${id}-phrase-error` : undefined} className={`${inputClass} ${touched.phrase && !matchesPhrase ? "border-red-500 ring-2 ring-red-500/20" : "border-[var(--fs-control-border)]"}`} />{touched.phrase && !matchesPhrase && <p id={`${id}-phrase-error`} className="mb-0 mt-2 text-xs text-red-700">Typing “{phrase}” exactly is required.</p>}</div>

      </div>

      <div className="px-4 py-3"><p className="m-0 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"><CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{warning}</p>{error && <p role="alert" className="mb-0 mt-3 text-sm text-red-700">{error}</p>}</div>

      <footer className="flex items-center justify-between gap-3 border-t border-[var(--fs-border)] px-4 py-2"><button type="button" disabled={pending} onClick={onClose} className="min-h-8 rounded-md border border-[var(--fs-control-border)] px-2.5 py-1 text-[11px] font-medium bg-white hover:bg-slate-50 focus-visible:outline-[var(--fs-primary)] disabled:opacity-50">Cancel</button><button type="submit" disabled={pending || !matchesName || !matchesPhrase} className="min-h-8 rounded-md border border-red-700 bg-red-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-600 focus-visible:outline-[var(--fs-primary)] disabled:cursor-not-allowed disabled:border-[var(--fs-control-border)] disabled:bg-slate-100 disabled:text-slate-400">{pending ? "Please wait…" : actionLabel}</button></footer>

    </form>

  </dialog>, document.body);

}



/** Show the same confirmation from table and toolbar actions. */

export function confirmDeletion(options: DeleteOptions): Promise<void> {

  return new Promise(resolve => {

    const container = document.createElement("div");

    document.body.appendChild(container);

    const root = createRoot(container);

    const close = () => { setTimeout(() => { root.unmount(); container.remove(); resolve(); }, 0); };

    root.render(<DeleteConfirmation {...options} onClose={close} />);

  });

}

