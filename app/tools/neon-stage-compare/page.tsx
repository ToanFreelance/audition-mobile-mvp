import Stage3D from "@/components/Stage3D";

const GOLDEN_CONCEPT_WIDTH = 941;
const GOLDEN_CONCEPT_HEIGHT = 1672;

export default function NeonStageComparePage() {
  return (
    <main
      data-testid="neon-stage-visual-compare"
      data-golden-width={GOLDEN_CONCEPT_WIDTH}
      data-golden-height={GOLDEN_CONCEPT_HEIGHT}
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: "#02030a",
      }}
    >
      <div
        data-testid="neon-stage-golden-frame"
        style={{
          position: "relative",
          width: `min(100vw, calc(100svh * ${GOLDEN_CONCEPT_WIDTH} / ${GOLDEN_CONCEPT_HEIGHT}))`,
          aspectRatio: `${GOLDEN_CONCEPT_WIDTH} / ${GOLDEN_CONCEPT_HEIGHT}`,
          maxHeight: "100svh",
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
      </div>
    </main>
  );
}
