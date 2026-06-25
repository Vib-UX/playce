import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Playces | Show up. Play. Earn.",
    short_name: "Playces",
    description:
      "Turn real-world venues into interactive social arenas. Check in, play mini-games, rep your chain, unlock airdrops, and collect onchain rewards.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0912",
    theme_color: "#0a0912",
    orientation: "portrait",
    categories: ["events", "social", "lifestyle"],
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
