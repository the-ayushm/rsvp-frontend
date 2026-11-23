import { useState, useEffect, useMemo } from "react";
import { Contact } from "../types/inbox.types";
import { HOURS_24_MS } from "../constants";

export function useServiceWindow(selectedContact: Contact | null) {
  const [windowTick, setWindowTick] = useState(0);

  const windowState = useMemo(() => {
    if (!selectedContact?.lastInboundAt) {
      return { isOpen: false, remainingText: null };
    }
    const last = new Date(selectedContact.lastInboundAt).getTime();
    const elapsed = Date.now() - last;
    if (elapsed > HOURS_24_MS) {
      return { isOpen: false, remainingText: null };
    }
    const remaining = HOURS_24_MS - elapsed;
    const h = Math.floor(remaining / (60 * 60 * 1000));
    const m = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return {
      isOpen: true,
      remainingText: `${h}h ${m}m left`,
    };
  }, [selectedContact?.lastInboundAt, windowTick]);

  useEffect(() => {
    const t = setInterval(() => setWindowTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return { windowState };
}
