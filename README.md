# Audition Mobile — Frontend Rhythm Prototype

A frontend-only mobile rhythm-game prototype inspired by classic dance/rhythm games. It is **not** a copy of proprietary Audition assets, music, source code, or networking protocol.

## Stack

- Next.js App Router
- React + TypeScript
- Phaser 3.90
- Web Audio API metronome
- No backend
- No external assets required

Next.js currently requires Node.js 20.9+ according to the official docs. Phaser 3.90 is the current Phaser 3 release used by this prototype.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Controls

Desktop:

- Arrow keys: `← ↑ ↓ →`
- Alternative: `W A S D`

Mobile:

- Tap the four on-screen buttons.

## Architecture

```text
app/
  page.tsx
  layout.tsx
  globals.css

components/
  GameShell.tsx

game/
  GameScene.ts       # Phaser presentation + input bridge
  RhythmEngine.ts    # timing/judgement/score/combo
  clock.ts           # beat clock
  chart.ts           # demo chart generator
  types.ts           # domain types
```

## Important limitation

This first prototype intentionally uses `performance.now()` as the gameplay clock and a synthetic Web Audio metronome. It is good for validating the interaction model, but it is **not yet production-grade music synchronization**.

The next step should be an audio-backed clock using Web Audio timing, followed by a chart editor and real song/chart assets.
Codex Cloud write access test.
