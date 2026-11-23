import { redirect } from "next/navigation";

// Legacy route: flows are edited in the backend-driven builder.
export default async function LegacyFlowRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/user/flows/builder/${encodeURIComponent(id)}`);
}
