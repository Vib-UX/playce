import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameBySlug } from "@/lib/mock/games";
import { ChessLobby } from "./chess-lobby";

export const metadata: Metadata = {
  title: "Chess Blitz",
  description:
    "Speed chess on Lichess, staked head-to-head and settled trustlessly by a Chainlink CRE workflow.",
};

export default function ChessPage() {
  const game = getGameBySlug("chess");
  if (!game) notFound();
  return <ChessLobby />;
}
