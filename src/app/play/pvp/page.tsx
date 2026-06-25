import { redirect } from "next/navigation";

// The old PvP hub now lives at the games hub, where players can jump into
// online play or pick an event/venue.
export default function PvpHubPage() {
  redirect("/play");
}
