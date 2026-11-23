import { redirect } from "next/navigation";

// Flows are created through the backend from the Flows list ("New Flow").
export default function CreateFlowRedirect() {
  redirect("/user/flows?new=1");
}
