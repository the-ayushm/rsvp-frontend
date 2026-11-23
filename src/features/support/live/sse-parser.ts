import type { StreamEvent } from "./types";

/**
 * Incremental text/event-stream parser. Network chunks can split a frame (or a
 * single line, or a CRLF pair) anywhere, so input is buffered until a complete
 * line arrives and frames are dispatched on the blank line that ends them.
 * Comment lines (":heartbeat") are ignored.
 */
export function createSseParser(onEvent: (event: StreamEvent) => void) {
  let buffer = "";
  let eventName = "";
  let data: string[] = [];
  let id: string | null = null;
  let pendingCR = false;

  const dispatch = () => {
    if (data.length > 0) {
      onEvent({ event: eventName || "message", data: data.join("\n"), id });
    }
    eventName = "";
    data = [];
    id = null;
  };

  const processLine = (line: string) => {
    if (line === "") {
      dispatch();
      return;
    }
    if (line.startsWith(":")) return;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") eventName = value;
    else if (field === "data") data.push(value);
    else if (field === "id" && !value.includes("\0")) id = value;
  };

  return {
    push(chunk: string) {
      // A CR at the end of the previous chunk may be the first half of CRLF.
      if (pendingCR && chunk.startsWith("\n")) chunk = chunk.slice(1);
      pendingCR = false;

      buffer += chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];
        if (ch !== "\n" && ch !== "\r") continue;
        processLine(buffer.slice(start, i));
        if (ch === "\r") {
          if (i + 1 < buffer.length) {
            if (buffer[i + 1] === "\n") i++;
          } else {
            pendingCR = true;
          }
        }
        start = i + 1;
      }
      buffer = buffer.slice(start);
    },
    /** Forget any partial frame (used when a connection is dropped). */
    reset() {
      buffer = "";
      eventName = "";
      data = [];
      id = null;
      pendingCR = false;
    },
  };
}
