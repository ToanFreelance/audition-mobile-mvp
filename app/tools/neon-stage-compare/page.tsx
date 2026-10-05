import Stage3D from "@/components/Stage3D";

export default function NeonStageComparePage() {
  return (
    <main
      data-testid="neon-stage-visual-compare"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#02030a",
      }}
    >
      <Stage3D
        selectedStageId="neon-stage-v1"
        cameraPreset="center"
        visualCompareMode
        hideCharacter
        fixedPresentationTimeSeconds={12}
      />
    </main>
  );
}
