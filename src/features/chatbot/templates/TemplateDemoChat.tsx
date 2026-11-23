"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { List, Reply, RotateCcw, Send } from "lucide-react";
import { Alert, Button, Spinner } from "@/components/ui";
import { chatbotTemplatesApi, templateError, type DemoChoice, type DemoInput, type DemoStep } from "./api";

type Line = { from: "bot" | "user"; text: string };

/** Simulated conversation with a template. The server stores nothing, so history lives here. */
export default function TemplateDemoChat({ templateId }: { templateId: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [step, setStep] = useState<DemoStep | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const run = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  const advance = useCallback(async (input: DemoInput, said?: string) => {
    const id = run.current;
    if (said) setLines(l => [...l, { from: "user", text: said }]);
    setBusy(true); setError(null);
    try {
      const next = await chatbotTemplatesApi.demo(templateId, input);
      if (id !== run.current) return;
      if (next.message) setLines(l => [...l, { from: "bot", text: next.message }]);
      setStep(next);
      setListOpen(false);
    } catch (err) {
      if (id === run.current) setError(templateError(err));
    } finally { if (id === run.current) setBusy(false); }
  }, [templateId]);

  const restart = useCallback(() => {
    run.current++;
    setLines([]); setStep(null); setAnswer(""); setError(null);
    void advance({});
  }, [advance]);

  useEffect(() => { restart(); return () => { run.current++; }; }, [restart]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, busy]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = answer.trim();
    if (!text || !step?.node_id || busy) return;
    setAnswer("");
    // Always reply to the node the server returned last.
    void advance({ node_id: step.node_id, answer: text }, text);
  };

  const captured = Object.entries(step?.captured ?? {});
  const choices = step && !step.completed ? step.choices : [];
  // Attach choices to the bot bubble only when it is the latest line in the chat.
  const lastBot = lines.length && lines[lines.length - 1].from === "bot" ? lines.length - 1 : -1;
  const choose = (choice: DemoChoice) => {
    if (step?.node_id) void advance({ node_id: step.node_id, choice_id: choice.id }, choice.label);
  };

  return (
    <div className="flex h-[65vh] min-h-[380px] flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2">
        <p className="text-xs text-muted-foreground">Demo only: no chatbot is created and no messages are sent.</p>
        <Button size="sm" variant="ghost" leftIcon={<RotateCcw size={14} />} onClick={restart} disabled={busy && !lines.length}>Restart</Button>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-chat-canvas p-4" aria-live="polite">
        {lines.map((line, i) => {
          // Reply buttons hang off the latest bot bubble, as in WhatsApp interactive messages.
          const showChoices = line.from === "bot" && i === lastBot && !busy && !!choices.length;
          return (
            <div key={i} className={`flex ${line.from === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${showChoices ? "w-72" : ""}`}>
                <div className={`whitespace-pre-wrap break-words px-3 py-2 text-sm text-foreground shadow-sm ${line.from === "user"
                  ? "rounded-2xl rounded-tr-sm bg-bubble-out"
                  : `rounded-2xl rounded-tl-sm bg-bubble-in ${showChoices ? "rounded-b-none" : ""}`}`}>
                  {line.text}
                </div>
                {showChoices && (choices.length <= 3 ? (
                  <div className="divide-y divide-border overflow-hidden rounded-b-2xl border-t border-border bg-bubble-in shadow-sm">
                    {choices.map(choice => (
                      <button key={choice.id} type="button" onClick={() => choose(choice)}
                        className="flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-info transition hover:bg-surface-hover">
                        <Reply size={14} />{choice.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-b-2xl border-t border-border bg-bubble-in shadow-sm">
                    <button type="button" onClick={() => setListOpen(o => !o)} aria-expanded={listOpen}
                      className="flex w-full items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-info transition hover:bg-surface-hover">
                      <List size={14} />{listOpen ? "Hide options" : "View options"}
                    </button>
                    {listOpen && (
                      <div className="divide-y divide-border border-t border-border">
                        {choices.map(choice => (
                          <button key={choice.id} type="button" onClick={() => choose(choice)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-foreground transition hover:bg-surface-hover">
                            <span className="truncate">{choice.label}</span>
                            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-border-strong" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {busy && <div className="flex justify-start"><Spinner size="sm" label="Bot is typing" /></div>}
        {error && <Alert variant="error" message={<div className="flex flex-wrap items-center gap-3"><span>{error}</span><Button size="sm" variant="outline" onClick={restart}>Restart demo</Button></div>} />}
        {/* Choices that arrive without a bot message still need to be answerable. */}
        {!busy && choices.length > 0 && lastBot < 0 && (
          <div className="flex flex-wrap justify-start gap-2 pt-1">
            {choices.map(choice => (
              <Button key={choice.id} size="sm" variant="outline" onClick={() => choose(choice)}>{choice.label}</Button>
            ))}
          </div>
        )}
        {step?.completed && (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
            <p className="font-medium text-foreground">Conversation complete</p>
            {captured.length > 0 && (
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                {captured.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                    <dd className="break-words text-foreground">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border bg-surface p-3">
        <input value={answer} onChange={e => setAnswer(e.target.value)} aria-label="Your answer"
          placeholder={step?.awaiting_answer ? "Type your answer…" : step?.completed ? "Demo finished. Restart to try again." : "Pick an option above"}
          disabled={!step?.awaiting_answer || busy || step.completed}
          className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60" />
        <Button type="submit" leftIcon={<Send size={14} />} disabled={!step?.awaiting_answer || !answer.trim() || busy}>Send</Button>
      </form>
    </div>
  );
}
