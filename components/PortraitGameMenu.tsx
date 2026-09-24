export type ControlLayout = "space-left" | "dpad-left";
export type CameraPreset = "center" | "wide" | "close";
export type ControlSize = "default" | "large";
export const CONTROL_SPACING_MAX = 28;
export const CONTROL_SPACING_STEP = 4;

type Props = {
  controlLayout: ControlLayout;
  cameraPreset: CameraPreset;
  controlSize: ControlSize;
  controlSpacing: number;
  exitConfirmOpen: boolean;
  onControlLayoutChange: (value: ControlLayout) => void;
  onCameraPresetChange: (value: CameraPreset) => void;
  onControlSizeChange: (value: ControlSize) => void;
  onControlSpacingChange: (value: number) => void;
  onRequestExit: () => void;
  onCancelExit: () => void;
  onConfirmExit: () => void;
  onClose: () => void;
};

const layoutOptions: Array<{ value: ControlLayout; label: string }> = [
  { value: "space-left", label: "SPACE ←  D-PAD →" },
  { value: "dpad-left", label: "D-PAD ←  SPACE →" },
];

const cameraOptions: Array<{ value: CameraPreset; label: string }> = [
  { value: "center", label: "Center" },
  { value: "wide", label: "Wide" },
  { value: "close", label: "Close" },
];

const sizeOptions: Array<{ value: ControlSize; label: string }> = [
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
];

export default function PortraitGameMenu({
  controlLayout,
  cameraPreset,
  controlSize,
  controlSpacing,
  exitConfirmOpen,
  onControlLayoutChange,
  onCameraPresetChange,
  onControlSizeChange,
  onControlSpacingChange,
  onRequestExit,
  onCancelExit,
  onConfirmExit,
  onClose,
}: Props) {
  return (
    <div className="portrait-menu-backdrop" role="presentation" onPointerDown={onClose}>
      <section
        className="portrait-game-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portrait-menu-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div><span>UTILITY</span><h2 id="portrait-menu-title">MENU</h2></div>
          <button className="portrait-menu-x" type="button" onClick={onClose} aria-label="Đóng menu">×</button>
        </header>

        {exitConfirmOpen ? (
          <div className="portrait-exit-confirm">
            <strong>Rời màn chơi?</strong>
            <p>Nhạc và lượt chơi hiện tại sẽ kết thúc.</p>
            <div>
              <button type="button" onClick={onCancelExit}>HỦY</button>
              <button className="danger" type="button" onClick={onConfirmExit}>RỜI</button>
            </div>
          </div>
        ) : (
          <>
            <div className="portrait-settings-title">CÀI ĐẶT</div>
            <SettingRow label="Control Layout">
              <div className="portrait-segments portrait-layout-segments">
                {layoutOptions.map((option) => (
                  <button key={option.value} type="button" className={controlLayout === option.value ? "selected" : ""} aria-pressed={controlLayout === option.value} onClick={() => onControlLayoutChange(option.value)}>{option.label}</button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Camera">
              <div className="portrait-segments three">
                {cameraOptions.map((option) => (
                  <button key={option.value} type="button" className={cameraPreset === option.value ? "selected" : ""} aria-pressed={cameraPreset === option.value} onClick={() => onCameraPresetChange(option.value)}>{option.label}</button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Control Size">
              <div className="portrait-segments">
                {sizeOptions.map((option) => (
                  <button key={option.value} type="button" className={controlSize === option.value ? "selected" : ""} aria-pressed={controlSize === option.value} onClick={() => onControlSizeChange(option.value)}>{option.label}</button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Control Spacing">
              <div className="portrait-range-setting">
                <input
                  type="range"
                  min={0}
                  max={CONTROL_SPACING_MAX}
                  step={CONTROL_SPACING_STEP}
                  value={controlSpacing}
                  aria-label="Control Spacing"
                  aria-valuetext={controlSpacing === 0 ? "Default" : `+${controlSpacing}px`}
                  onChange={(event) => onControlSpacingChange(Number(event.currentTarget.value))}
                />
                <span>{controlSpacing === 0 ? "Default" : `+${controlSpacing}px`}</span>
              </div>
            </SettingRow>
            <button className="portrait-menu-action danger" type="button" onClick={onRequestExit}>RỜI MÀN CHƠI</button>
            <button className="portrait-menu-action close" type="button" onClick={onClose}>ĐÓNG MENU</button>
          </>
        )}
      </section>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="portrait-setting-row"><strong>{label}</strong>{children}</div>;
}
