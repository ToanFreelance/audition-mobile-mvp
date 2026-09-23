"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import CharacterCreationStage3D from "./CharacterCreationStage3D";
import {
  DEFAULT_CHARACTER_CREATION_PROFILE,
  loadCharacterCreationDraft,
  saveCharacterCreationDraft,
  type CharacterCreationProfileV1,
} from "./character-profile";
import styles from "./CharacterCreationV1.module.css";

type CreatorTab = "hair" | "face" | "body" | "outfit" | "accessory" | "shoes";

type Choice = {
  id: string;
  label: string;
  available: boolean;
  note?: string;
};

const HAIR_STYLES: Choice[] = [
  { id: "female-bob-01", label: "Bob ngắn", available: true },
  { id: "female-long-01", label: "Tóc dài", available: false, note: "Cần asset" },
  { id: "female-braid-01", label: "Tóc tết", available: false, note: "Cần asset" },
];

const HAIR_COLORS: Choice[] = [
  { id: "brown", label: "Nâu", available: true },
  { id: "black", label: "Đen", available: false, note: "Cần texture variant" },
  { id: "violet", label: "Tím", available: false, note: "Cần texture variant" },
  { id: "silver", label: "Bạc", available: false, note: "Cần texture variant" },
];

const SKIN_TONES: Choice[] = [
  { id: "warm", label: "Ấm", available: true },
  { id: "light", label: "Sáng", available: false, note: "Cần texture variant" },
  { id: "tan", label: "Nâu", available: false, note: "Cần texture variant" },
  { id: "deep", label: "Đậm", available: false, note: "Cần texture variant" },
];

const FACE_STYLES: Choice[] = [
  { id: "basic-01", label: "Cơ bản 01", available: true },
  { id: "basic-02", label: "Cơ bản 02", available: false, note: "Cần face variant" },
];

const NAME_SUGGESTIONS = ["Luna", "Yuna", "Mina", "Ari", "Nari", "Sora"];

const TABS: Array<{ id: CreatorTab; icon: string; label: string; locked?: boolean }> = [
  { id: "hair", icon: "◒", label: "Tóc" },
  { id: "face", icon: "◇", label: "Mặt" },
  { id: "body", icon: "◉", label: "Tạo hình" },
  { id: "outfit", icon: "♜", label: "Đồ", locked: true },
  { id: "accessory", icon: "∞", label: "Phụ kiện", locked: true },
  { id: "shoes", icon: "◜", label: "Giày", locked: true },
];

function ChoiceCard({
  choice,
  selected,
  onSelect,
  icon,
}: {
  choice: Choice;
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
  const [yaw, setYaw] = useState(-0.08);
  const [name, setName] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.name);
  const [hairStyle, setHairStyle] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.hairStyle);
  const [hairColor, setHairColor] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.hairColor);
  const [skinTone, setSkinTone] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.skinTone);
  const [face, setFace] = useState(DEFAULT_CHARACTER_CREATION_PROFILE.face);
  const [created, setCreated] = useState(false);
  const dragRef = useRef<{ id: number; x: number; yaw: number } | null>(null);

  const normalizedName = name.trim();
  const valid = normalizedName.length > 0;
  const profile = useMemo<CharacterCreationProfileV1>(() => ({
    version: 1,
    gender: "female",
    characterAssetId: "c1-casual-grace",
    hairStyle,
    hairColor,
    skinTone,
    face,
    name: normalizedName,
  }), [face, hairColor, hairStyle, normalizedName, skinTone]);

  useEffect(() => {
    try {
      const draft = loadCharacterCreationDraft(window.localStorage);
      if (!draft) return;
      setName(draft.name);
      setHairStyle(draft.hairStyle);
      setHairColor(draft.hairColor);
      setSkinTone(draft.skinTone);
      setFace(draft.face);
      setCreated(true);
    } catch {
      // Local draft restore is optional. Account/profile authority remains Phase 7.
    }
  }, []);

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
    <main className={styles.page} data-profile-version="1" data-testid="c2-character-creation">
      <section className={styles.phone}>
        <header className={styles.header}>
          <button aria-label="Quay lại" className={styles.headerIcon} type="button">‹</button>
          <div>
            <span>NEW DANCER</span>
            <strong>TẠO NHÂN VẬT</strong>
          </div>
          <button aria-label="Ngẫu nhiên" className={styles.headerIcon} onClick={randomize} type="button">◇</button>
        </header>

        <div className={styles.hero}>
          <nav className={styles.rail} aria-label="Tuỳ chỉnh nhân vật">
            {TABS.map(item => (
              <button
                aria-pressed={tab === item.id}
                className={[tab === item.id ? styles.railActive : "", item.locked ? styles.railLocked : ""].filter(Boolean).join(" ")}
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
              >
                <span>{item.icon}</span>
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
            <CharacterCreationStage3D focus={tab} yaw={yaw} />
          </div>

          <div className={styles.rotateHint} aria-hidden="true">
            <b>↔</b>
            <div><strong>Xoay nhân vật</strong><small>Kéo ngang để xem 360°</small></div>
          </div>

          <div className={styles.heroBadge}>
            <span>FEMALE STARTER</span>
            <strong>Casual Grace</strong>
            <small>C1.3 · playable MVP</small>
          </div>
        </div>

        <div className={styles.dock}>
          <div className={styles.panelTitle}>
            <div><span>C2 · STARTER CREATOR</span><strong>{TABS.find(item => item.id === tab)?.label}</strong></div>
            <small>Visual variants sẽ gắn vào cùng profile contract khi asset sẵn sàng.</small>
          </div>

          {tab === "hair" && (
            <div className={styles.optionStack}>
              <div>
                <label>MÀU TÓC</label>
                <div className={styles.swatches}>
                  {HAIR_COLORS.map(choice => (
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
                {HAIR_STYLES.map((choice, index) => (
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
              {FACE_STYLES.map((choice, index) => (
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
                <button className={styles.bodyActive} type="button">♀ Nữ</button>
                <button disabled type="button">♂ Nam <small>C2.2</small></button>
              </div>
              <div className={styles.bodyCard}>
                <label>MÀU DA</label>
                <div className={styles.swatches}>
                  {SKIN_TONES.map(choice => (
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
              <p>Slot đã được giữ theo Golden UI. Inventory / equipment / shop vẫn thuộc Phase 8–9, chưa giả lập ở C2.</p>
            </div>
          )}

          <div className={styles.nameField}>
            <div>
              <span>TÊN NHÂN VẬT</span>
              <input
                aria-label="Tên nhân vật"
                maxLength={14}
                onChange={event => { setName(event.target.value); setCreated(false); }}
                placeholder="Nhập tên nhân vật"
                value={name}
              />
            </div>
            <small>{name.length}/14</small>
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

          <div className={styles.footerNote}>
            <span>{created ? "Draft đã lưu trên thiết bị để QA." : "DANCE YOUR STORY ♡"}</span>
            <small>Chưa ghi account/Supabase; Profile authority thuộc Phase 7.</small>
          </div>
        </div>
      </section>
    </main>
  );
}
