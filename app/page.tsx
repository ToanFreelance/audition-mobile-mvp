import GameShell from "@/components/GameShell";
import MusicController from "@/components/MusicController";
import StageMount from "@/components/StageMount";

export default function Home() {
  return (
    <>
      <GameShell />
      <StageMount />
      <MusicController />
    </>
  );
}
