import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/audio/Please tell me why.mp3",
        destination:
          "https://raw.githubusercontent.com/ToanFreelance/audition-mobile-mvp/feat/audition-ui-gauge-rebuild/public/audio/Please%20tell%20me%20why.mp3",
      },
    ];
  },
};

export default nextConfig;
