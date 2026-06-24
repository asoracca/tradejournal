import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TradeGoons",
    short_name: "TradeGoons",
    description: "Paper trade stocks, options & futures with AI coaching.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0a12",
    theme_color: "#0d0a12",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
