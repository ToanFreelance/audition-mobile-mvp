import { WebAudioTransport } from "../game/web-audio-transport";
import {
  MultiplayerGameplayRuntime,
  type MultiplayerGameplayCallbacks,
} from "./gameplay-runtime";
import { planMatchAudioStart, type MatchStartSession } from "./match-start-protocol";
import type { SharedStartPlan } from "./shared-clock";

export type MultiplayerAudioGameplayStartResult =
  | {
      status: "scheduled";
      plan: SharedStartPlan;
      runtime: MultiplayerGameplayRuntime;
    }
  | {
      status: "late";
      plan: SharedStartPlan;
      runtime: null;
    };

/**
 * P4.5 bridge from one immutable P4.4 server epoch to local WebAudio playback
 * and the multiplayer gameplay consumer. No interval/RAF/network event owns
 * the start. If the mapped epoch is already late, this bridge reports late and
 * does not invent a replacement local epoch.
 */
export async function scheduleMultiplayerAudioGameplay(input: {
  session: MatchStartSession;
  participantId: string;
  transport: WebAudioTransport;
  estimatedServerOffsetMs: number;
  callbacks?: MultiplayerGameplayCallbacks;
}): Promise<MultiplayerAudioGameplayStartResult> {
  if (input.session.phase !== "countdown" || input.session.startAtServerMs === null) {
    throw new Error("Multiplayer gameplay scheduling requires the issued P4.4 shared epoch.");
  }
  if (!input.session.manifest.participants.some(item => item.participantId === input.participantId)) {
    throw new Error(`Participant ${input.participantId} is not in the frozen match manifest.`);
  }

  input.transport.reset();
  const audioContextNowSec = await input.transport.getSchedulingContextTimeSec();
  const localNowMonotonicMs = performance.now();
  const plan = planMatchAudioStart(input.session, {
    estimatedServerOffsetMs: input.estimatedServerOffsetMs,
    localNowMonotonicMs,
    audioContextNowSec,
  });

  if (plan.status === "late") return { status: "late", plan, runtime: null };

  const runtime = new MultiplayerGameplayRuntime(
    input.session.manifest,
    input.participantId,
    input.callbacks,
  );
  runtime.setTimeSource(() => input.transport.getCurrentTimeMs());
  runtime.start();

  try {
    await input.transport.playAtContextTime(plan.audioContextStartTimeSec);
  } catch (error) {
    runtime.stop();
    throw error;
  }

  return { status: "scheduled", plan, runtime };
}
