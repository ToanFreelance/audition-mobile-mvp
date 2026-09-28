// DIRECT OWNER-SKETCH REFERENCE ONLY.
// Source: owner-supplied 864x1536 golden sketch (2026-09-28).
// This file MUST NOT be imported by runtime scene-generation/material code.
// It exists only for QA overlays, screenshot comparison and visual delta analysis.
export const WAITING_ROOM_GOLDEN_REFERENCE = {
  id: "owner-golden-864x1536-v1",
  source: {
    width: 864,
    height: 1536,
    stageViewportHeight: 1044,
  },
  roof: {
    // Direct pixel trace of the visible top and bottom chords in the owner's sketch.
    upperPath: "M 43 65 C 180 96 302 118 432 121 C 562 118 685 96 821 65",
    lowerPath: "M 48 84 C 184 112 306 132 432 135 C 558 132 680 112 816 84",
  },
  wings: {
    leftWallPath: "M 0 126 C 56 145 123 171 194 201 L 194 506 C 128 500 65 496 0 493 Z",
    railsLeft: [
      "M 0 156 C 60 165 126 181 194 199",
      "M 0 205 C 62 216 129 232 194 247",
      "M 0 254 C 63 266 131 281 194 296",
      "M 0 304 C 64 317 132 331 194 344",
      "M 0 354 C 66 367 134 380 194 391",
      "M 0 404 C 68 416 136 428 194 438"
    ],
  },
  columns: {
    left: { x: 33, y: 134, width: 20, height: 373 },
    right: { x: 811, y: 134, width: 20, height: 373 },
  },
  centerPanel: {
    x: 194,
    y: 125,
    width: 476,
    height: 386,
  },
  logo: {
    bbox: { x: 216, y: 279, width: 438, height: 76 },
    subtitleBox: { x: 305, y: 360, width: 255, height: 24 },
  },
  spotlights: [
    { x: 110, y: 116, targetX: 61, targetY: 498, tone: "cyan" },
    { x: 228, y: 145, targetX: 276, targetY: 510, tone: "violet" },
    { x: 311, y: 156, targetX: 337, targetY: 509, tone: "cyan" },
    { x: 545, y: 149, targetX: 527, targetY: 509, tone: "magenta" },
    { x: 632, y: 140, targetX: 588, targetY: 509, tone: "cyan" },
    { x: 758, y: 116, targetX: 805, targetY: 497, tone: "cyan" },
  ],
  risers: [
    {
      edge: "M 0 510 C 190 500 674 500 864 510",
      lowerEdge: "M 0 535 C 192 524 672 524 864 535",
    },
    {
      edge: "M 0 555 C 195 543 669 543 864 555",
      lowerEdge: "M 0 583 C 198 570 666 570 864 583",
    },
    {
      edge: "M 0 602 C 203 588 661 588 864 602",
      lowerEdge: "M 0 633 C 208 618 656 618 864 633",
    },
  ],
  floor: {
    frontRim: "M 0 656 C 184 638 680 638 864 656",
    gridVertical: [
      "M 181 641 L 157 1044",
      "M 263 630 L 241 1044",
      "M 344 622 L 333 1044",
      "M 432 618 L 432 1044",
      "M 520 622 L 531 1044",
      "M 601 630 L 623 1044",
      "M 683 641 L 707 1044"
    ],
    gridHorizontal: [
      "M 0 702 C 183 689 681 689 864 702",
      "M 0 755 C 188 740 676 740 864 755",
      "M 0 815 C 193 798 671 798 864 815",
      "M 0 883 C 202 865 662 865 864 883",
      "M 0 960 C 215 942 649 942 864 960"
    ],
    reflectionLanes: {
      left: "M 0 662 C 70 676 116 760 135 1044 L 28 1044 C 58 910 50 760 0 662 Z",
      center: "M 330 634 C 374 625 490 625 534 634 L 592 1044 L 274 1044 Z",
      right: "M 864 662 C 794 676 748 760 729 1044 L 836 1044 C 806 910 814 760 864 662 Z",
    },
  },
  rings: {
    leftOuter: { cx: 112, cy: 788, rx: 82, ry: 18 },
    leftNear: { cx: 267, cy: 849, rx: 105, ry: 26 },
    host: { cx: 432, cy: 951, rx: 166, ry: 43 },
    rightNear: { cx: 603, cy: 851, rx: 108, ry: 27 },
    rightOuter: { cx: 757, cy: 799, rx: 94, ry: 21 },
  },
  colorZones: [
    { key: "upper", label: "UPPER", x: 320, y: 130, width: 224, height: 60, target: "#140953", luma: 16.5 },
    { key: "leftWing", label: "L-WING", x: 60, y: 250, width: 115, height: 105, target: "#161c9a", luma: 36.4 },
    { key: "rightWing", label: "R-WING", x: 689, y: 250, width: 115, height: 105, target: "#231098", luma: 31.7 },
    { key: "floorLeft", label: "F-L", x: 20, y: 850, width: 170, height: 185, target: "#121889", luma: 33.4 },
    { key: "floorCenter", label: "F-C", x: 205, y: 900, width: 455, height: 135, target: "#322499", luma: 48.5 },
    { key: "floorRight", label: "F-R", x: 675, y: 850, width: 175, height: 185, target: "#3f1391", luma: 38.9 },
  ],
} as const;

export type WaitingRoomGoldenReference = typeof WAITING_ROOM_GOLDEN_REFERENCE;
