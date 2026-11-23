/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { ReactFlowProvider } from "reactflow";
import BuilderCanvasInner from "./BuilderCanvasInner";

export default function BuilderCanvas({ bot, apiBase = "/api/user/chatbots", templateMode, templateRef }: any) {
  return (
    <ReactFlowProvider>
      <BuilderCanvasInner bot={bot} apiBase={apiBase} templateMode={templateMode} templateRef={templateRef} />
    </ReactFlowProvider>
  );
}
