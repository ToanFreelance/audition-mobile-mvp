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
      setCreated(true);
    } catch {
      // Local draft restore is optional. Account/profile authority remains Phase 7.
    }
  }, []);

  const selectCharacter = (assetId: CharacterAssetId) => {
    const next = getCharacterCatalogEntry(assetId);
    if (!next?.runtimeReady || next.id === characterAssetId) return;
    setCharacterAssetId(next.id);
    setHairStyle(next.defaultAppearance.hairStyle);
    setHairColor(next.defaultAppearance.hairColor);
    setSkinTone(next.defaultAppearance.skinTone);
    setFace(next.defaultAppearance.face);
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
    if (!valid) return;
    try {
      saveCharacterCreationDraft(window.localStorage, profile);
    } catch {
      // Draft persistence is optional. Account/profile authority belongs to Phase 7.
    }
    setCreated(true);
  };

  return (
    <main
      className={styles.page}
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
                <label>GIỚI TÍNH</label>
                <button
                  className={creatorCharacter.gender === "female" ? styles.bodyActive : ""}
                  disabled={!femaleStarter}
                  onClick={() => femaleStarter && selectCharacter(femaleStarter.id)}
                  type="button"
                >
                  ♀ Nữ
                </button>
                <button
                  className={creatorCharacter.gender === "male" ? styles.bodyActive : ""}
                  disabled={!maleStarter}
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
          <div className={styles.avatarRow} role="group" aria-label="Chọn nhân vật">
            {CHARACTER_CATALOG_V1.filter(entry => entry.runtimeReady).map(entry => (
              <button
                aria-label={`Chọn ${entry.label}`}
                aria-pressed={characterAssetId === entry.id}
                className={[styles.avatarTile, characterAssetId === entry.id ? styles.avatarSelected : ""].filter(Boolean).join(" ")}
                data-testid={`c1-avatar-${entry.id}`}
                key={entry.id}
                onClick={() => selectCharacter(entry.id)}
                type="button"
              >
                <img alt="" src={entry.portraitUrl} />
              </button>
            ))}
            {[1, 2].map(slot => (
              <button aria-label={`Chân dung ${slot + 2} chưa khả dụng`} className={[styles.avatarTile, styles.avatarUnavailable].join(" ")} disabled key={slot} type="button">
                <CreatorIcon kind="body" />
                <span>CHƯA CÓ</span>
              </button>
            ))}
          </div>

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
