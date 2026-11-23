/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
export async function runChatbot(bot: { nodes: any; edges: any; }, userInput: string, sessionKey: any) {
  const nodes = bot.nodes;
  const edges = bot.edges;

  const findNode = (id: any) => nodes.find((n: { id: any; }) => n.id === id);

  // ✅ Find start node (Trigger node)
  const start = nodes.find((n: { type: string; }) => n.type === "trigger");
  if (!start) return null;

  let current = start;

  while (true) {
    if (current.type === "message") {
      return current.data.text; // simple reply
    }

    if (current.type === "ai") {
      const prompt = current.data.prompt || "Respond:";
      const reply = await callOpenAI(prompt + "\nUser: " + userInput);
      return reply;
    }

    // next node
    const link = edges.find((e: { source: any; }) => e.source === current.id);
    if (!link) return null;

    current = findNode(link.target);
  }
}

async function callOpenAI(text: string) {
  const key = process.env.OPENAI_API_KEY;
  const res = await axios.post("https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: text }],
    },
    {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });

  const data = await res.data;
  return data?.choices?.[0]?.message?.content || "…";
}
