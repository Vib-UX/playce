import { redirect } from "next/navigation";

// PvP now lives inside events. Send the old global hub into the event-gated
// 67 lobby, which prompts the player to pick a venue and check in.
export default function PvpHubPage() {
  redirect("/play/67");
}
