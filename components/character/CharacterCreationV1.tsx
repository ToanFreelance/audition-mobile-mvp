"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CharacterCreationStage3D from "./CharacterCreationStage3D";
import {
  CHARACTER_CATALOG_V1,
  getCharacterCatalogEntry,
  type CharacterAssetId,
  type CharacterCatalogChoice,
} from "./character-catalog";
import {
  DEFAULT_CHARACTER_CREATION_PROFILE,
  loadCharacterCreationDraft,
  saveCharacterCreationDraft,
  type CharacterCreationProfileV1,
} from "./character-profile";
import {
  defaultM3CreatorOutfit, getM3CreatorWardrobe, type M3CreatorOutfit,
} from "./m3-creator-outfits";
import { m3CreatorHairThumbnailUrl, m3CreatorThumbnailUrl } from "./m3-creator-thumbnails";
import styles from "./CharacterCreationV1.module.css";
import CreatorIcon from "./CreatorIcon";

type CreatorTab = "hair" | "face" | "body" | "outfit" | "accessory" | "shoes";

const NAME_SUGGESTIONS = ["Luna", "Yuna", "Mina", "Ari", "Nari", "Sora"];

// The approved sketch contains five visible categories. "Mặt" remains accessible
// from Tạo hình; unavailable equipment slots retain their honest catalog state.
const TABS: Array<{ id: Exclude<CreatorTab, "face">; label: string; locked?: boolean }> = [
  { id: "body", label: "Tạo hình" },
  { id: "hair", label: "Kiểu tóc" },
  { id: "outfit", label: "Trang phục", locked: true },
  { id: "accessory", label: "Phụ kiện", locked: true },
  { id: "shoes", label: "Giày", locked: true },
];

const DEFAULT_CHARACTER_DEFINITION = (() => {
  const character = getCharacterCatalogEntry(DEFAULT_CHARACTER_CREATION_PROFILE.characterAssetId);
  if (!character) throw new Error("Default creator character is missing from catalog.");
  return character;
})();

/** Consistent SVG bounds replace baseline-dependent Unicode gender glyphs. */
function GenderGlyph({ gender }: { gender: "female" | "male" }) {
  return gender === "female" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8.7" r="5.5" />
      <path d="M12 14.2V21M8.2 17.7h7.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="9.8" cy="14.2" r="5.5" />
      <path d="M13.8 10.2 21 3M15.7 3H21v5.3" />
    </svg>
  );
}

/** Actual item-only PNG, not a cropped full-character portrait. */
function M3ItemThumbnail({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={styles.creatorItemArt} aria-hidden="true" title={label}>
      {!failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.creatorItemArtFallback}>◇</span>
      )}
    </span>
  );
}

function ChoiceCard({
  choice,
  selected,
  onSelect,
  icon,
  thumbnailUrl,
}: {
  choice: CharacterCatalogChoice;
  selected: boolean;
  onSelect: () => void;
  icon: string;
  thumbnailUrl?: string;
}) {
  return (
    <button
      className={[styles.choiceCard, selected ? styles.selected : "", !choice.available ? styles.lockedChoice : ""].filter(Boolean).join(" ")}
      aria-pressed={selected}
      disabled={!choice.available}
      onClick={onSelect}
      type="button"
    >
      {thumbnailUrl
        ? <M3ItemThumbnail key={thumbnailUrl} url={thumbnailUrl} label={choice.label} />
        : <span className={styles.choiceIcon}>{icon}</span>}
      <strong>{choice.label}</strong>
      <small>{choice.available ? (selected ? "Đang dùng" : "Chọn") : choice.note ?? "Chưa khả dụng"}</small>
    </button>
  );
}

export default function CharacterCreationV1() {
  const [tab, setTab] = useState<CreatorTab>("body");
  const [optionsOpen, setOptionsOpen] = useState(true);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const [lockedAssetId, setLockedAssetId] = useState<CharacterAssetId | null>(null);
  const [saveError, setSaveError] = useState("");
  const [yaw, setYaw] = useState(-0.08);
  const [name, setName] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.name);
  const [characterAssetId, setCharacterAssetId] = useState<CharacterAssetId>(DEFAULT_CHARACTER_CREATION_PROFILE.characterAssetId);
  const [hairStyle, setHairStyle] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.hairStyle);
  const [hairColor, setHairColor] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.hairColor);
  const [skinTone, setSkinTone] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.skinTone);
  const [face, setFace] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.face);
  const [created, setCreated] = useState(false);
  const [m3PreviewReady, setM3PreviewReady] = useState(false);
  const [m3Outfit, setM3Outfit] = useState<M3CreatorOutfit | undefined>(DEFAULT_CHARACTER_CREATION_PROFILE.m3Outfit);
  const dragRef = useRef<{ id: number; x: number; yaw: number } | null>(null);

  const creatorCharacter = getCharacterCatalogEntry(characterAssetId) ?? DEFAULT_CHARACTER_DEFINITION;
  const creatorWardrobe = getM3CreatorWardrobe(creatorCharacter.id);
  const normalizedName = name.trim();
  const valid = normalizedName.length > 0;
  const profile = useMemo<CharacterCreationProfileV1>(() => ({
    version: 1,
    gender: creatorCharacter.gender,
    characterAssetId: creatorCharacter.id,
    hairStyle,
    hairColor,
    skinTone,
    face,
    m3Outfit: creatorWardrobe ? m3Outfit ?? creatorWardrobe.defaultOutfit : undefined,
    name: normalizedName,
  }), [creatorCharacter.gender, creatorCharacter.id, creatorWardrobe, face, hairColor, hairStyle, m3Outfit, normalizedName, skinTone]);

  // Scope the no-scroll/no-pinch game viewport to this route only.
  // Restore prior document styles when navigating to /rooms or any other route.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    const visualViewport = window.visualViewport;
    const syncViewport = () => {
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty("--creator-height", `${visualViewport?.height ?? window.innerHeight}px`);
      root.style.setProperty("--creator-top", `${visualViewport?.offsetTop ?? 0}px`);
    };
    const preventPinch = (event: Event) => event.preventDefault();
    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    syncViewport();
    visualViewport?.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    document.addEventListener("gesturestart", preventPinch, { passive: false });
    document.addEventListener("gesturechange", preventPinch, { passive: false });
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });
    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      visualViewport?.removeEventListener("resize", syncViewport);
      visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      document.removeEventListener("gesturestart", preventPinch);
      document.removeEventListener("gesturechange", preventPinch);
      document.removeEventListener("touchmove", preventMultiTouch);
    };
  }, []);

  useEffect(() => {
    try {
      const draft = loadCharacterCreationDraft(window.localStorage);
      if (!draft) return;
      setName(draft.name);
      setCharacterAssetId(draft.characterAssetId);
      setHairStyle(draft.hairStyle);
      setHairColor(draft.hairColor);
      setSkinTone(draft.skinTone);
      setFace(draft.face);
      setM3Outfit(draft.m3Outfit ?? defaultM3CreatorOutfit(draft.characterAssetId));
      setLockedAssetId(draft.characterAssetId);
      setCreated(true);
    } catch {
      // Local draft restore is optional. Account/profile authority remains Phase 7.
    }
  }, []);

  const selectCharacter = (assetId: CharacterAssetId) => {
    const next = getCharacterCatalogEntry(assetId);
    if (!(next?.creatorReady || next?.runtimeReady) || next.id === characterAssetId) return;
    // Only M3 creator QA allows deliberate migration of an old saved starter
    // or switching between the two accepted M3 rigs before room integration.
    if (lockedAssetId && lockedAssetId !== next.id && !next.m3RigFamily) return;
    if (lockedAssetId && lockedAssetId !== next.id) setLockedAssetId(null);
    setCharacterAssetId(next.id);
    setHairStyle(next.defaultAppearance.hairStyle);
    setHairColor(next.defaultAppearance.hairColor);
    setSkinTone(next.defaultAppearance.skinTone);
    setFace(next.defaultAppearance.face);
    setM3Outfit(defaultM3CreatorOutfit(next.id));
    setSaveError("");
    setCreated(false);
  };

  const femaleStarter = CHARACTER_CATALOG_V1.find(entry => entry.gender === "female" && (entry.creatorReady || entry.runtimeReady)) ?? null;
  const maleStarter = CHARACTER_CATALOG_V1.find(entry => entry.gender === "male" && (entry.creatorReady || entry.runtimeReady)) ?? null;

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { id: event.pointerId, x: event.clientX, yaw };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    // M3 camera orbits around the stationary rig: invert its orbit so a
    // leftward drag visually turns the character left with the finger.
    // Legacy GLB preview rotates the model itself and keeps its accepted sign.
    const delta = (event.clientX - drag.x) * 0.012;
    setYaw(drag.yaw + (creatorWardrobe ? -delta : delta));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const randomize = () => {
    const index = Math.abs(Math.floor(Date.now() / 1000)) % NAME_SUGGESTIONS.length;
    setName(NAME_SUGGESTIONS[index]);
    setYaw((index % 3 - 1) * 0.18);
    setCreated(false);
  };

  const createCharacter = () => {
    if (!valid || (creatorCharacter.m3RigFamily && !m3PreviewReady)
      || (lockedAssetId && lockedAssetId !== profile.characterAssetId)) return;
    try {
      saveCharacterCreationDraft(window.localStorage, profile);
      setLockedAssetId(profile.characterAssetId);
      setSaveError("");
      setCreated(true);
    } catch {
      setSaveError("Không thể lưu nhân vật trên thiết bị. Hãy kiểm tra bộ nhớ trình duyệt.");
    }
  };

  // The editor is mounted below the preview for M3, not as a blocking 3D overlay.
  // The legacy GLB creator retains its existing presentation until migration.

  const optionsPanel = optionsOpen ? (
            <section aria-label="Tuỳ chọn tạo nhân vật" className={[styles.optionsOverlay, creatorWardrobe ? styles.creatorControlPanel : ""].filter(Boolean).join(" ")} data-testid="c1-category-options">
              <button aria-label="Đóng tuỳ chọn" className={styles.optionsClose} onClick={() => setOptionsOpen(false)} type="button">×</button>
          <div className={styles.panelTitle}>
            <div><span>M3 · DROPHUNTER + NEUROHACKER</span><strong>{TABS.find(item => item.id === tab)?.label}</strong></div>
            <small>Asset và capability được resolve từ catalog; không fake variant chưa có.</small>
          </div>

          {tab === "hair" && (
            <div className={styles.optionStack}>
              <div>
                <label>MÀU TÓC</label>
                <div className={styles.swatches}>
                  {creatorCharacter.appearance.hairColors.map(choice => (
                    <button
                      aria-label={choice.label}
                      aria-pressed={hairColor === choice.id}
                      className={[styles.swatch, styles[`hair_${choice.id}`], hairColor === choice.id ? styles.swatchActive : "", !choice.available ? styles.swatchLocked : ""].filter(Boolean).join(" ")}
                      disabled={!choice.available}
                      key={choice.id}
                      onClick={() => { setHairColor(choice.id); setCreated(false); }}
                      type="button"
                    />
                  ))}
                </div>
              </div>
              {creatorWardrobe && (
                <div className={styles.creatorHairSectionLabel}>
                  <span>KIỂU TÓC</span>
                  <span aria-hidden="true">VUỐT NGANG <span className={styles.creatorSwipeChevron}>›</span></span>
                </div>
              )}
              <div
                className={[styles.choiceGrid, creatorWardrobe ? styles.creatorHairCarousel : ""].filter(Boolean).join(" ")}
                aria-label="Chọn kiểu tóc"
              >
                {creatorCharacter.appearance.hairStyles.map((choice, index) => (
                  <ChoiceCard
                    choice={choice}
                    icon={index === 0 ? "◖" : index === 1 ? "⌒" : "⑂"}
                    key={choice.id}
                    thumbnailUrl={creatorCharacter.m3RigFamily
                      ? m3CreatorHairThumbnailUrl(creatorCharacter.m3RigFamily, choice.id)
                      : undefined}
                    onSelect={() => { setHairStyle(choice.id); setCreated(false); }}
                    selected={hairStyle === choice.id}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === "face" && (
            <div className={styles.choiceGrid}>
              {creatorCharacter.appearance.faces.map((choice, index) => (
                <ChoiceCard
                  choice={choice}
                  icon={index === 0 ? "◉" : "◎"}
                  key={choice.id}
                  onSelect={() => { setFace(choice.id); setCreated(false); }}
                  selected={face === choice.id}
                />
              ))}
            </div>
          )}

          {tab === "body" && (
            <div className={styles.bodyGrid}>
              <div className={styles.bodyCard}>
                <label>GIỚI TÍNH</label>
                <button
                  aria-pressed={creatorCharacter.gender === "female"}
                  className={[styles.genderChoice, creatorCharacter.gender === "female" ? styles.bodyActive : ""].filter(Boolean).join(" ")}
                  data-testid="creator-gender-female"
                  disabled={!femaleStarter || (lockedAssetId !== null && lockedAssetId !== femaleStarter.id && !femaleStarter.m3RigFamily)}
                  onClick={() => femaleStarter && selectCharacter(femaleStarter.id)}
                  type="button"
                >
                  <span className={styles.genderContents}><GenderGlyph gender="female" /><span>Nữ</span></span>
                </button>
                <button
                  aria-pressed={creatorCharacter.gender === "male"}
                  className={[styles.genderChoice, creatorCharacter.gender === "male" ? styles.bodyActive : ""].filter(Boolean).join(" ")}
                  data-testid="creator-gender-male"
                  disabled={!maleStarter || (lockedAssetId !== null && lockedAssetId !== maleStarter.id && !maleStarter.m3RigFamily)}
                  onClick={() => maleStarter && selectCharacter(maleStarter.id)}
                  type="button"
                >
                  <span className={styles.genderContents}><GenderGlyph gender="male" /><span>Nam</span></span>
                </button>
              </div>
              <div className={styles.bodyCard}>
                <label>MÀU DA</label>
                <div className={styles.swatches}>
                  {creatorCharacter.appearance.skinTones.map(choice => (
                    <button
                      aria-label={choice.label}
                      className={[styles.swatch, styles[`skin_${choice.id}`], skinTone === choice.id ? styles.swatchActive : "", !choice.available ? styles.swatchLocked : ""].filter(Boolean).join(" ")}
                      disabled={!choice.available}
                      key={choice.id}
                      onClick={() => { setSkinTone(choice.id); setCreated(false); }}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "outfit" && creatorWardrobe && (
            <div className={styles.creatorWardrobe} aria-label="Trang phục khởi tạo">
              {(["top", "bottom"] as const).map(slot => (
                <div className={styles.creatorGarmentGroup} key={slot}>
                  <strong>{slot === "top" ? "ÁO" : "QUẦN"}</strong>
                  <div className={styles.creatorGarmentGrid}>
                    {creatorWardrobe[slot].map(item => {
                      const selected = profile.m3Outfit?.[slot] === item.id;
                      return (
                        <button
                          type="button"
                          aria-pressed={selected}
                          className={[styles.creatorGarmentChoice, selected ? styles.creatorGarmentSelected : ""].filter(Boolean).join(" ")}
                          data-testid={`creator-${slot}-${item.id}`}
                          key={item.id}
                          onClick={() => {
                            const current = profile.m3Outfit ?? creatorWardrobe.defaultOutfit;
                            setM3Outfit({ ...current, [slot]: item.id });
                            setCreated(false);
                          }}
                        >
                          {creatorCharacter.m3RigFamily && (
                            <M3ItemThumbnail
                              key={item.thumbnail}
                              url={m3CreatorThumbnailUrl(creatorCharacter.m3RigFamily, item.thumbnail)}
                              label={item.label}
                            />
                          )}
                          <span className={styles.creatorGarmentLabel}>{item.label}</span>
                          {selected && <span className={styles.creatorItemCheck} aria-hidden="true">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === "shoes" && creatorWardrobe && (
            <div className={styles.creatorFixedShoes} data-testid="creator-fixed-shoes">
              {creatorCharacter.m3RigFamily && (
                <M3ItemThumbnail
                  key={creatorWardrobe.shoes.thumbnail}
                  url={m3CreatorThumbnailUrl(creatorCharacter.m3RigFamily, creatorWardrobe.shoes.thumbnail)}
                  label={creatorWardrobe.shoes.label}
                />
              )}
              <div><strong>{creatorWardrobe.shoes.label}</strong><small>Giày cơ bản mặc định</small></div>
              <span className={styles.creatorShoesCheck} aria-hidden="true">✓</span>
            </div>
          )}
          {(tab === "outfit" || tab === "accessory" || tab === "shoes") && !creatorWardrobe && (
            <div className={styles.futurePanel}>
              <span>◇</span>
              <strong>{TABS.find(item => item.id === tab)?.label}</strong>
              <p>Chưa có tuỳ chọn tạo nhân vật tương thích với mẫu này.</p>
            </div>
          )}


              {tab === "body" && (
                <button className={styles.faceSwitch} onClick={() => setTab("face")} type="button">Mặt · Tuỳ chỉnh khuôn mặt →</button>
              )}
              {tab === "face" && (
                <button className={styles.faceSwitch} onClick={() => setTab("body")} type="button">← Tạo hình</button>
              )}
            </section>

  ) : null;


  return (
    <main
      className={styles.page}
      ref={rootRef}
      data-locked-asset={lockedAssetId ?? ""}
      data-character-asset={creatorCharacter.id}
      data-profile-version="1"
      data-testid="c2-character-creation"
    >
      <section className={styles.phone}>
        <header className={styles.header}>
          <a aria-label="Quay lại" className={styles.headerIcon} href="/">
            <CreatorIcon kind="back" />
          </a>
          <button aria-label="Ngẫu nhiên" className={styles.headerIcon} onClick={randomize} type="button">
            <CreatorIcon kind="dice" />
          </button>
        </header>

        <div className={styles.hero}>
          <nav className={[styles.rail, creatorWardrobe ? styles.m3Rail : ""].filter(Boolean).join(" ")} aria-label="Tuỳ chỉnh nhân vật">
            {TABS.filter(item => item.id !== "accessory" || !creatorWardrobe).map(item => (
              <button
                aria-pressed={tab === item.id}
                className={[tab === item.id ? styles.railActive : "", item.locked ? styles.railLocked : ""].filter(Boolean).join(" ")}
                key={item.id}
                onClick={() => { setTab(item.id); setOptionsOpen(true); }}
                type="button"
              >
                <span className={styles.railSymbol}><CreatorIcon kind={item.id} /></span>
                <small>{item.label}</small>
              </button>
            ))}
          </nav>

          <div
            className={styles.viewport}
            data-testid="c2-character-viewport"
            data-yaw={yaw.toFixed(3)}
            onPointerCancel={endDrag}
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
          >
            <CharacterCreationStage3D assetId={profile.characterAssetId} focus={creatorWardrobe && tab === "outfit" ? "body" : tab} yaw={yaw}
              appearance={{ hairStyle, hairColor, skinTone, m3Outfit: profile.m3Outfit }}
              onReadyChange={setM3PreviewReady} />
          </div>

          <div className={styles.heroBadge}>
            <span>{creatorCharacter.creatorBadge}</span>
            <strong>{creatorCharacter.label}</strong>
            <small>{creatorCharacter.creatorVersionLabel}</small>
          </div>
          {!creatorWardrobe && optionsPanel}
        </div>

        <div className={[styles.dock, creatorWardrobe ? styles.creatorDock : ""].filter(Boolean).join(" ")}>
          <div className={styles.desktopHeading}>
            <span>CHARACTER CREATION</span>
            <strong>TẠO NHÂN VẬT</strong>
            <small>Tạo nhân vật · Chọn phong cách ban đầu</small>
          </div>
          {creatorWardrobe && (
            <div className={styles.creatorSetupHeading} aria-hidden="true">
              <div><span>CHARACTER STUDIO</span><strong>Thiết lập nhân vật</strong></div>
              <span className={styles.creatorStepMark}>01 / CREATE</span>
            </div>
          )}
          {creatorWardrobe && optionsPanel}

          <div className={styles.nameField}>
            <div>
              <span>TÊN NHÂN VẬT</span>
              <input
                aria-label="Tên nhân vật"
                ref={nameInputRef}
                maxLength={14}
                onChange={event => { setName(event.target.value); setCreated(false); }}
                placeholder="Nhập tên nhân vật"
                value={name}
              />
            </div>
            <button aria-label="Sửa tên nhân vật" className={styles.editName} onClick={() => nameInputRef.current?.focus()} type="button"><CreatorIcon kind="edit" /></button>
            <small className={styles.nameCounter}>{name.length}/14</small>
          </div>

          <button
            className={styles.createButton}
            data-testid="c2-confirm-character"
            disabled={!valid || Boolean(creatorCharacter.m3RigFamily && !m3PreviewReady)}
            onClick={createCharacter}
            type="button"
          >
            {created ? creatorCharacter.runtimeReady ? "✓ NHÂN VẬT MVP ĐÃ SẴN SÀNG" : "✓ ĐÃ LƯU M3 · THỬ PHÒNG CHỜ" : "TẠO NHÂN VẬT"}
          </button>

          {created && (creatorCharacter.runtimeReady || creatorCharacter.lobbyReady) && (
            <a
              href="/rooms"
              data-testid="entry-continue-rooms"
              style={{
                display: "block", marginTop: 10, padding: "14px 12px",
                borderRadius: 12, textAlign: "center",
                background: "linear-gradient(105deg, #6d38cf, #c53edb)",
                color: "#fff", textDecoration: "none", fontWeight: 800,
              }}
            >
              TIẾP TỤC → SẢNH PHÒNG
            </a>
          )}

          {created && creatorCharacter.lobbyReady && !creatorCharacter.runtimeReady && (
            <p role="status" className={styles.m3GateNote}>
              M3 chỉ thử hiển thị trong phòng chờ. Host Start/gameplay vẫn khóa cho đến khi retarget animation.
            </p>
          )}
          {saveError && <p className={styles.creatorSaveError} role="alert">{saveError}</p>}
          <div className={styles.footerNote}>
            <span>DANCE YOUR STORY <CreatorIcon kind="heart" /></span>
            <small>{created ? "Đã lưu trên thiết bị" : ""}</small>
          </div>
        </div>
      </section>
    </main>
  );
}
