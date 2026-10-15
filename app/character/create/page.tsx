import type { Viewport } from "next";
import CharacterCreationV1 from "@/components/character/CharacterCreationV1";

// Game-style fixed viewport only on /character/create; other routes keep
// their normal zoom/scroll policy.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function CharacterCreatePage() {
  return <CharacterCreationV1 />;
}
