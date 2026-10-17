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
import styles from "./CharacterCreationV1.module.css";
import CreatorIcon from "./CreatorIcon";
import {
  appearanceFromProfile,
  emptyCharacterLookSlots,
  readCharacterLookSlots,
  writeCharacterLookSlots,
  type CharacterLookSlots,
} from "./character-look-presets";

type CreatorTab = "hair" | "face" | "body" | "outfit" | "accessory" | "shoes";

const NAME_SUGGESTIONS = ["Luna", "Yuna", "Mina", "Ari", "Nari", "Sora"];

// The approved sketch contains five visible categories. "Mặt" remains accessible
// from Tạo hình; unavailable equipment slots retain their honest catalog state.
const TABS: Array<{ id: Exclude<CreatorTab, "face">; label: string; locked?: boolean }> = [
  { id: "hair", label: "Kiểu tóc" },
  { id: "outfit", label: "Trang phục", locked: true },
  { id: "accessory", label: "Phụ kiện", locked: true },
  { id: "shoes", label: "Giày", locked: true },
  { id: "body", label: "Tạo hình" },
];

const DEFAULT_CHARACTER_DEFINITION = (() => {
  const character = getCharacterCatalogEntry(DEFAULT_CHARACTER_CREATION_PROFILE.characterAssetId);
  if (!character) throw new Error("Default creator character is missing from catalog.");
  return character;
})();

function ChoiceCard({
  choice,
  selected,
  onSelect,
  icon,
}: {
  choice: CharacterCatalogChoice;
  selected: boolean;
  onSelect: () => void;
  icon: string;
}) {
  return (
    <button
      className={[styles.choiceCard, selected ? styles.selected : "", !choice.available ? styles.lockedChoice : ""].filter(Boolean).join(" ")}
      disabled={!choice.available}
      onClick={onSelect}
      type="button"
    >
      <span className={styles.choiceIcon}>{icon}</span>
      <strong>{choice.label}</strong>
      <small>{choice.available ? (selected ? "Đang dùng" : "Chọn") : choice.note ?? "Chưa khả dụng"}</small>
    </button>
  );
}

export default function CharacterCreationV1() {
  const [tab, setTab] = useState<CreatorTab>("hair");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const [lockedAssetId, setLockedAssetId] = useState<CharacterAssetId | null>(null);
  const [lookSlots, setLookSlots] = useState<CharacterLookSlots>(emptyCharacterLookSlots);
  const [activeLookSlot, setActiveLookSlot] = useState<number | null>(null);
  const [lookMessage, setLookMessage] = useState("");
  const [yaw, setYaw] = useState(-0.08);
  const [name, setName] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.name);
  const [characterAssetId, setCharacterAssetId] = useState<CharacterAssetId>(DEFAULT_CHARACTER_CREATION_PROFILE.characterAssetId);
  const [hairStyle, setHairStyle] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.hairStyle);
  const [hairColor, setHairColor] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.hairColor);
  const [skinTone, setSkinTone] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.skinTone);
  const [face, setFace] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.face);
  const [created, setCreated] = useState(false);
  const dragRef = useRef<{ id: number; x: number; yaw: number } | null>(null);

  const creatorCharacter = getCharacterCatalogEntry(characterAssetId) ?? DEFAULT_CHARACTER_DEFINITION;
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
    name: normalizedName,
  }), [creatorCharacter.gender, creatorCharacter.id, face, hairColor, hairStyle, normalizedName, skinTone]);

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
      setLockedAssetId(draft.characterAssetId);
      setCreated(true);
      // Legacy migration: an existing one-character draft becomes its first
      // saved appearance. Never seed a second male/female character here.
      const saved = readCharacterLookSlots(window.localStorage, draft.characterAssetId);
      setLookSlots(saved ?? [appearanceFromProfile(draft), null, null, null]);
      setActiveLookSlot(0);
    } catch {
      // Local draft restore is optional. Account/profile authority remains Phase 7.
    }
  }, []);

  const selectCharacter = (assetId: CharacterAssetId) => {
    const next = getCharacterCatalogEntry(assetId);
    if (!next?.runtimeReady || next.id === characterAssetId || (lockedAssetId && lockedAssetId !== next.id)) return;
    setCharacterAssetId(next.id);
    setHairStyle(next.defaultAppearance.hairStyle);
    setHairColor(next.defaultAppearance.hairColor);
    setSkinTone(next.defaultAppearance.skinTone);
    setFace(next.defaultAppearance.face);
    setLookSlots(emptyCharacterLookSlots());
    setActiveLookSlot(null);
    setCreated(false);
  };

  const femaleStarter = CHARACTER_CATALOG_V1.find(entry => entry.gender === "female" && entry.runtimeReady) ?? null;
  const maleStarter = CHARACTER_CATALOG_V1.find(entry => entry.gender === "male" && entry.runtimeReady) ?? null;

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { id: event.pointerId, x: event.clientX, yaw };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    setYaw(drag.yaw + (event.clientX - drag.x) * 0.012);
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
    if (!valid || (lockedAssetId && lockedAssetId !== profile.characterAssetId)) return;
    try {
      saveCharacterCreationDraft(window.localStorage, profile);
      // First creation also creates the default appearance preset.
      const nextSlots = lockedAssetId
        ? lookSlots
        : [appearanceFromProfile(profile), null, null, null] as CharacterLookSlots;
      writeCharacterLookSlots(window.localStorage, profile.characterAssetId, nextSlots);
      setLookSlots(nextSlots);
      setLockedAssetId(profile.characterAssetId);
      setActiveLookSlot(lockedAssetId ? activeLookSlot : 0);
      setLookMessage("");
      setCreated(true);
    } catch {
      setLookMessage("Không thể lưu trên thiết bị. Hãy kiểm tra dung lượng trình duyệt.");
    }
  };

  const saveLook = (index: number) => {
    if (!lockedAssetId) {
      setLookMessage("Hãy tạo nhân vật trước khi lưu mẫu ngoại hình.");
      return;
    }
    if (lockedAssetId !== profile.characterAssetId) return;
    const nextSlots = [...lookSlots] as CharacterLookSlots;
    nextSlots[index] = appearanceFromProfile(profile);
    try {
      writeCharacterLookSlots(window.localStorage, lockedAssetId, nextSlots);
      setLookSlots(nextSlots);
      setActiveLookSlot(index);
      setLookMessage(`Đã lưu mẫu ${index + 1} trên thiết bị`);
    } catch {
      setLookMessage("Không thể lưu mẫu. Hãy kiểm tra bộ nhớ trình duyệt.");
    }
  };

  const applyLook = (index: number) => {
    const look = lookSlots[index];
    if (!look || !lockedAssetId || lockedAssetId !== profile.characterAssetId) return;
    setHairStyle(look.hairStyle);
    setHairColor(look.hairColor);
    setSkinTone(look.skinTone);
    setFace(look.face);
    setActiveLookSlot(index);
    setOptionsOpen(false);
    setCreated(false); // Press CTA to persist the active appearance to the draft.
    setLookMessage(`Đã chọn mẫu ${index + 1}. Nhấn Tạo nhân vật để áp dụng.`);
  };

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
          <nav className={styles.rail} aria-label="Tuỳ chỉnh nhân vật">
            {TABS.map(item => (
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
            <CharacterCreationStage3D assetId={profile.characterAssetId} focus={tab} yaw={yaw} />
          </div>

          <div className={styles.rotateHint} aria-hidden="true">
            <b className={styles.rotateArrow}><CreatorIcon kind="rotate" /></b>
            <div><strong>Xoay nhân vật</strong><small>Drag to rotate</small></div>
          </div>

          <div className={styles.heroBadge}>
            <span>{creatorCharacter.creatorBadge}</span>
            <strong>{creatorCharacter.label}</strong>
            <small>{creatorCharacter.creatorVersionLabel}</small>
          </div>
          {optionsOpen && (
            <section aria-label="Tuỳ chọn tạo nhân vật" className={styles.optionsOverlay} data-testid="c1-category-options">
              <button aria-label="Đóng tuỳ chọn" className={styles.optionsClose} onClick={() => setOptionsOpen(false)} type="button">×</button>
          <div className={styles.panelTitle}>
            <div><span>C4 · MALE + FEMALE STARTERS</span><strong>{TABS.find(item => item.id === tab)?.label}</strong></div>
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
                      className={[styles.swatch, styles[`hair_${choice.id}`], hairColor === choice.id ? styles.swatchActive : "", !choice.available ? styles.swatchLocked : ""].filter(Boolean).join(" ")}
                      disabled={!choice.available}
                      key={choice.id}
                      onClick={() => setHairColor(choice.id)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
              <div className={styles.choiceGrid}>
                {creatorCharacter.appearance.hairStyles.map((choice, index) => (
                  <ChoiceCard
                    choice={choice}
                    icon={index === 0 ? "◖" : index === 1 ? "⌒" : "⑂"}
                    key={choice.id}
                    onSelect={() => setHairStyle(choice.id)}
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
                  onSelect={() => setFace(choice.id)}
                  selected={face === choice.id}
                />
              ))}
            </div>
          )}

          {tab === "body" && (
            <div className={styles.bodyGrid}>
              <div className={styles.bodyCard}>
                <label>NHÂN VẬT {lockedAssetId ? "(ĐÃ CHỌN)" : "(CHỌN MỘT LẦN)"}</label>
                <button
                  className={creatorCharacter.gender === "female" ? styles.bodyActive : ""}
                  disabled={!femaleStarter || (lockedAssetId !== null && lockedAssetId !== femaleStarter.id)}
                  onClick={() => femaleStarter && selectCharacter(femaleStarter.id)}
                  type="button"
                >
                  ♀ Nữ
                </button>
                <button
                  className={creatorCharacter.gender === "male" ? styles.bodyActive : ""}
                  disabled={!maleStarter || (lockedAssetId !== null && lockedAssetId !== maleStarter.id)}
                  onClick={() => maleStarter && selectCharacter(maleStarter.id)}
                  type="button"
                >
                  ♂ Nam
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
                      onClick={() => setSkinTone(choice.id)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {(tab === "outfit" || tab === "accessory" || tab === "shoes") && (
            <div className={styles.futurePanel}>
              <span>◇</span>
              <strong>{TABS.find(item => item.id === tab)?.label}</strong>
              <p>Slot đã có trong character catalog. Inventory / equipment / shop vẫn thuộc Phase 8–9.</p>
            </div>
          )}


              {tab === "body" && (
                <button className={styles.faceSwitch} onClick={() => setTab("face")} type="button">Mặt · Tuỳ chỉnh khuôn mặt →</button>
              )}
              {tab === "face" && (
                <button className={styles.faceSwitch} onClick={() => setTab("body")} type="button">← Tạo hình</button>
              )}
            </section>
          )}
        </div>

        <div className={styles.dock}>
          <div className={styles.desktopHeading}>
            <span>CHARACTER CREATION</span>
            <strong>TẠO NHÂN VẬT</strong>
            <small>Một nhân vật · Bốn mẫu ngoại hình yêu thích</small>
          </div>
          <div className={styles.presetHeader}>
            <span>MẪU NGOẠI HÌNH</span>
            <small>Chạm mẫu để dùng • Lưu để ghi đè</small>
          </div>
          <div className={styles.avatarRow} role="group" aria-label="Mẫu ngoại hình đã lưu">
            {lookSlots.map((look, index) => (
              <div className={styles.presetCell} key={index}>
                <button
                  aria-label={look ? `Áp dụng mẫu ${index + 1}` : `Lưu mẫu ${index + 1}`}
                  aria-pressed={activeLookSlot === index && look !== null}
                  className={[styles.avatarTile, look && activeLookSlot === index ? styles.avatarSelected : "", !look ? styles.avatarEmpty : ""].filter(Boolean).join(" ")}
                  data-testid={`c1-look-slot-${index + 1}`}
                  onClick={() => look ? applyLook(index) : saveLook(index)}
                  type="button"
                >
                  {look ? <img alt="" src={creatorCharacter.portraitUrl} /> : <span className={styles.emptyLookPlus}>＋</span>}
                  <span className={styles.presetLabel}>{`MẪU ${String(index + 1).padStart(2, "0")}`}</span>
                </button>
                {look && (
                  <button
                    aria-label={`Ghi đè mẫu ${index + 1}`}
                    className={styles.presetSave}
                    onClick={() => saveLook(index)}
                    type="button"
                  >Lưu</button>
                )}
              </div>
            ))}
          </div>
          {lookMessage && <p className={styles.presetMessage} role="status">{lookMessage}</p>}

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
            disabled={!valid}
            onClick={createCharacter}
            type="button"
          >
            {created ? "✓ NHÂN VẬT MVP ĐÃ SẴN SÀNG" : "TẠO NHÂN VẬT"}
          </button>

          {created && (
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

          <div className={styles.footerNote}>
            <span>DANCE YOUR STORY <CreatorIcon kind="heart" /></span>
            <small>{created ? "Đã lưu trên thiết bị" : ""}</small>
          </div>
        </div>
      </section>
    </main>
  );
}
