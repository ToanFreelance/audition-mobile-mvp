import Stage3D from "@/components/Stage3D";

/** Focused S2.5B runtime QA; does not create a second renderer or audio clock. */
export default function BasketballStageRuntimeQaPage() {
  return (
    <main data-testid="basketball-stage-runtime-qa" style={{
      position: "fixed", inset: 0, overflow: "hidden", background: "#91c7ed",
    }}>
      <Stage3D
        selectedStageId="basketball-court-v1"
        cameraPreset="center"
        visualCompareMode
        fixedPresentationTimeSeconds={12}
      />
    </main>
  );
}
