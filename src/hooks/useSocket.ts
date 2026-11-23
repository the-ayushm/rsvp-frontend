/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { Socket } from "socket.io-client";
import { getSocket, disconnectSocket } from "@/lib/socket-client";
import { getStoredInboxUserId, inboxMessageBelongsToUser } from "@/lib/inbox-user-scope";

interface UseSocketOptions {
  onNewMessage?: (message: any) => void;
  onMessageStatusUpdate?: (data: { wamid: string; status: string }) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  const lastEventTimestampRef = useRef<number>(Date.now());

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    // Initialize socket connection
    const socket = getSocket();
    socketRef.current = socket;

    // Set up event listeners
    const handleConnect = () => {
      console.log("🟢 useSocket: Connected via Socket.IO");
      optionsRef.current.onConnect?.();
    };

    const handleDisconnect = () => {
      console.log("🔴 useSocket: Disconnected from Socket.IO");
      optionsRef.current.onDisconnect?.();
    };

    const handleNewMessage = (message: any) => {
      if (!inboxMessageBelongsToUser(message, getStoredInboxUserId())) return;
      optionsRef.current.onNewMessage?.(message);
    };

    const handleStatusUpdate = (data: { wamid: string; status: string }) => {
      if (!inboxMessageBelongsToUser(data, getStoredInboxUserId())) return;
      optionsRef.current.onMessageStatusUpdate?.(data);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("new_message", handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);

    // If already connected, trigger callback
    if (socket.connected) {
      handleConnect();
    }

    // Cleanup on unmount
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("new_message", handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
    };
  }, []);

  const isConnected = useCallback(() => {
    return socketRef.current?.connected ?? false;
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
