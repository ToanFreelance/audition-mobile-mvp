"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  canStartRoom,
  changeMode,
  changeSong,
  changeStage,
  closeSlot,
  openSlot,
  removeParticipant,
  setGuestReady,
} from "../../multiplayer/room-state";
import { applyServerRoomSnapshot, isCanonicalRoomSnapshot } from "../../multiplayer/room-sync";
import { latchLobbyPresence, projectRoomForPresence } from "../../multiplayer/lobby-presence";
import { SupabaseRealtimeRoomTransport } from "../../multiplayer/supabase-realtime-transport";
import type { RoomTransportStatus } from "../../multiplayer/transport";
import {
  createP51WaitingRoomFixture,
  createP53QaGuestParticipant,
  createP53SyncedWaitingRoomBase,
} from "../../multiplayer/waiting-room-qa";
import type { RoomParticipant, RoomSlotIndex, RoomState } from "../../multiplayer/types";
import WaitingRoomStage3D, { type WaitingRoomStageView } from "./WaitingRoomStage3D";
import styles from "./WaitingRoomPanel.module.css";

type PanelKind = "song" | "stage" | "player" | null;
type SyncClientRole = "host" | "guest";
type LobbySyncOptions = {
  enabled: true;
  roomId: string;
  participantId: string;
  role: SyncClientRole;
};
type RealtimeConfig = {
  transport: "supabase-realtime";
  protocolVersion: 1;
  supabaseUrl: string;
  publishableKey: string;
};

type RoomApiResponse = {
  ok: boolean;
  snapshot?: RoomState | null;
  error?: string;
};

type RoomMutationResult = {
  snapshot: RoomState;
  conflict: boolean;
};

async function postRoomMutation(payload: Record<string, unknown>, timeoutMs = 8000): Promise<RoomMutationResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/multiplayer/room", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json() as RoomApiResponse;
    if (data.snapshot && isCanonicalRoomSnapshot(data.snapshot) && response.status === 409) {
      return { snapshot: data.snapshot, conflict: true };
    }
    if (!response.ok || !data.ok || !data.snapshot) {
      throw new Error(data.error ?? `Room mutation failed (${response.status}).`);
    }
    if (!isCanonicalRoomSnapshot(data.snapshot)) throw new Error("Server returned an invalid room snapshot.");
    return { snapshot: data.snapshot, conflict: false };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Room update timed out. Please retry.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchRoomSnapshot(roomId: string, timeoutMs = 8000): Promise<RoomState> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/multiplayer/room?roomId=${encodeURIComponent(roomId)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json() as RoomApiResponse;
    if (!response.ok || !data.ok || !data.snapshot) {
      throw new Error(data.error ?? `Room fetch failed (${response.status}).`);
    }
    if (!isCanonicalRoomSnapshot(data.snapshot)) throw new Error("Server returned an invalid room snapshot.");
    return data.snapshot;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Room refresh timed out. Please retry.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

type SongOption = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: string;
  difficulty: "Easy" | "Normal" | "Hard";
  playable: boolean;
  accent: string;
};

const SONGS: readonly SongOption[] = [
  { id: "aloha", title: "Aloha", artist: "Audition", bpm: 101, duration: "02:45", difficulty: "Easy", playable: true, accent: "A" },
  { id: "please-tell-me-why", title: "Please Tell Me Why", artist: "Audition", bpm: 80, duration: "04:26", difficulty: "Easy", playable: true, accent: "P" },
  { id: "hey-beautiful", title: "Hey Beautiful", artist: "Audition", bpm: 128, duration: "02:45", difficulty: "Easy", playable: false, accent: "H" },
  { id: "in-my-arms", title: "In My Arms", artist: "Kylie Minogue", bpm: 128, duration: "03:20", difficulty: "Normal", playable: false, accent: "I" },
  { id: "beat-city", title: "Beat City", artist: "Audition", bpm: 120, duration: "02:30", difficulty: "Hard", playable: false, accent: "B" },
  { id: "party-summer-night", title: "Party Summer Night", artist: "Audition", bpm: 96, duration: "02:18", difficulty: "Easy", playable: false, accent: "S" },
];

const STAGES = [
  { id: "studio-81", name: "Studio 81", detail: "Classic neon club", icon: "◫" },
  { id: "neon-club", name: "Neon Club", detail: "Blue & magenta arena", icon: "◇" },
  { id: "purple-hall", name: "Purple Hall", detail: "Deep violet showcase", icon: "✦" },
  { id: "city-night", name: "City Night", detail: "Skyline dance floor", icon: "▤" },
] as const;

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function statusLabel(participant: RoomParticipant) {
  if (participant.role === "host") return "HOST";
  if (participant.kind === "bot") return "READY";
  return participant.readyState === "ready" ? "READY" : "NOT READY";
}

function levelFor(participant: RoomParticipant) {
  if (participant.role === "host") return 25;
  if (participant.participantId === "p51-guest") return 18;
  return participant.kind === "bot" ? 16 : 12;
}

function modeLabel(modeId: string) {
  return modeId === "solo-easy-battle" ? "Solo Easy" : modeId === "team-easy" ? "Team Easy" : modeId;
}

type WaitingRoomPanelProps = {
  initialSync?: {
    roomId: string;
    role: SyncClientRole;
  } | null;
};


export default function WaitingRoomPanel({ initialSync = null }: WaitingRoomPanelProps) {
  const initialParticipantId = initialSync?.role === "guest" ? "p51-guest" : "p51-host";
  const [room, setRoom] = useState(() => initialSync
    ? createP53SyncedWaitingRoomBase(initialSync.roomId)
    : createP51WaitingRoomFixture());
  const [viewParticipantId, setViewParticipantId] = useState(
    initialSync ? initialParticipantId : room.hostParticipantId,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stagePage, setStagePage] = useState(0);
  const [viewMode, setViewMode] = useState<WaitingRoomStageView>("center");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(
    initialSync ? initialParticipantId : room.hostParticipantId,
  );
  const [panel, setPanel] = useState<PanelKind>(null);
  const [songDraft, setSongDraft] = useState(room.selectedSongId ?? "aloha");
  const [stageDraft, setStageDraft] = useState(room.selectedStageId);
  const [songSearch, setSongSearch] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [syncOptions, setSyncOptions] = useState<LobbySyncOptions | null>(() => initialSync
    ? {
        enabled: true,
        roomId: initialSync.roomId,
        participantId: initialParticipantId,
        role: initialSync.role,
      }
    : null);
  const [syncStatus, setSyncStatus] = useState<RoomTransportStatus>("idle");
  const [syncDetail, setSyncDetail] = useState<string | null>(null);
  const [readyIntentPending, setReadyIntentPending] = useState(false);
  const [leaveIntentPending, setLeaveIntentPending] = useState(false);
  const [leftRoom, setLeftRoom] = useState(false);
  const [presentParticipantIds, setPresentParticipantIds] = useState<readonly string[]>(
    initialSync ? [initialParticipantId] : [],
  );
  const roomRef = useRef(room);
  const transportRef = useRef<SupabaseRealtimeRoomTransport | null>(null);


  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (initialSync) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("sync") !== "1") return;

    const role: SyncClientRole = params.get("client") === "guest" ? "guest" : "host";
    const participantId = role === "guest" ? "p51-guest" : "p51-host";
    const requestedRoomId = params.get("room")?.trim() || "p53-room";
    const syncedRoom = createP53SyncedWaitingRoomBase(requestedRoomId);

    setRoom(syncedRoom);
    roomRef.current = syncedRoom;
    setViewParticipantId(participantId);
    setSelectedParticipantId(participantId);
    setPresentParticipantIds([participantId]);
    setLeftRoom(false);
    setSyncOptions({ enabled: true, roomId: requestedRoomId, participantId, role });
  }, [initialSync]);

  useEffect(() => {
    if (!syncOptions) return;

    let disposed = false;
    let transport: SupabaseRealtimeRoomTransport | null = null;
    let resumePromise: Promise<void> | null = null;
    let lastResumeAt = 0;
    let guestJoinedThisSession = false;
    const cleanups: Array<() => void> = [];
    let confirmedPresenceIds: readonly string[] = [syncOptions.participantId];

    const commitConfirmedPresence = () => {
      if (disposed) return;
      setPresentParticipantIds(confirmedPresenceIds);
    };

    const applyCanonicalSnapshot = (snapshot: RoomState) => {
      if (disposed) return;
      if (snapshot.roomId !== syncOptions.roomId || !isCanonicalRoomSnapshot(snapshot)) {
        setSyncDetail("Rejected invalid server room snapshot.");
        return;
      }
      if (snapshot.revision < roomRef.current.revision) return;

      roomRef.current = snapshot;
      setRoom(snapshot);
      setReadyIntentPending(false);

      const memberIds = new Set(snapshot.participants.map(item => item.participantId));
      confirmedPresenceIds = confirmedPresenceIds.filter(
        participantId => participantId === syncOptions.participantId || memberIds.has(participantId),
      );
      commitConfirmedPresence();

      if (syncOptions.role === "guest") {
        const localStillPresent = snapshot.participants.some(
          item => item.participantId === syncOptions.participantId,
        );
        if (localStillPresent) {
          guestJoinedThisSession = true;
        } else if (guestJoinedThisSession) {
          setSyncDetail("This participant was removed from the room.");
        }
      }
    };

    const ensureGuestJoined = async (initialSnapshot: RoomState) => {
      if (syncOptions.role !== "guest") return initialSnapshot;
      if (initialSnapshot.participants.some(item => item.participantId === syncOptions.participantId)) {
        guestJoinedThisSession = true;
        return initialSnapshot;
      }
      if (guestJoinedThisSession) return initialSnapshot;

      const guest = createP53QaGuestParticipant();
      let current = initialSnapshot;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await postRoomMutation({
          action: "join",
          roomId: syncOptions.roomId,
          expectedRevision: current.revision,
          participantId: guest.participantId,
          displayName: guest.displayName,
          slotIndex: guest.slotIndex,
          characterId: guest.avatar.characterId,
        });
        current = result.snapshot;
        applyCanonicalSnapshot(current);

        if (current.participants.some(item => item.participantId === syncOptions.participantId)) {
          guestJoinedThisSession = true;
          return current;
        }
        if (!result.conflict) break;
      }

      throw new Error("Guest could not join the current room state.");
    };

    const ensureTransportConnected = async (forceReconnect = false) => {
      if (!transport) return;
      if (forceReconnect && transport.status === "connected") {
        transport.disconnect();
      } else if (transport.status === "error") {
        transport.disconnect();
      }
      if (transport.status === "connected") return;
      if (transport.status === "connecting") return;
      await transport.connect();
    };

    const refreshCanonicalRoom = async () => {
      const latest = await fetchRoomSnapshot(syncOptions.roomId);
      applyCanonicalSnapshot(latest);
      return ensureGuestJoined(latest);
    };

    const resumeFromServer = (forceReconnect = true) => {
      if (disposed) return Promise.resolve();
      if (resumePromise) return resumePromise;

      const now = Date.now();
      if (now - lastResumeAt < 700) return Promise.resolve();
      lastResumeAt = now;

      resumePromise = (async () => {
        try {
          setSyncDetail("Refreshing canonical room…");
          await ensureTransportConnected(forceReconnect);
          if (disposed) return;
          await refreshCanonicalRoom();
          if (disposed) return;
          setSyncStatus(transport?.status === "connected" ? "connected" : "disconnected");
          setSyncDetail("Canonical room refreshed.");
        } catch (error) {
          if (disposed) return;
          setReadyIntentPending(false);
          setSyncStatus(transport?.status === "connected" ? "connected" : "error");
          setSyncDetail(error instanceof Error ? error.message : "Room refresh failed.");
        } finally {
          resumePromise = null;
        }
      })();

      return resumePromise;
    };

    const connect = async () => {
      try {
        setSyncStatus("connecting");
        setSyncDetail("Connecting authoritative room…");

        const configResponse = await fetch("/api/multiplayer/realtime-config", { cache: "no-store" });
        if (!configResponse.ok) throw new Error(`Realtime config failed (${configResponse.status}).`);
        const config = await configResponse.json() as RealtimeConfig;
        if (disposed) return;

        const bootstrapResult = await postRoomMutation({
          action: "bootstrap",
          roomId: syncOptions.roomId,
        });
        if (disposed) return;

        applyCanonicalSnapshot(bootstrapResult.snapshot);
        const joinedSnapshot = await ensureGuestJoined(bootstrapResult.snapshot);
        if (disposed) return;

        const localParticipant = syncOptions.role === "guest"
          ? createP53QaGuestParticipant()
          : joinedSnapshot.participants.find(item => item.participantId === syncOptions.participantId);
        if (!localParticipant) throw new Error("Local sync participant is unavailable.");

        transport = new SupabaseRealtimeRoomTransport({
          supabaseUrl: config.supabaseUrl,
          publishableKey: config.publishableKey,
          roomId: syncOptions.roomId,
          presence: {
            participantId: localParticipant.participantId,
            displayName: localParticipant.displayName,
            kind: localParticipant.kind,
            role: localParticipant.role,
            roomRevision: joinedSnapshot.revision,
          },
        });
        transportRef.current = transport;

        cleanups.push(transport.onStatus((status, detail) => {
          if (disposed) return;
          setSyncStatus(status);
          if (detail) setSyncDetail(detail);
        }));

        cleanups.push(transport.onPresence(presence => {
          if (disposed) return;

          // Presence is a discovery signal, not room membership authority.
          // Once a remote participant has been observed online in this page
          // session, keep it latched while the authoritative RoomState still
          // contains that participant. iOS may suspend Safari/Chrome for an
          // arbitrary duration and temporarily drop realtime presence.
          confirmedPresenceIds = latchLobbyPresence(
            confirmedPresenceIds,
            presence.map(item => item.participantId),
            syncOptions.participantId,
          );
          commitConfirmedPresence();
        }));

        cleanups.push(transport.onEvent(event => {
          if (disposed || event.payload.kind !== "server-room-snapshot") return;
          const result = applyServerRoomSnapshot(roomRef.current, event.senderParticipantId, event.payload);
          if (!result.accepted) {
            if (result.reason !== "stale-revision") {
              setSyncDetail(`Server snapshot rejected: ${result.reason}.`);
            }
            return;
          }
          applyCanonicalSnapshot(result.room);
        }));

        await transport.connect();
        if (disposed) return;

        await refreshCanonicalRoom();
        if (disposed) return;

        setSyncStatus("connected");
        setSyncDetail("Server-authoritative room synced.");

        const handleForeground = () => {
          if (document.visibilityState === "visible") void resumeFromServer(true);
        };
        const handlePageShow = () => void resumeFromServer(true);
        const handleFocus = () => {
          if (document.visibilityState === "visible") void resumeFromServer(true);
        };

        document.addEventListener("visibilitychange", handleForeground);
        window.addEventListener("pageshow", handlePageShow);
        window.addEventListener("focus", handleFocus);
        cleanups.push(() => document.removeEventListener("visibilitychange", handleForeground));
        cleanups.push(() => window.removeEventListener("pageshow", handlePageShow));
        cleanups.push(() => window.removeEventListener("focus", handleFocus));
      } catch (error) {
        if (disposed) return;
        setReadyIntentPending(false);
        setSyncStatus("error");
        setSyncDetail(error instanceof Error ? error.message : "Authoritative room sync failed.");
      }
    };

    void connect();

    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
      if (transportRef.current === transport) transportRef.current = null;
      transport?.disconnect();
    };
  }, [syncOptions]);

  const displayRoom = useMemo(
    () => syncOptions
      ? projectRoomForPresence(room, presentParticipantIds, syncOptions.participantId)
      : room,
    [presentParticipantIds, room, syncOptions],
  );
  const viewer = room.participants.find(item => item.participantId === viewParticipantId)
    ?? (syncOptions?.role === "guest" ? createP53QaGuestParticipant() : room.participants[0]);
  const hostView = syncOptions ? syncOptions.role === "host" : viewer.participantId === room.hostParticipantId;
  const startGate = useMemo(() => canStartRoom(displayRoom), [displayRoom]);
  const participantById = useMemo(
    () => new Map(displayRoom.participants.map(item => [item.participantId, item])),
    [displayRoom.participants],
  );
  const orderedParticipants = useMemo(
    () => [...displayRoom.participants].sort((a, b) => a.slotIndex - b.slotIndex),
    [displayRoom.participants],
  );
  const selectedParticipant = selectedParticipantId
    ? displayRoom.participants.find(item => item.participantId === selectedParticipantId) ?? null
    : null;
  const stagePageCount = Math.max(1, Math.ceil(orderedParticipants.length / 2));
  const safeStagePage = Math.min(stagePage, stagePageCount - 1);
  const currentSong = SONGS.find(song => song.id === room.selectedSongId) ?? SONGS[0];
  const currentStage = STAGES.find(stage => stage.id === room.selectedStageId) ?? STAGES[0];
  const filteredSongs = SONGS.filter(song =>
    !songSearch.trim()
    || `${song.title} ${song.artist} ${song.bpm}`.toLowerCase().includes(songSearch.trim().toLowerCase()),
  );

  const adoptServerSnapshot = (snapshot: RoomState) => {
    if (snapshot.roomId !== room.roomId || !isCanonicalRoomSnapshot(snapshot)) {
      throw new Error("Server returned an invalid room snapshot.");
    }
    roomRef.current = snapshot;
    setRoom(snapshot);
  };

  const runServerMutation = async (payload: Record<string, unknown>, successDetail?: string) => {
    if (!syncOptions) throw new Error("Realtime room sync is not enabled.");
    const result = await postRoomMutation({
      roomId: syncOptions.roomId,
      ...payload,
    });
    adoptServerSnapshot(result.snapshot);
    if (result.conflict) {
      setSyncDetail("Room changed on another client. State refreshed; retry the action.");
    } else if (successDetail) {
      setSyncDetail(successDetail);
    }
    return result;
  };

  const toggleSlot = (slotIndex: RoomSlotIndex) => {
    if (!hostView) return;
    const slot = room.slots.find(item => item.slotIndex === slotIndex);
    if (!slot || slot.state === "occupied") return;

    if (syncOptions) {
      void runServerMutation({
        action: slot.state === "open" ? "close-slot" : "open-slot",
        expectedRevision: room.revision,
        actorParticipantId: room.hostParticipantId,
        slotIndex,
      }, "Slot state synced.").catch(error => {
        setSyncDetail(error instanceof Error ? error.message : "Slot update failed.");
      });
      return;
    }

    setRoom(current => slot.state === "open"
      ? closeSlot(current, current.hostParticipantId, slotIndex)
      : openSlot(current, current.hostParticipantId, slotIndex));
  };

  const toggleReady = () => {
    if (viewer.kind !== "human" || viewer.role !== "guest") return;

    if (syncOptions) {
      if (syncOptions.role !== "guest" || viewer.participantId !== syncOptions.participantId || readyIntentPending) return;
      setReadyIntentPending(true);
      void runServerMutation({
        action: "ready",
        expectedRevision: room.revision,
        participantId: viewer.participantId,
        ready: viewer.readyState !== "ready",
      }, "Ready state synced.").catch(error => {
        setSyncDetail(error instanceof Error ? error.message : "Ready update failed.");
      }).finally(() => {
        setReadyIntentPending(false);
      });
      return;
    }

    setRoom(current => setGuestReady(current, viewer.participantId, viewer.readyState !== "ready"));
  };

  const leaveRoom = () => {
    if (leaveIntentPending || leftRoom) return;

    if (syncOptions) {
      if (syncOptions.role !== "guest") {
        setSyncDetail("Host leave requires a room-close/host-transfer flow and is not part of this demo.");
        return;
      }

      const localParticipant = room.participants.find(
        item => item.participantId === syncOptions.participantId,
      );
      if (!localParticipant) {
        setLeftRoom(true);
        setSyncDetail("Guest already left the room.");
        return;
      }

      setLeaveIntentPending(true);
      void runServerMutation({
        action: "leave",
        expectedRevision: room.revision,
        participantId: syncOptions.participantId,
      }, "Guest left the room.").then(() => {
        setLeftRoom(true);
        setReadyIntentPending(false);
        setPresentParticipantIds(current =>
          current.filter(participantId => participantId !== syncOptions.participantId)
        );
        setSelectedParticipantId(room.hostParticipantId);
        setPanel(null);
        transportRef.current?.disconnect();
        setSyncStatus("disconnected");
        setSyncDetail("Bạn đã rời phòng.");
      }).catch(error => {
        setSyncDetail(error instanceof Error ? error.message : "Leave room failed.");
      }).finally(() => {
        setLeaveIntentPending(false);
      });
      return;
    }

    if (viewer.kind === "human" && viewer.role === "guest") {
      setRoom(current => removeParticipant(current, viewer.participantId));
      setLeftRoom(true);
      setSelectedParticipantId(room.hostParticipantId);
      setPanel(null);
    }
  };

  const changeModeQa = () => {
    const nextMode = room.modeId === "solo-easy-battle" ? "team-easy" : "solo-easy-battle";
    if (syncOptions) {
      void runServerMutation({
        action: "mode",
        expectedRevision: room.revision,
        actorParticipantId: room.hostParticipantId,
        modeId: nextMode,
      }, "Mode synced; human guest Ready reset.").catch(error => {
        setSyncDetail(error instanceof Error ? error.message : "Mode update failed.");
      });
      return;
    }
    setRoom(current => changeMode(current, current.hostParticipantId, nextMode));
  };

  const previousStagePage = () => {
    if (viewMode === "close") {
      const currentIndex = Math.max(0, orderedParticipants.findIndex(item => item.participantId === selectedParticipantId));
      const nextIndex = (currentIndex - 1 + orderedParticipants.length) % orderedParticipants.length;
      setSelectedParticipantId(orderedParticipants[nextIndex]?.participantId ?? null);
      return;
    }
    setStagePage(current => (current - 1 + stagePageCount) % stagePageCount);
  };

  const nextStagePage = () => {
    if (viewMode === "close") {
      const currentIndex = Math.max(0, orderedParticipants.findIndex(item => item.participantId === selectedParticipantId));
      const nextIndex = (currentIndex + 1) % orderedParticipants.length;
      setSelectedParticipantId(orderedParticipants[nextIndex]?.participantId ?? null);
      return;
    }
    setStagePage(current => (current + 1) % stagePageCount);
  };

  const selectParticipant = (participant: RoomParticipant) => {
    setSelectedParticipantId(participant.participantId);
    setPanel("player");
    setActionNotice(null);
  };

  const openSongPicker = () => {
    if (!hostView) return;
    setSongDraft(room.selectedSongId ?? "aloha");
    setSongSearch("");
    setPanel("song");
  };

  const confirmSong = () => {
    const song = SONGS.find(item => item.id === songDraft);
    if (!hostView || !song?.playable) return;

    if (syncOptions) {
      void runServerMutation({
        action: "song",
        expectedRevision: room.revision,
        actorParticipantId: room.hostParticipantId,
        songId: song.id,
      }, "Song synced; human guest Ready reset.").then(() => {
        setPanel(null);
      }).catch(error => {
        setSyncDetail(error instanceof Error ? error.message : "Song update failed.");
      });
      return;
    }

    setRoom(current => changeSong(current, current.hostParticipantId, song.id));
    setPanel(null);
  };

  const openStagePicker = () => {
    if (!hostView) return;
    setStageDraft(room.selectedStageId);
    setPanel("stage");
  };

  const confirmStage = () => {
    if (!hostView) return;

    if (syncOptions) {
      void runServerMutation({
        action: "stage",
        expectedRevision: room.revision,
        actorParticipantId: room.hostParticipantId,
        stageId: stageDraft,
      }, "Stage synced; human guest Ready reset.").then(() => {
        setPanel(null);
      }).catch(error => {
        setSyncDetail(error instanceof Error ? error.message : "Stage update failed.");
      });
      return;
    }

    setRoom(current => changeStage(current, current.hostParticipantId, stageDraft));
    setPanel(null);
  };

  const kickSelectedParticipant = () => {
    if (!hostView || !selectedParticipant || selectedParticipant.participantId === room.hostParticipantId) return;
    const kickedId = selectedParticipant.participantId;

    const resetSelection = () => {
      setSelectedParticipantId(room.hostParticipantId);
      setPanel(null);
      setViewMode("center");
      setStagePage(0);
    };

    if (syncOptions) {
      void runServerMutation({
        action: "kick",
        expectedRevision: room.revision,
        actorParticipantId: room.hostParticipantId,
        participantId: kickedId,
      }, "Participant removed from the room.").then(resetSelection).catch(error => {
        setSyncDetail(error instanceof Error ? error.message : "Kick failed.");
      });
      return;
    }

    setRoom(current => removeParticipant(current, kickedId));
    resetSelection();
  };

  const playerAction = (label: string) => setActionNotice(`${label} sẽ được nối dữ liệu thật ở milestone tương ứng.`);

  return (
    <main className={styles.shell}>
      <section className={styles.phone}>
        <header className={styles.header}>
          <button className={styles.iconButton} type="button" aria-label="Back">‹</button>
          <div className={styles.titleBlock}>
            <strong>{room.roomName}</strong>
            <span>ID: {room.roomId} <i /> {modeLabel(room.modeId)} <i /> {displayRoom.participants.length}/{room.maxPlayers}</span>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.iconButton} onClick={() => setSettingsOpen(open => !open)} type="button" aria-label="Room settings">⚙</button>
            <small className={syncOptions ? (syncStatus === "connected" ? styles.syncLive : styles.syncOffline) : ""}>{syncOptions ? `${syncStatus === "connected" ? "●" : "○"} ${syncOptions.role === "host" ? "Host" : "Guest"}` : hostView ? "Host" : "Guest"}</small>
          </div>
        </header>

        {settingsOpen && (
          <aside className={styles.settingsPopover}>
            <strong>ROOM QA</strong>
            {syncOptions ? (
              <div className={styles.settingsMeta}>
                <span>Realtime · {syncStatus.toUpperCase()}</span>
                <span>Client · {syncOptions.role.toUpperCase()}</span>
                <span>Sync room · {syncOptions.roomId}</span>
                {syncDetail && <span>{syncDetail}</span>}
              </div>
            ) : (
              <div className={styles.settingsRow}>
                <span>View as</span>
                {room.participants.filter(item => item.kind === "human").map(participant => (
                  <button
                    className={participant.participantId === viewer.participantId ? styles.settingsSelected : styles.settingsButton}
                    key={participant.participantId}
                    onClick={() => setViewParticipantId(participant.participantId)}
                    type="button"
                  >
                    {participant.role === "host" ? "HOST" : "GUEST"}
                  </button>
                ))}
              </div>
            )}
            {hostView && <button className={styles.settingsAction} onClick={changeModeQa} type="button">Switch mode QA</button>}
            <div className={styles.settingsMeta}>
              <span>Stage · {currentStage.name}</span>
              <span>Start gate · {startGate.allowed ? "ENABLED" : startGate.reason}</span>
              <span>Revision · {room.revision}</span>
              <span>Host Ready · not-applicable</span>
            </div>
          </aside>
        )}

        <section className={styles.stageWrap}>
          <nav className={styles.viewModeBar} aria-label="Camera view">
            {(["wide", "center", "close"] as WaitingRoomStageView[]).map(mode => {
              const label = mode === "wide" ? "Wide view" : mode === "center" ? "Center view" : "Close view";
              const symbol = mode === "wide" ? "⠿" : mode === "center" ? "◉◉" : "◎";
              return (
                <button
                  aria-label={label}
                  aria-pressed={viewMode === mode}
                  className={viewMode === mode ? styles.viewModeActive : styles.viewModeButton}
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    if (mode === "close" && !selectedParticipantId) {
                      setSelectedParticipantId(orderedParticipants[0]?.participantId ?? null);
                    }
                  }}
                  title={label}
                  type="button"
                >
                  <span aria-hidden="true">{symbol}</span>
                </button>
              );
            })}
          </nav>
          <WaitingRoomStage3D
            participants={orderedParticipants}
            slots={displayRoom.slots}
            roomId={room.roomId}
            stageId={room.selectedStageId}
            viewMode={viewMode}
            pageIndex={safeStagePage}
            pageSize={2}
            selectedParticipantId={selectedParticipantId}
            onSelectParticipant={selectParticipant}
          />


          {viewMode !== "wide" && orderedParticipants.length > 1 && (
            <>
              <button className={`${styles.stageArrow} ${styles.stageArrowLeft}`} onClick={previousStagePage} type="button" aria-label="Previous participants">‹</button>
              <button className={`${styles.stageArrow} ${styles.stageArrowRight}`} onClick={nextStagePage} type="button" aria-label="Next participants">›</button>
            </>
          )}
          {viewMode === "center" && stagePageCount > 1 && (
            <div className={styles.stagePager} aria-hidden="true">
              {Array.from({ length: stagePageCount }, (_, index) => (
                <span className={index === safeStagePage ? styles.stageDotActive : styles.stageDot} key={index} />
              ))}
            </div>
          )}
        </section>

        <section className={styles.slotDock}>
          {displayRoom.slots.map(slot => {
            const participant = slot.state === "occupied" ? participantById.get(slot.participantId) : null;
            const status = participant ? statusLabel(participant) : slot.state.toUpperCase();
            const selected = participant?.participantId === selectedParticipantId;
            return (
              <button
                className={`${styles.slot} ${styles[slot.state]} ${participant?.role === "host" ? styles.slotHost : ""} ${selected ? styles.slotSelected : ""}`}
                disabled={!participant && !hostView}
                key={slot.slotIndex}
                onClick={() => participant ? selectParticipant(participant) : toggleSlot(slot.slotIndex)}
                type="button"
              >
                <span className={styles.slotNumber}>{slot.slotIndex + 1}</span>
                <span className={styles.slotAvatar}>{participant ? initials(participant.displayName) : slot.state === "open" ? "+" : "×"}</span>
                <strong>{status}</strong>
              </button>
            );
          })}
        </section>

        <section className={styles.songCard}>
          <div className={styles.cover}><span>{currentSong.accent}</span><b>{currentSong.title.slice(0, 8).toUpperCase()}</b></div>
          <div className={styles.songMeta}>
            <strong>{currentSong.title}</strong>
            <span>{currentSong.artist}</span>
            <small>BPM {currentSong.bpm} <i /> {currentSong.duration} <i /> <em>{currentSong.difficulty}</em></small>
          </div>
          {hostView && <button className={styles.changeSongButton} onClick={openSongPicker} type="button">♫ Đổi nhạc</button>}
        </section>

        <footer className={`${styles.actions} ${viewer.kind === "human" && viewer.role === "guest" ? styles.actionsGuest : ""}`}>
          <button
            className={styles.leaveButton}
            disabled={Boolean(hostView || leaveIntentPending || leftRoom)}
            onClick={leaveRoom}
            title={hostView ? "Host leave cần room-close/host-transfer flow." : undefined}
            type="button"
          >
            ↪ {leaveIntentPending ? "ĐANG RỜI..." : leftRoom ? "ĐÃ RỜI PHÒNG" : "Rời phòng"}
          </button>
          {viewer.kind === "human" && viewer.role === "guest" ? (
            <button
              className={viewer.readyState === "ready" ? styles.readyButtonActive : styles.readyButton}
              disabled={Boolean(
                readyIntentPending
                || leftRoom
                || (syncOptions?.role === "guest"
                  && !room.participants.some(item => item.participantId === syncOptions.participantId))
              )}
              onClick={toggleReady}
              type="button"
            >
              ✓ {readyIntentPending ? "ĐANG CẬP NHẬT" : viewer.readyState === "ready" ? "ĐÃ SẴN SÀNG" : "SẴN SÀNG"}
            </button>
          ) : (
            <button className={styles.stagePickerButton} onClick={openStagePicker} type="button">
              ♜ Đổi sân khấu
            </button>
          )}
          <button className={startGate.allowed && hostView ? styles.startButton : styles.startButtonDisabled} disabled={!hostView || !startGate.allowed} type="button">
            ▶ Bắt đầu
          </button>
        </footer>

        {panel && (
          <div className={styles.overlay} role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) setPanel(null);
          }}>
            {panel === "song" && (
              <section className={`${styles.sheet} ${styles.songSheet}`}>
                <div className={styles.sheetHeader}>
                  <div><small>CHỌN NHẠC</small><strong>Song Picker</strong></div>
                  <button onClick={() => setPanel(null)} type="button">×</button>
                </div>
                <div className={styles.songTabs}>
                  <button className={styles.chipActive} type="button">Tất cả</button>
                  <button type="button">Audition</button>
                  <button type="button">Hot</button>
                  <button type="button">Yêu thích</button>
                </div>
                <label className={styles.searchBox}>⌕<input value={songSearch} onChange={event => setSongSearch(event.target.value)} placeholder="Tìm nhạc, tên bài hát, nghệ sĩ…" /></label>
                <div className={styles.filterRow}>
                  <span>BPM⌄</span><span>Độ khó⌄</span><span>Mới nhất</span><span>↝</span>
                </div>
                <div className={styles.songList}>
                  {filteredSongs.map(song => (
                    <button
                      className={songDraft === song.id ? styles.songRowSelected : styles.songRow}
                      disabled={!song.playable}
                      key={song.id}
                      onClick={() => setSongDraft(song.id)}
                      type="button"
                    >
                      <span className={styles.songThumb}>{song.accent}</span>
                      <span className={styles.songRowText}><strong>{song.title}</strong><small>{song.artist}</small><em>{song.bpm} BPM · {song.duration}</em></span>
                      <span className={`${styles.difficulty} ${styles[`difficulty${song.difficulty}`]}`}>{song.difficulty}</span>
                      {!song.playable && <span className={styles.coming}>SOON</span>}
                    </button>
                  ))}
                </div>
                <div className={styles.sheetActions}>
                  <button className={styles.randomButton} type="button">⤨ Ngẫu nhiên</button>
                  <button className={styles.confirmButton} disabled={!SONGS.find(song => song.id === songDraft)?.playable} onClick={confirmSong} type="button">✓ Xác nhận</button>
                </div>
              </section>
            )}

            {panel === "stage" && (
              <section className={styles.sheet}>
                <div className={styles.sheetHeader}>
                  <div><small>SÂN KHẤU</small><strong>Chọn sân khấu</strong></div>
                  <button onClick={() => setPanel(null)} type="button">×</button>
                </div>
                <div className={styles.stageGrid}>
                  {STAGES.map(stage => (
                    <button
                      className={stageDraft === stage.id ? styles.stageCardSelected : styles.stageCard}
                      key={stage.id}
                      onClick={() => setStageDraft(stage.id)}
                      type="button"
                    >
                      <span>{stage.icon}</span>
                      <strong>{stage.name}</strong>
                      <small>{stage.detail}</small>
                    </button>
                  ))}
                </div>
                <p className={styles.sheetHint}>Đổi sân khấu là thay đổi match config và sẽ reset Ready của guest.</p>
                <div className={styles.sheetActions}>
                  <button className={styles.cancelButton} onClick={() => setPanel(null)} type="button">Hủy</button>
                  <button className={styles.confirmButton} onClick={confirmStage} type="button">✓ Xác nhận</button>
                </div>
              </section>
            )}

            {panel === "player" && selectedParticipant && (
              <section className={`${styles.sheet} ${styles.playerSheet}`}>
                <div className={styles.sheetHeader}>
                  <div><small>NGƯỜI CHƠI</small><strong>{selectedParticipant.displayName}</strong></div>
                  <button onClick={() => setPanel(null)} type="button">×</button>
                </div>
                <div className={styles.playerIdentity}>
                  <span className={styles.playerAvatar}>{initials(selectedParticipant.displayName)}</span>
                  <div>
                    <strong>{selectedParticipant.displayName}</strong>
                    <span>Lv. {levelFor(selectedParticipant)} · {statusLabel(selectedParticipant)}</span>
                  </div>
                </div>
                <div className={styles.playerActions}>
                  <button onClick={() => playerAction("Xem avatar")} type="button">● <span>Xem avatar</span></button>
                  <button onClick={() => playerAction("Xem đồ")} type="button">◆ <span>Xem đồ</span></button>
                  <button onClick={() => playerAction("Thông tin")} type="button">▤ <span>Thông tin</span></button>
                  <button onClick={() => playerAction("Chat riêng")} type="button">● <span>Chat riêng</span></button>
                  {hostView && selectedParticipant.participantId !== room.hostParticipantId && (
                    <button className={styles.kickButton} onClick={kickSelectedParticipant} type="button">⌁ <span>Kick khỏi phòng</span></button>
                  )}
                </div>
                {actionNotice && <p className={styles.actionNotice}>{actionNotice}</p>}
              </section>
            )}
          </div>
        )}

        <div className={styles.safeBottom} />
      </section>
    </main>
  );
}
