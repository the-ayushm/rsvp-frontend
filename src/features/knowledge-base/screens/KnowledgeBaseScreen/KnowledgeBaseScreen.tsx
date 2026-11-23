'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

function Cube({ dark }: { dark?: boolean }) {
  const gradient = dark
    ? 'from-primary-soft via-primary to-primary-dark'
    : 'from-primary-soft via-primary to-primary';

  return (
    <div
      className={`relative h-40 w-40 rotate-[18deg] rounded-3xl bg-gradient-to-br ${gradient} shadow-2xl`}
    >
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/30 via-white/0 to-black/10" />
      <div className="absolute inset-[10px] rounded-2xl bg-gradient-to-br from-white/20 via-white/0 to-black/20" />
    </div>
  );
}

export default function Page() {
  const reduce = useReducedMotion();
  const text = 'Coming Soon';
  const [displayed, setDisplayed] = useState(reduce ? text : '');
  const paragraphText = "We’re working on this section. It will be available soon.";
  const [displayedPara, setDisplayedPara] = useState(reduce ? paragraphText : '');

    useEffect(() => {
    if (reduce) {
      setDisplayed(text);
      return;
    }

    let i = 0;
    setDisplayed('');
    const interval = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 80); 

    return () => clearInterval(interval);
  }, [reduce]);
  useEffect(() => {
  if (reduce) {
    setDisplayedPara(paragraphText);
    return;
  }

  let i = 0;
  setDisplayedPara('');
  const interval = setInterval(() => {
    i += 1;
    setDisplayedPara(paragraphText.slice(0, i));
    if (i >= paragraphText.length) clearInterval(interval);
  }, 20);

  return () => clearInterval(interval);
}, [reduce]);
  return (
    <div
      className="
        relative min-h-screen overflow-hidden
       bg-gradient-to-tr from-primary-light via-primary-light to-primary-soft
         dark:bg-none dark:bg-primary-light
      "
    >
      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--color-border-subtle) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-subtle) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 md:grid-cols-2">
        {/* Left */}
        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 18 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.7 }}
        >
          <motion.h1
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 1, ease: 'easeOut' }}
            className="text-5xl font-semibold tracking-tight md:text-6xl"
          >
            {displayed}
          </motion.h1>

          <p className="mt-6 max-w-md text-sm leading-6 text-secondary-foreground dark:text-white/60">
         {displayedPara}
        </p>
        </motion.div>

        {/* Right */}
        <div className="relative flex min-h-[360px] items-center justify-center md:justify-end overflow-visible">
          {/* Big Cube */}
          <motion.div
            className="relative z-10"
            animate={reduce ? {} : { y: [0, -22, 0], rotate: [18, 22, 18] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Cube dark />
          </motion.div>

          {/* Small Cube */}
          <motion.div
            className="absolute -bottom-6 -left-1 scale-[0.7] z-10"
            animate={reduce ? {} : { y: [0, 15, 0], rotate: [18, 14, 18] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Cube dark />
          </motion.div>
        </div>
      </div>
    </div>
  );
}