import GameShellV2 from "@/components/GameShellV2";
import ReferenceAudio from "@/components/ReferenceAudio";
import StageMount from "@/components/StageMount";

export default function Home() {
  return (
    <>
      <GameShellV2 />
      <StageMount />
      <ReferenceAudio />
    </>
  );
}
