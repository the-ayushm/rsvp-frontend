"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Code } from "lucide-react";

interface ComingSoonProps {
  badge?: string;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  externalDocsHref?: string;
  externalDocsLabel?: string;
}

function Cube({ dark }: { dark?: boolean }) {
  const gradient = dark
    ? "from-primary-soft via-primary to-primary-dark"
    : "from-primary-soft via-primary to-primary";

  return (
    <div
      className={`relative h-36 w-36 sm:h-44 sm:w-44 rotate-[18deg] rounded-3xl bg-gradient-to-br ${gradient} shadow-2xl`}
    >
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/30 via-white/0 to-black/10" />
      <div className="absolute inset-[10px] rounded-2xl bg-gradient-to-br from-white/20 via-white/0 to-black/20" />
    </div>
  );
}

export default function ComingSoon({
  badge = "WhatsApp API Generation",
  title = "Coming Soon",
  description = "We’re working on this section. It will be available soon.",
  backHref = "/user/developers",
  backLabel = "Back to Developer Resources",
  externalDocsHref = "https://developers.facebook.com/docs/whatsapp",
  externalDocsLabel = "Explore Meta Documentation",
}: ComingSoonProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [displayedTitle, setDisplayedTitle] = useState(reduce ? title : "");
  const [displayedPara, setDisplayedPara] = useState(reduce ? description : "");

  useEffect(() => {
    if (reduce) {
      setDisplayedTitle(title);
      return;
    }

    let i = 0;
    setDisplayedTitle("");
    const interval = setInterval(() => {
      i += 1;
      setDisplayedTitle(title.slice(0, i));
      if (i >= title.length) clearInterval(interval);
    }, 80);

    return () => clearInterval(interval);
  }, [reduce, title]);

  useEffect(() => {
    if (reduce) {
      setDisplayedPara(description);
      return;
    }

    let i = 0;
    setDisplayedPara("");
    const interval = setInterval(() => {
      i += 1;
      setDisplayedPara(description.slice(0, i));
      if (i >= description.length) clearInterval(interval);
    }, 20);

    return () => clearInterval(interval);
  }, [reduce, description]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden flex flex-col justify-center px-6 py-12 lg:px-12 bg-gradient-to-tr from-primary-lighter/50 via-primary-lighter/30 to-primary-light/40 dark:bg-none dark:bg-transparent">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklab, var(--color-primary-foreground) 15%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--color-primary-foreground) 15%, transparent) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 dark:bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 w-96 h-96 rounded-full bg-primary/10 dark:bg-primary/5 blur-3xl" />

      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 w-full">
        {/* Left Column: Text & Actions */}
        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.7 }}
          className="space-y-6"
        >
          {badge && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-[var(--color-primary)] dark:text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-2xs backdrop-blur-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]"></span>
              </span>
              <Code className="w-3.5 h-3.5" />
              <span>{badge}</span>
            </div>
          )}

          <motion.h1
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 1, ease: "easeOut" }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground"
          >
            {displayedTitle}
            <span className="inline-block w-1.5 h-9 sm:h-11 bg-[var(--color-primary)] ml-1.5 animate-pulse align-middle" />
          </motion.h1>

          <p className="max-w-lg text-sm sm:text-base leading-relaxed text-muted-foreground">
            {displayedPara}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {backHref && (
              <button
                onClick={() => router.push(backHref)}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-primary text-white hover:bg-primary/90 transition-all shadow-xs hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{backLabel}</span>
              </button>
            )}

            {externalDocsHref && (
              <a
                href={externalDocsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-card hover:bg-card/80 text-foreground border border-border transition-all shadow-xs hover:shadow-md hover:-translate-y-0.5"
              >
                <span>{externalDocsLabel}</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            )}
          </div>
        </motion.div>

        {/* Right Column: Floating 3D Cubes */}
        <div className="relative flex min-h-[320px] sm:min-h-[400px] items-center justify-center lg:justify-end overflow-visible">
          {/* Big Cube */}
          <motion.div
            className="relative z-10"
            animate={reduce ? {} : { y: [0, -22, 0], rotate: [18, 22, 18] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Cube dark={true} />
          </motion.div>

          {/* Small Cube */}
          <motion.div
            className="absolute -bottom-4 sm:-bottom-6 sm:right-32 scale-[0.68] z-10"
            animate={reduce ? {} : { y: [0, 15, 0], rotate: [18, 14, 18] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Cube dark={true} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
