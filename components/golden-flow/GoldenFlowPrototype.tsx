"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Stage3D from "../Stage3D";
import WaitingRoomStage3D from "../multiplayer/WaitingRoomStage3D";
import { createP53SyncedWaitingRoomBase } from "../../multiplayer/waiting-room-qa";
import type { RoomParticipant } from "../../multiplayer/types";
import styles from "./GoldenFlowPrototype.module.css";

type GoldenScreen =
  | "login"
  | "checking"
  | "create-character"
  | "rooms"
  | "lobby"
  | "preload"
  | "countdown"
  | "gameplay";

type Gender = "female" | "male";
type SkinTone = "light" | "warm" | "tan" | "deep";
type HairColor = "black" | "violet" | "brown" | "silver";
type HairStyle = "pony" | "bob" | "short" | "wave";
type CreatorCategory = "hair" | "outfit" | "accessory" | "shoes" | "body";

const ROOM_CARDS = [
  { id: "10321", title: "Hey Beautiful!", mode: "4/4", song: "Audition", bpm: 128, players: "6/8", locked: false, difficulty: "Dễ", cover: "heart" },
  { id: "10318", title: "Love Scenario", mode: "4/4", song: "Dance Crew", bpm: 110, players: "2/8", locked: false, difficulty: "Thường", cover: "couple" },
  { id: "10312", title: "Dynamite", mode: "4/4", song: "Neon Beat", bpm: 124, players: "5/8", locked: true, difficulty: "Khó", cover: "spark" },
  { id: "10308", title: "Perfect Night", mode: "4/4", song: "Moonlight", bpm: 120, players: "1/8", locked: false, difficulty: "Thường", cover: "moon" },
  { id: "10302", title: "Smoke", mode: "4/4", song: "Street Mix", bpm: 132, players: "7/8", locked: true, difficulty: "Khó", cover: "fire" },
  { id: "10297", title: "Super Shy", mode: "4/4", song: "Pop Star", bpm: 125, players: "3/8", locked: false, difficulty: "Dễ", cover: "star" },
] as const;

const SKIN_LABELS: Record<SkinTone, string> = {
  light: "Sáng",
  warm: "Ấm",
  tan: "Nâu",
  deep: "Đậm",
};

const HAIR_LABELS: Record<HairStyle, string> = {
  pony: "Tóc đuôi ngựa",
  bob: "Bob",
  short: "Tóc ngắn",
  wave: "Tóc gợn sóng",
};

function Arrow({ children, reverse = false }: { children: string; reverse?: boolean }) {
  return <b className={reverse ? styles.reverseArrow : styles.arrow}>{children}</b>;
}

function MiniAvatar({
  label,
  accent,
  crown = false,
}: {
  label: string;
  accent: "cyan" | "pink" | "gold" | "green";
  crown?: boolean;
}) {
  return (
    <span className={`${styles.miniAvatar} ${styles[`avatar_${accent}`]}`}>
      {crown && <i>♛</i>}
      {label}
    </span>
  );
}

export default function GoldenFlowPrototype() {
  const lobbyRoom = useMemo(() => createP53SyncedWaitingRoomBase("golden-flow-room"), []);
  const [screen, setScreen] = useState<GoldenScreen>("login");
  const [autoplay, setAutoplay] = useState(false);
  const [existingProfile, setExistingProfile] = useState(false);
  const [demoComplete, setDemoComplete] = useState(false);
  const [gender, setGender] = useState<Gender>("female");
  const [skinTone, setSkinTone] = useState<SkinTone>("warm");
  const [hairColor, setHairColor] = useState<HairColor>("violet");
  const [hairStyle, setHairStyle] = useState<HairStyle>("pony");
  const [creatorCategory, setCreatorCategory] = useState<CreatorCategory>("hair");
  const [characterName, setCharacterName] = useState("Luna");
  const [characterYaw, setCharacterYaw] = useState(0);
  const creatorDragRef = useRef<{ pointerId: number; startX: number; startYaw: number } | null>(null);
  const [preloadStep, setPreloadStep] = useState(0);
  const [countdownLabel, setCountdownLabel] = useState<"3" | "2" | "1" | "GO">("3");
  const [judgement, setJudgement] = useState(false);
  const [finishFlash, setFinishFlash] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const gameplayStartMsRef = useRef(0);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(timer => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const later = useCallback((delayMs: number, callback: () => void) => {
    const timer = window.setTimeout(callback, delayMs);
    timersRef.current.push(timer);
    return timer;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAutoplay(params.get("autoplay") === "1");
    setExistingProfile(params.get("profile") === "existing");
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const enterGameplay = useCallback(() => {
    gameplayStartMsRef.current = performance.now();
    setScreen("gameplay");
  }, []);

  const runMatchStartSequence = useCallback(() => {
    clearTimers();
    setPreloadStep(0);
    setCountdownLabel("3");
    setJudgement(false);
    setFinishFlash(false);
    setScreen("preload");

    later(850, () => setPreloadStep(1));
    later(1850, () => setPreloadStep(2));
    later(2850, () => setPreloadStep(3));
    later(3850, () => {
      setScreen("countdown");
      setCountdownLabel("3");
    });
    later(4850, () => setCountdownLabel("2"));
    later(5850, () => setCountdownLabel("1"));
    later(6850, () => setCountdownLabel("GO"));
    later(7550, enterGameplay);
    later(10250, () => setJudgement(true));
    later(11250, () => setJudgement(false));
    later(12800, () => setFinishFlash(true));
    later(14000, () => {
      setFinishFlash(false);
      setDemoComplete(true);
    });
  }, [clearTimers, enterGameplay, later]);

  useEffect(() => {
    if (!autoplay) return;

    clearTimers();
    setDemoComplete(false);
    setScreen("login");
    setCharacterName("Luna");
    setGender("female");
    setSkinTone("light");
    setHairColor("black");
    setHairStyle("bob");
    setCharacterYaw(0);

    later(1350, () => setScreen("checking"));

    if (existingProfile) {
      later(2200, () => setScreen("rooms"));
      later(5000, () => setScreen("lobby"));
      later(8500, runMatchStartSequence);
      return;
    }

    later(2200, () => setScreen("create-character"));
    later(3200, () => setSkinTone("warm"));
    later(4050, () => setHairColor("violet"));
    later(4950, () => setHairStyle("pony"));
    later(5850, () => setCharacterName("Luna"));
    later(7350, () => setScreen("rooms"));
    later(10400, () => setScreen("lobby"));
    later(13900, runMatchStartSequence);
  }, [autoplay, clearTimers, existingProfile, later, runMatchStartSequence]);

  const beginCreatorRotate = (event: ReactPointerEvent<HTMLDivElement>) => {
    creatorDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startYaw: characterYaw,
    };
  };

  const updateCreatorRotate = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = creatorDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    setCharacterYaw(drag.startYaw + deltaX * 0.012);
  };

  const endCreatorRotate = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = creatorDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    creatorDragRef.current = null;
  };

  const beginLogin = () => {
    clearTimers();
    setScreen("checking");
    later(720, () => setScreen(existingProfile ? "rooms" : "create-character"));
  };

  const confirmCharacter = () => {
    if (!characterName.trim()) return;
    setScreen("rooms");
  };

  const createRoom = () => {
    setSelectedRoomId(null);
    setScreen("lobby");
  };

  const creatorParticipant = useMemo<RoomParticipant>(() => {
    const base = lobbyRoom.participants[0];
    return {
      ...base,
      displayName: characterName || "New Dancer",
      avatar: {
        ...base.avatar,
        characterId: gender === "female" ? "default-female" : "default-male",
      },
    } as RoomParticipant;
  }, [characterName, gender, lobbyRoom.participants]);

  const lobbyParticipants = useMemo(() => {
    return lobbyRoom.participants.map(participant => {
      if (participant.role !== "host") return participant;
      return {
        ...participant,
        displayName: characterName || "Luna",
        avatar: {
          ...participant.avatar,
          characterId: gender === "female" ? "default-female" : "default-male",
        },
      } as RoomParticipant;
    });
  }, [characterName, gender, lobbyRoom.participants]);

  const renderBrand = (compact = false) => (
    <div className={compact ? styles.brandCompact : styles.brand}>
      <span>AUDITION</span>
      <strong>MOBILE</strong>
      {!compact && <small>DANCE TOGETHER</small>}
    </div>
  );

  const renderLogin = () => (
    <section className={styles.loginScreen} data-testid="golden-login">
      <div className={styles.loginAmbient} aria-hidden="true" />
      <div className={styles.loginScript} aria-hidden="true">Dance<br />Your<br />Story ♡</div>

      <div className={styles.loginHeroStage} aria-hidden="true">
        <WaitingRoomStage3D
          participants={[creatorParticipant]}
          slots={lobbyRoom.slots}
          roomId="golden-login-hero"
          stageId="neon-club"
          viewMode="close"
          pageIndex={0}
          pageSize={1}
          selectedParticipantId={creatorParticipant.participantId}
          selectedActorYawOffset={-0.18}
          presentationMode="character-preview"
        />
      </div>

      <div className={styles.loginLogoLockup}>
        {renderBrand()}
        <span>DANCE TOGETHER A BRIGHTER TOMORROW</span>
      </div>

      <div className={styles.loginActionsSketch}>
        <button
          className={styles.loginPrimarySketch}
          data-testid="golden-login-button"
          onClick={beginLogin}
          type="button"
        >
          Đăng nhập
        </button>
        <button className={styles.loginSecondarySketch} type="button">Đăng ký</button>
        <div className={styles.loginProvidersSketch}>
          <button aria-label="Google" type="button">G</button>
          <button aria-label="Apple" type="button"></button>
          <button aria-label="Facebook" type="button">f</button>
          <button aria-label="More" type="button">•••</button>
        </div>
        <small>Âm nhạc kết nối chúng ta ♡</small>
      </div>
    </section>
  );

  const renderChecking = () => (
    <section className={styles.checkingScreen} data-testid="golden-checking">
      {renderBrand(true)}
      <div className={styles.profileScan}>
        <div className={styles.spinner} />
        <strong>Đang tải hồ sơ...</strong>
        <span>{existingProfile ? "Đã tìm thấy nhân vật" : "Kiểm tra nhân vật của tài khoản"}</span>
      </div>
    </section>
  );

  const renderCharacterCreate = () => {
    const categories: Array<{ id: CreatorCategory; icon: string; label: string }> = [
      { id: "hair", icon: "◒", label: "Kiểu tóc" },
      { id: "outfit", icon: "♜", label: "Trang phục" },
      { id: "accessory", icon: "∞", label: "Phụ kiện" },
      { id: "shoes", icon: "◜", label: "Giày" },
      { id: "body", icon: "◉", label: "Tạo hình" },
    ];

    return (
      <section className={styles.creatorScreenSketch} data-testid="golden-create-character">
        <header className={styles.creatorHeaderSketch}>
          <button aria-label="Back" onClick={() => setScreen("login")} type="button">‹</button>
          <strong>TẠO NHÂN VẬT</strong>
          <button aria-label="Randomize" type="button">◇</button>
        </header>

        <div className={styles.creatorHeroSketch}>
          <nav className={styles.creatorRail} aria-label="Character categories">
            {categories.map(category => (
              <button
                className={creatorCategory === category.id ? styles.creatorRailActive : ""}
                key={category.id}
                onClick={() => setCreatorCategory(category.id)}
                type="button"
              >
                <span>{category.icon}</span>
                <small>{category.label}</small>
              </button>
            ))}
          </nav>

          <div
            className={styles.creatorViewportSketch}
            data-testid="golden-character-viewport"
            data-yaw={Math.round(characterYaw * 1000)}
            onPointerCancel={endCreatorRotate}
            onPointerDown={beginCreatorRotate}
            onPointerMove={updateCreatorRotate}
            onPointerUp={endCreatorRotate}
          >
            <WaitingRoomStage3D
              participants={[creatorParticipant]}
              slots={lobbyRoom.slots}
              roomId="golden-character-creator"
              stageId="neon-club"
              viewMode="close"
              pageIndex={0}
              pageSize={1}
              selectedParticipantId={creatorParticipant.participantId}
              selectedActorYawOffset={characterYaw}
              presentationMode="character-preview"
            />
          </div>

          <div className={styles.creatorRotateSketch}>
            <span>↔</span>
            <div><strong>Xoay nhân vật</strong><small>Drag to rotate</small></div>
          </div>
        </div>

        <div className={styles.creatorDock}>
          {creatorCategory === "hair" ? (
            <>
              <div className={styles.creatorHairColors}>
                <span>MÀU TÓC</span>
                {(["black", "violet", "brown", "silver"] as const).map(color => (
                  <button
                    aria-label={color}
                    className={`${styles.swatch} ${styles[`hair_${color}`]} ${hairColor === color ? styles.swatchSelected : ""}`}
                    key={color}
                    onClick={() => setHairColor(color)}
                    type="button"
                  />
                ))}
              </div>
              <div className={styles.creatorThumbStrip}>
                {(["pony", "bob", "short", "wave"] as const).map(style => (
                  <button
                    className={hairStyle === style ? styles.creatorThumbActive : styles.creatorThumb}
                    key={style}
                    onClick={() => setHairStyle(style)}
                    type="button"
                  >
                    <span>{style === "pony" ? "⑂" : style === "bob" ? "◖" : style === "short" ? "⌒" : "≈"}</span>
                    <small>{HAIR_LABELS[style]}</small>
                  </button>
                ))}
              </div>
            </>
          ) : creatorCategory === "body" ? (
            <div className={styles.creatorBodyPanel}>
              <div>
                <span>GIỚI TÍNH</span>
                <button className={gender === "female" ? styles.bodyChoiceActive : ""} onClick={() => setGender("female")} type="button">♀ Nữ</button>
                <button className={gender === "male" ? styles.bodyChoiceActive : ""} onClick={() => setGender("male")} type="button">♂ Nam</button>
              </div>
              <div>
                <span>MÀU DA</span>
                <div className={styles.creatorSkinRow}>
                  {(["light", "warm", "tan", "deep"] as const).map(tone => (
                    <button
                      aria-label={SKIN_LABELS[tone]}
                      className={`${styles.swatch} ${styles[`skin_${tone}`]} ${skinTone === tone ? styles.swatchSelected : ""}`}
                      key={tone}
                      onClick={() => setSkinTone(tone)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.creatorLockedCategory}>
              <strong>{categories.find(item => item.id === creatorCategory)?.label}</strong>
              <span>Bộ cơ bản sẽ được mở ở phase Cosmetics. Visual slot đã khóa theo sketch.</span>
            </div>
          )}

          <div className={styles.creatorNameSketch}>
            <input
              maxLength={14}
              onChange={event => setCharacterName(event.target.value)}
              placeholder="Tên nhân vật"
              value={characterName}
            />
            <button aria-label="Edit name" type="button">✎</button>
          </div>

          <button
            className={styles.creatorCreateSketch}
            data-testid="golden-confirm-character"
            disabled={!characterName.trim()}
            onClick={confirmCharacter}
            type="button"
          >
            Tạo nhân vật
          </button>
          <small className={styles.creatorTagline}>DANCE YOUR STORY ♡</small>
        </div>
      </section>
    );
  };

  const renderRooms = () => (
    <section className={styles.roomsScreenSketch} data-testid="golden-rooms">
      <header className={styles.roomsHeaderSketch}>
        <div className={styles.roomsProfile}>
          <MiniAvatar label={(characterName || "L").slice(0, 1).toUpperCase()} accent="pink" />
          <div>
            <strong>{characterName || "Luna"}</strong>
            <span>Lv. 25</span>
          </div>
        </div>

        <div className={styles.roomsWallet}>
          <span><i>◉</i><b>12,450</b></span>
          <span><i>◆</i><b>1,260</b></span>
          <button aria-label="Add currency" type="button">＋</button>
        </div>
      </header>

      <div className={styles.roomsTabsSketch}>
        <button className={styles.roomsTabActive} type="button">Phòng</button>
        <button type="button">Giải trí</button>
        <button type="button">Bạn bè</button>
      </div>

      <div className={styles.roomsFilters}>
        <button className={styles.roomFilterActive} type="button">Tất cả</button>
        <button type="button">Solo</button>
        <button type="button">Team</button>
        <button type="button">Đang chơi</button>
      </div>

      <div className={styles.roomsScroll}>
        <button
          className={styles.createRoomHero}
          data-testid="golden-create-room"
          onClick={createRoom}
          type="button"
        >
          <span className={styles.createRoomPlus}>＋</span>
          <div>
            <strong>Tạo phòng</strong>
            <small>Tự do thiết lập, chơi cùng bạn bè</small>
          </div>
          <b>›</b>
        </button>

        <div className={styles.roomListSketch}>
          {ROOM_CARDS.map((room, index) => (
            <button
              className={selectedRoomId === room.id ? styles.roomCardSketchSelected : styles.roomCardSketch}
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              type="button"
            >
              <div className={`${styles.roomArt} ${styles[`roomArt_${room.cover}`]}`}>
                <span>{index === 0 ? "♡" : index === 1 ? "♬" : index === 2 ? "✦" : index === 3 ? "☾" : index === 4 ? "⌁" : "★"}</span>
                <i />
              </div>

              <div className={styles.roomCardMain}>
                <div className={styles.roomCardTitle}>
                  <strong>{room.title}</strong>
                  <span className={styles.roomSignal}>▥</span>
                </div>
                <div className={styles.roomMetaLine}>
                  <span>BPM {room.bpm}</span>
                  <em>{room.mode}</em>
                </div>
                <div className={styles.roomBadges}>
                  <span className={
                    room.difficulty === "Dễ"
                      ? styles.roomEasy
                      : room.difficulty === "Khó"
                        ? styles.roomHard
                        : styles.roomNormal
                  }>{room.difficulty}</span>
                  <span className={styles.roomPeople}>{room.locked ? "🔒" : "♟"} {room.players}</span>
                </div>
              </div>

              <span className={styles.roomChevron}>›</span>
            </button>
          ))}
        </div>
      </div>

      <nav className={styles.roomsBottomNav} aria-label="Main navigation">
        <button className={styles.roomsNavActive} type="button"><span>⌂</span><small>Phòng</small></button>
        <button type="button"><span>◇</span><small>Shop</small></button>
        <button type="button"><span>▣</span><small>Túi đồ</small></button>
        <button type="button"><span>♙</span><small>Bạn bè</small></button>
      </nav>
    </section>
  );

  const renderLobby = () => (
    <section className={styles.lobbyScreen} data-testid="golden-lobby">
      <header className={styles.lobbyHeader}>
        <button type="button">‹</button>
        <div>
          <strong>Phòng của {characterName || "Luna"}</strong>
          <span>ID: 10428 · Solo Easy · 2/6</span>
        </div>
        <i>● HOST</i>
      </header>

      <div className={styles.lobbyStage}>
        <div className={styles.lobbyLogo}>AUDITION <small>DANCE TOGETHER</small></div>
        <WaitingRoomStage3D
          participants={lobbyParticipants}
          slots={lobbyRoom.slots}
          roomId="golden-flow-room"
          stageId="neon-club"
          viewMode="center"
          pageIndex={0}
          pageSize={2}
          selectedParticipantId={lobbyParticipants[0]?.participantId ?? null}
        />
      </div>

      <div className={styles.slotStrip}>
        <div><MiniAvatar label="L" accent="gold" crown /><span>HOST</span></div>
        <div><MiniAvatar label="S" accent="green" /><span>READY</span></div>
        <div><MiniAvatar label="+" accent="cyan" /><span>OPEN</span></div>
        <div><MiniAvatar label="+" accent="cyan" /><span>OPEN</span></div>
        <div><MiniAvatar label="×" accent="pink" /><span>CLOSED</span></div>
        <div><MiniAvatar label="+" accent="cyan" /><span>OPEN</span></div>
      </div>

      <div className={styles.songCard}>
        <div className={styles.songCover}>A</div>
        <div>
          <strong>Aloha</strong>
          <span>Audition · BPM 101 · 02:45</span>
          <small>EASY</small>
        </div>
        <button type="button">♫ Đổi nhạc</button>
      </div>

      <div className={styles.lobbyActions}>
        <button type="button">↪ RỜI PHÒNG</button>
        <button type="button">♜ ĐỔI SÂN KHẤU</button>
        <button data-testid="golden-start" onClick={runMatchStartSequence} type="button">♛ BẮT ĐẦU</button>
      </div>
    </section>
  );

  const renderPreloadOverlay = () => {
    const rows = [
      { label: "Thiết lập trận đấu", doneAt: 1 },
      { label: "Nhạc & biểu đồ nhịp", doneAt: 2 },
      { label: "Nhân vật & animation", doneAt: 3 },
    ];

    return (
      <div className={styles.preloadOverlay} data-testid="golden-preload">
        <div className={styles.preloadCard}>
          <span className={styles.kicker}>MATCH PREPARATION</span>
          <h2>{preloadStep < 3 ? "ĐANG CHUẨN BỊ TRẬN" : "TẤT CẢ ĐÃ SẴN SÀNG"}</h2>
          <p>Đồng bộ nội dung trước khi vào gameplay.</p>
          <div className={styles.progressTrack}><i style={{ width: `${Math.min(100, (preloadStep / 3) * 100)}%` }} /></div>
          <div className={styles.preloadRows}>
            {rows.map(row => {
              const done = preloadStep >= row.doneAt;
              return <div className={done ? styles.preloadDone : ""} key={row.label}><span>{done ? "✓" : "•"}</span>{row.label}<b>{done ? "LOADED" : "LOADING"}</b></div>;
            })}
          </div>
          <small>{preloadStep >= 3 ? "ALL CLIENTS LOADED" : "Không bắt đầu cho đến khi mọi client sẵn sàng."}</small>
        </div>
      </div>
    );
  };

  const renderCountdownOverlay = () => (
    <div className={styles.countdownOverlay} data-testid="golden-countdown">
      <span>{countdownLabel}</span>
      <small>GET READY</small>
    </div>
  );

  const renderGameplay = () => {
    const finish = finishFlash;
    return (
      <section className={styles.gameplayScreen} data-testid="golden-gameplay">
        <div className={styles.gameplayStage}>
          <Stage3D
            cameraPreset="center"
            isPlaying
            getSongTimeMs={() => Math.max(0, performance.now() - gameplayStartMsRef.current)}
          />
        </div>

        <header className={styles.gameHudTop}>
          <div className={styles.trackThumb}>A</div>
          <div className={styles.trackMeta}><strong>Aloha</strong><span>♪ 101 BPM · EASY</span></div>
          <div className={styles.levelBadge}><span>LEVEL</span><strong>{finish ? 9 : 6}</strong></div>
          <div className={styles.scoreBox}><span>SCORE</span><strong>128,450</strong></div>
        </header>

        <div className={styles.missionBar}>
          <span>MISSION</span>
          <strong>PERFECT × 2</strong>
          <i>2 / 3</i>
        </div>

        {judgement && <div className={styles.perfectJudgement}>PERFECT</div>}

        <div className={finish ? styles.finishCommand : styles.commandStrip}>
          <div className={styles.commandTitle}>{finish ? "FINISH" : "LEVEL 6"}</div>
          <div className={styles.arrowRow}>
            <Arrow>←</Arrow>
            <Arrow>↑</Arrow>
            <Arrow reverse={finish}>{finish ? "←" : "↓"}</Arrow>
            <Arrow>→</Arrow>
            <Arrow>↑</Arrow>
          </div>
        </div>

        <div className={styles.spaceGauge}>
          <span className={styles.gaugeLeft}>BAD</span>
          <div className={styles.gaugeTrack}>
            <i className={styles.coolZone} />
            <i className={styles.greatZone} />
            <i className={styles.perfectZone} />
            <b />
          </div>
          <span className={styles.gaugeRight}>BAD</span>
        </div>

        <div className={styles.gameBottom}>
          <div className={styles.dpad}>
            <button type="button">←</button><button type="button">↑</button><button type="button">↓</button><button type="button">→</button>
          </div>
          <button className={styles.spaceButton} type="button">SPACE</button>
          <div className={styles.combo}><span>COMBO</span><strong>12</strong></div>
        </div>
      </section>
    );
  };

  let body;
  if (screen === "login") body = renderLogin();
  else if (screen === "checking") body = renderChecking();
  else if (screen === "create-character") body = renderCharacterCreate();
  else if (screen === "rooms") body = renderRooms();
  else if (screen === "gameplay") body = renderGameplay();
  else {
    body = (
      <div className={styles.lobbyWithOverlay}>
        {renderLobby()}
        {screen === "preload" && renderPreloadOverlay()}
        {screen === "countdown" && renderCountdownOverlay()}
      </div>
    );
  }

  return (
    <main
      className={styles.shell}
      data-demo-complete={demoComplete ? "1" : "0"}
      data-golden-screen={screen}
      data-testid="golden-flow-root"
    >
      <div className={styles.phone}>{body}</div>
      <div className={styles.prototypeMark}>
        GOLDEN FLOW · SOURCE OF TRUTH PROTOTYPE
      </div>
    </main>
  );
}
