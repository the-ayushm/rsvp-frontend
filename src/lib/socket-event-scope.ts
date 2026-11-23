import type { Server } from "socket.io";
import { getInboxMessageUserId } from "./inbox-user-scope";

/** Private message events without a valid owner are dropped rather than broadcast. */
export function emitScopedSocketEvent(io: Pick<Server, "to" | "emit">, event: string, data: unknown): boolean {
  const userId = getInboxMessageUserId(data);
  if (userId) {
    io.to(`user_${userId}`).emit(event, data);
    return true;
  }
  return false;
}
