// QA-ONLY GOLDEN TRACE.
// Geometry authority is the owner-authored line trace supplied on 2026-09-28.
// The owner trace is normalized uniformly from 768x928 stage pixels to 864x1044 (scale 1.125).
// Legacy vector measurements remain only as non-authoritative diagnostic metadata.
// Do not use as runtime scene-generation input.
// Do not import waiting-room-sketch-blueprint or WaitingRoomStage3D from this module.

export type GoldenTraceAccuracy = "pixel-traced" | "approximate-occluded" | "approximate-diffuse";
export type GoldenTracePoint = readonly [x: number, y: number];
export type GoldenTracePolyline = {
  readonly id: string;
  readonly points: readonly GoldenTracePoint[];
  readonly accuracy: GoldenTraceAccuracy;
};


const exactSegment = (id: string, points: readonly GoldenTracePoint[]) => ({
  id,
  points,
  accuracy: "pixel-traced" as const,
});

const occludedSegment = (id: string, points: readonly GoldenTracePoint[]) => ({
  id,
  points,
  accuracy: "approximate-occluded" as const,
});

// Riser recovery V2:
// - visible colored segments are traced directly from owner-sketch pixels;
// - hidden spans are explicit occluded continuations, never presented as exact;
// - points preserve the observed downward bow instead of flattening the step edges.
const RISER_1_TOP_SEGMENTS = [
  exactSegment("riser-1-top-visible-1", [[0,512],[20,512],[24,510],[55,510]]),
  occludedSegment("riser-1-top-occluded-1", [[55,510],[79,511],[143,520],[168,521]]),
  exactSegment("riser-1-top-visible-2", [[168,521],[184,521],[188,522],[198,522]]),
  occludedSegment("riser-1-top-occluded-2", [[198,522],[318,523]]),
  exactSegment("riser-1-top-visible-3", [[318,523],[334,523]]),
  occludedSegment("riser-1-top-occluded-3", [[334,523],[526,523]]),
  exactSegment("riser-1-top-visible-4", [[526,523],[548,523]]),
  occludedSegment("riser-1-top-occluded-4", [[548,523],[628,524],[666,522]]),
  exactSegment("riser-1-top-visible-5", [[666,522],[674,522],[678,521],[698,520]]),
  occludedSegment("riser-1-top-occluded-5", [[698,520],[778,512],[810,510],[824,510]]),
  exactSegment("riser-1-top-visible-6", [[824,510],[836,510],[840,512],[852,512],[856,511],[863,511]]),
] as const;

const RISER_1_LOWER_SEGMENTS = [
  exactSegment("riser-1-lower-visible-1", [[0,541],[32,541],[36,543],[40,544],[55,544]]),
  occludedSegment("riser-1-lower-occluded-1", [[55,544],[168,544]]),
  exactSegment("riser-1-lower-visible-2", [[168,544],[192,544],[198,543]]),
  occludedSegment("riser-1-lower-occluded-2", [[198,543],[222,541],[238,541],[302,545],[318,545]]),
  exactSegment("riser-1-lower-visible-3", [[318,545],[334,545]]),
  occludedSegment("riser-1-lower-occluded-3", [[334,545],[526,545]]),
  exactSegment("riser-1-lower-visible-4", [[526,545],[548,545]]),
  occludedSegment("riser-1-lower-occluded-4", [[548,545],[666,544]]),
  exactSegment("riser-1-lower-visible-5", [[666,544],[698,544]]),
  occludedSegment("riser-1-lower-occluded-5", [[698,544],[730,544],[762,542],[824,541]]),
  exactSegment("riser-1-lower-visible-6", [[824,541],[863,541]]),
] as const;

const RISER_2_TOP_SEGMENTS = [
  exactSegment("riser-2-top-visible-1", [[0,573],[24,573],[28,572],[55,572]]),
  occludedSegment("riser-2-top-occluded-1", [[55,572],[168,570]]),
  exactSegment("riser-2-top-visible-2", [[168,570],[184,570],[188,572],[198,572]]),
  occludedSegment("riser-2-top-occluded-2", [[198,572],[318,569]]),
  exactSegment("riser-2-top-visible-3", [[318,569],[334,569]]),
  occludedSegment("riser-2-top-occluded-3", [[334,569],[526,569]]),
  exactSegment("riser-2-top-visible-4", [[526,569],[538,569],[542,568],[548,568]]),
  occludedSegment("riser-2-top-occluded-4", [[548,568],[556,567],[580,567],[644,572],[666,571]]),
  exactSegment("riser-2-top-visible-5", [[666,571],[674,571],[678,570],[698,570]]),
  occludedSegment("riser-2-top-occluded-5", [[698,570],[738,570],[746,571],[778,571],[786,572],[824,572]]),
  exactSegment("riser-2-top-visible-6", [[824,572],[848,572],[852,573],[863,573]]),
] as const;

const RISER_2_LOWER_SEGMENTS = [
  exactSegment("riser-2-lower-visible-1", [[0,603],[16,603],[24,601],[28,601],[32,599],[36,599],[40,598],[55,598]]),
  occludedSegment("riser-2-lower-occluded-1", [[55,598],[111,599],[143,601],[168,601]]),
  exactSegment("riser-2-lower-visible-2", [[168,601],[198,601]]),
  occludedSegment("riser-2-lower-occluded-2", [[198,601],[318,598]]),
  exactSegment("riser-2-lower-visible-3", [[318,598],[334,598]]),
  occludedSegment("riser-2-lower-occluded-3", [[334,598],[526,598]]),
  exactSegment("riser-2-lower-visible-4", [[526,598],[548,598]]),
  occludedSegment("riser-2-lower-occluded-4", [[548,598],[604,599],[636,601],[666,601]]),
  exactSegment("riser-2-lower-visible-5", [[666,601],[698,601]]),
  occludedSegment("riser-2-lower-occluded-5", [[698,601],[714,601],[778,596],[810,597],[824,599]]),
  exactSegment("riser-2-lower-visible-6", [[824,599],[828,599],[836,601],[840,601],[844,602],[848,604],[863,604]]),
] as const;

const RISER_3_TOP_SEGMENTS = [
  exactSegment("riser-3-top-visible-1", [[0,640],[24,640],[36,637],[55,637]]),
  occludedSegment("riser-3-top-occluded-1", [[55,637],[168,638]]),
  exactSegment("riser-3-top-visible-2", [[168,638],[184,638],[188,637],[198,637]]),
  occludedSegment("riser-3-top-occluded-2", [[198,637],[222,637],[270,634],[318,633]]),
  exactSegment("riser-3-top-visible-3", [[318,633],[334,633]]),
  occludedSegment("riser-3-top-occluded-3", [[334,633],[526,632]]),
  exactSegment("riser-3-top-visible-4", [[526,632],[538,632],[542,633],[548,633]]),
  occludedSegment("riser-3-top-occluded-4", [[548,633],[612,637],[666,637]]),
  exactSegment("riser-3-top-visible-5", [[666,637],[682,637],[686,638],[698,638]]),
  occludedSegment("riser-3-top-occluded-5", [[698,638],[714,638],[770,633],[794,633],[824,637]]),
  exactSegment("riser-3-top-visible-6", [[824,637],[832,637],[836,640],[863,640]]),
] as const;

const RISER_3_LOWER_SEGMENTS = [
  exactSegment("riser-3-lower-visible-1", [[0,651],[4,651],[8,650],[24,650],[28,651],[55,651]]),
  occludedSegment("riser-3-lower-occluded-1", [[55,651],[95,650],[127,647],[168,646]]),
  exactSegment("riser-3-lower-visible-2", [[168,646],[198,646]]),
  occludedSegment("riser-3-lower-occluded-2", [[198,646],[318,647]]),
  exactSegment("riser-3-lower-visible-3", [[318,647],[334,647]]),
  occludedSegment("riser-3-lower-occluded-3", [[334,647],[526,648]]),
  exactSegment("riser-3-lower-visible-4", [[526,648],[548,648]]),
  occludedSegment("riser-3-lower-occluded-4", [[548,648],[580,648],[588,647],[620,647],[628,646],[666,646]]),
  exactSegment("riser-3-lower-visible-5", [[666,646],[698,646]]),
  occludedSegment("riser-3-lower-occluded-5", [[698,646],[714,646],[786,653],[802,653],[824,651]]),
  exactSegment("riser-3-lower-visible-6", [[824,651],[832,651],[836,649],[840,650],[863,650]]),
] as const;

export const WAITING_ROOM_GOLDEN_TRACE = {
  "id": "owner-authored-trace-raster-v1",
  "source": {
    "width": 864,
    "height": 1536,
    "stageHeight": 1044,
    "originalSha256": "590903d3505de2c0c8d737c23a07df999e5e48341318db2aff9effcddf17098f",
    "capturedAt": "2026-09-28"
  },
  "geometryAuthority": {
    "kind": "owner-authored-raster",
    "asset": "/qa/waiting-room-owner-trace-stage-v1.png",
    "sourceWidth": 768,
    "sourceHeight": 1364,
    "stageCrop": { "x": 0, "y": 0, "width": 768, "height": 928 },
    "normalization": {
      "scale": 1.125,
      "width": 864,
      "height": 1044,
      "distortion": "none"
    },
    "ownerTraceSha256": "59615be18d091205f0d65f8b772d7fd1db0c8b70e65f4dcd2f8b32dde722b7fb",
    "normalizedAssetSha256": "6be0d403869874805e1adc0c42b460fa6d92f72c4a92df8f7e19e68aeadc7d07",
    "lineExtraction": "owner-trace-nonwhite-mask-threshold-45"
  },
  "roof": {
    "upper": [
      {
        "id": "roof-upper-visible",
        "points": [
          [
            96,
            58
          ],
          [
            120,
            63
          ],
          [
            160,
            70
          ],
          [
            200,
            79
          ],
          [
            240,
            87
          ],
          [
            280,
            93
          ],
          [
            320,
            98
          ],
          [
            360,
            102
          ],
          [
            400,
            104
          ],
          [
            432,
            104
          ],
          [
            464,
            104
          ],
          [
            500,
            102
          ],
          [
            540,
            99
          ],
          [
            580,
            95
          ],
          [
            620,
            89
          ],
          [
            660,
            82
          ],
          [
            700,
            74
          ],
          [
            736,
            65
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-upper-left-occluded",
        "points": [
          [
            0,
            9
          ],
          [
            24,
            21
          ],
          [
            48,
            31
          ],
          [
            72,
            44
          ],
          [
            96,
            58
          ]
        ],
        "accuracy": "approximate-occluded"
      },
      {
        "id": "roof-upper-right-occluded",
        "points": [
          [
            736,
            65
          ],
          [
            768,
            51
          ],
          [
            800,
            37
          ],
          [
            832,
            20
          ],
          [
            864,
            5
          ]
        ],
        "accuracy": "approximate-occluded"
      }
    ],
    "lower": [
      {
        "id": "roof-lower-visible",
        "points": [
          [
            96,
            82
          ],
          [
            120,
            85
          ],
          [
            160,
            91
          ],
          [
            200,
            100
          ],
          [
            240,
            108
          ],
          [
            280,
            114
          ],
          [
            320,
            119
          ],
          [
            360,
            123
          ],
          [
            400,
            125
          ],
          [
            432,
            126
          ],
          [
            464,
            125
          ],
          [
            500,
            123
          ],
          [
            540,
            120
          ],
          [
            580,
            116
          ],
          [
            620,
            110
          ],
          [
            660,
            103
          ],
          [
            700,
            94
          ],
          [
            736,
            84
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-lower-left-occluded",
        "points": [
          [
            0,
            40
          ],
          [
            24,
            49
          ],
          [
            48,
            59
          ],
          [
            72,
            71
          ],
          [
            96,
            82
          ]
        ],
        "accuracy": "approximate-occluded"
      },
      {
        "id": "roof-lower-right-occluded",
        "points": [
          [
            736,
            84
          ],
          [
            768,
            75
          ],
          [
            800,
            63
          ],
          [
            832,
            47
          ],
          [
            864,
            32
          ]
        ],
        "accuracy": "approximate-occluded"
      }
    ],
    "braces": [
      {
        "id": "roof-brace-01",
        "points": [
          [
            108,
            64
          ],
          [
            132,
            87
          ]
        ],
        "accuracy": "approximate-occluded"
      },
      {
        "id": "roof-brace-02",
        "points": [
          [
            138,
            68
          ],
          [
            164,
            92
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-03",
        "points": [
          [
            170,
            72
          ],
          [
            198,
            99
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-04",
        "points": [
          [
            202,
            79
          ],
          [
            230,
            106
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-05",
        "points": [
          [
            235,
            86
          ],
          [
            264,
            112
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-06",
        "points": [
          [
            269,
            92
          ],
          [
            299,
            118
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-07",
        "points": [
          [
            303,
            97
          ],
          [
            334,
            120
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-08",
        "points": [
          [
            338,
            100
          ],
          [
            369,
            123
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-09",
        "points": [
          [
            373,
            103
          ],
          [
            404,
            125
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-10",
        "points": [
          [
            407,
            104
          ],
          [
            438,
            126
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-11",
        "points": [
          [
            441,
            104
          ],
          [
            472,
            125
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-12",
        "points": [
          [
            476,
            103
          ],
          [
            507,
            122
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-13",
        "points": [
          [
            511,
            101
          ],
          [
            542,
            120
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-14",
        "points": [
          [
            546,
            98
          ],
          [
            577,
            116
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-15",
        "points": [
          [
            581,
            95
          ],
          [
            612,
            111
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-16",
        "points": [
          [
            616,
            90
          ],
          [
            647,
            105
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-17",
        "points": [
          [
            651,
            84
          ],
          [
            681,
            99
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-18",
        "points": [
          [
            686,
            78
          ],
          [
            715,
            91
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-19",
        "points": [
          [
            720,
            70
          ],
          [
            746,
            81
          ]
        ],
        "accuracy": "approximate-occluded"
      }
    ]
  },
  "wings": {
    "left": {
      "outerTop": {
        "id": "left-wing-outer-top",
        "points": [
          [
            0,
            126
          ],
          [
            24,
            132
          ],
          [
            55,
            143
          ],
          [
            90,
            155
          ],
          [
            130,
            169
          ],
          [
            166,
            185
          ],
          [
            196,
            203
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "innerOpening": {
        "id": "left-wing-inner-opening",
        "points": [
          [
            196,
            154
          ],
          [
            196,
            205
          ],
          [
            196,
            260
          ],
          [
            197,
            320
          ],
          [
            197,
            380
          ],
          [
            198,
            440
          ],
          [
            198,
            506
          ]
        ],
        "accuracy": "pixel-traced"
      },
      "bottom": {
        "id": "left-wing-bottom",
        "points": [
          [
            0,
            508
          ],
          [
            50,
            508
          ],
          [
            100,
            507
          ],
          [
            150,
            507
          ],
          [
            198,
            506
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "rails": [
        {
          "id": "left-rail-1",
          "points": [
            [
              0,
              155
            ],
            [
              18,
              160
            ],
            [
              60,
              176
            ],
            [
              80,
              181
            ],
            [
              100,
              186
            ],
            [
              120,
              190
            ],
            [
              140,
              194
            ],
            [
              160,
              198
            ],
            [
              180,
              201
            ],
            [
              196,
              204
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-2",
          "points": [
            [
              0,
              211
            ],
            [
              18,
              217
            ],
            [
              60,
              230
            ],
            [
              80,
              234
            ],
            [
              100,
              238
            ],
            [
              120,
              242
            ],
            [
              140,
              246
            ],
            [
              160,
              250
            ],
            [
              180,
              253
            ],
            [
              196,
              255
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-3",
          "points": [
            [
              0,
              266
            ],
            [
              18,
              271
            ],
            [
              60,
              283
            ],
            [
              80,
              287
            ],
            [
              100,
              291
            ],
            [
              120,
              294
            ],
            [
              140,
              298
            ],
            [
              160,
              301
            ],
            [
              180,
              304
            ],
            [
              196,
              307
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-4",
          "points": [
            [
              0,
              322
            ],
            [
              18,
              327
            ],
            [
              60,
              337
            ],
            [
              80,
              340
            ],
            [
              100,
              343
            ],
            [
              120,
              346
            ],
            [
              140,
              349
            ],
            [
              160,
              352
            ],
            [
              180,
              354
            ],
            [
              196,
              356
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-5",
          "points": [
            [
              0,
              378
            ],
            [
              18,
              382
            ],
            [
              60,
              389
            ],
            [
              80,
              391
            ],
            [
              100,
              394
            ],
            [
              120,
              397
            ],
            [
              140,
              399
            ],
            [
              160,
              401
            ],
            [
              180,
              403
            ],
            [
              196,
              404
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-6",
          "points": [
            [
              0,
              433
            ],
            [
              18,
              436
            ],
            [
              60,
              441
            ],
            [
              80,
              443
            ],
            [
              100,
              445
            ],
            [
              120,
              446
            ],
            [
              140,
              448
            ],
            [
              160,
              450
            ],
            [
              180,
              451
            ],
            [
              196,
              452
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-7",
          "points": [
            [
              0,
              487
            ],
            [
              18,
              490
            ],
            [
              60,
              495
            ],
            [
              80,
              496
            ],
            [
              100,
              497
            ],
            [
              120,
              498
            ],
            [
              140,
              498
            ],
            [
              160,
              499
            ],
            [
              180,
              500
            ],
            [
              196,
              500
            ]
          ],
          "accuracy": "pixel-traced"
        }
      ]
    },
    "right": {
      "outerTop": {
        "id": "right-wing-outer-top",
        "points": [
          [
            864,
            125
          ],
          [
            842,
            131
          ],
          [
            812,
            140
          ],
          [
            778,
            151
          ],
          [
            742,
            166
          ],
          [
            706,
            184
          ],
          [
            668,
            203
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "innerOpening": {
        "id": "right-wing-inner-opening",
        "points": [
          [
            669,
            154
          ],
          [
            669,
            205
          ],
          [
            669,
            260
          ],
          [
            668,
            320
          ],
          [
            668,
            380
          ],
          [
            667,
            440
          ],
          [
            666,
            506
          ]
        ],
        "accuracy": "pixel-traced"
      },
      "bottom": {
        "id": "right-wing-bottom",
        "points": [
          [
            666,
            506
          ],
          [
            714,
            507
          ],
          [
            764,
            507
          ],
          [
            814,
            508
          ],
          [
            864,
            508
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "rails": [
        {
          "id": "right-rail-1",
          "points": [
            [
              668,
              203
            ],
            [
              684,
              201
            ],
            [
              700,
              199
            ],
            [
              720,
              196
            ],
            [
              740,
              192
            ],
            [
              760,
              188
            ],
            [
              780,
              183
            ],
            [
              800,
              177
            ],
            [
              846,
              163
            ],
            [
              864,
              154
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-2",
          "points": [
            [
              668,
              255
            ],
            [
              684,
              253
            ],
            [
              700,
              251
            ],
            [
              720,
              247
            ],
            [
              740,
              244
            ],
            [
              760,
              240
            ],
            [
              780,
              235
            ],
            [
              800,
              231
            ],
            [
              846,
              218
            ],
            [
              864,
              212
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-3",
          "points": [
            [
              668,
              306
            ],
            [
              684,
              302
            ],
            [
              700,
              299
            ],
            [
              720,
              296
            ],
            [
              740,
              293
            ],
            [
              760,
              290
            ],
            [
              780,
              287
            ],
            [
              800,
              283
            ],
            [
              846,
              271
            ],
            [
              864,
              266
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-4",
          "points": [
            [
              668,
              356
            ],
            [
              684,
              354
            ],
            [
              700,
              351
            ],
            [
              720,
              348
            ],
            [
              740,
              345
            ],
            [
              760,
              343
            ],
            [
              780,
              340
            ],
            [
              800,
              337
            ],
            [
              846,
              330
            ],
            [
              864,
              326
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-5",
          "points": [
            [
              668,
              405
            ],
            [
              684,
              403
            ],
            [
              700,
              401
            ],
            [
              720,
              398
            ],
            [
              740,
              395
            ],
            [
              760,
              393
            ],
            [
              780,
              391
            ],
            [
              800,
              388
            ],
            [
              846,
              382
            ],
            [
              864,
              379
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-6",
          "points": [
            [
              668,
              452
            ],
            [
              684,
              451
            ],
            [
              700,
              450
            ],
            [
              720,
              448
            ],
            [
              740,
              446
            ],
            [
              760,
              444
            ],
            [
              780,
              442
            ],
            [
              800,
              440
            ],
            [
              846,
              435
            ],
            [
              864,
              434
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-7",
          "points": [
            [
              668,
              500
            ],
            [
              684,
              499
            ],
            [
              700,
              498
            ],
            [
              720,
              497
            ],
            [
              740,
              496
            ],
            [
              760,
              495
            ],
            [
              780,
              494
            ],
            [
              800,
              493
            ],
            [
              846,
              490
            ],
            [
              864,
              489
            ]
          ],
          "accuracy": "pixel-traced"
        }
      ]
    }
  },
  "columns": {
    "left": {
      "x": 25,
      "y": 136,
      "width": 30,
      "height": 372,
      "accuracy": "pixel-traced"
    },
    "right": {
      "x": 808,
      "y": 136,
      "width": 30,
      "height": 372,
      "accuracy": "pixel-traced"
    }
  },
  "centerPanel": {
    "x": 194,
    "y": 154,
    "width": 476,
    "height": 354,
    "accuracy": "approximate-diffuse"
  },
  "logo": {
    "bbox": {
      "x": 216,
      "y": 279,
      "width": 438,
      "height": 76,
      "accuracy": "pixel-traced"
    },
    "subtitleBox": {
      "x": 306,
      "y": 362,
      "width": 254,
      "height": 21,
      "accuracy": "pixel-traced"
    }
  },
  "spotlights": [
    {
      "id": "spot-1",
      "cx": 108,
      "cy": 116,
      "rx": 8,
      "ry": 6,
      "tone": "cyan",
      "beamLeft": {
        "id": "spot-1-beam-left",
        "points": [
          [
            104,
            122
          ],
          [
            50,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "beamRight": {
        "id": "spot-1-beam-right",
        "points": [
          [
            112,
            122
          ],
          [
            166,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "fallZone": {
        "cx": 108,
        "cy": 505,
        "rx": 58,
        "ry": 13
      }
    },
    {
      "id": "spot-2",
      "cx": 227,
      "cy": 145,
      "rx": 7,
      "ry": 5,
      "tone": "magenta",
      "beamLeft": {
        "id": "spot-2-beam-left",
        "points": [
          [
            223,
            151
          ],
          [
            188,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "beamRight": {
        "id": "spot-2-beam-right",
        "points": [
          [
            231,
            151
          ],
          [
            282,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "fallZone": {
        "cx": 235,
        "cy": 505,
        "rx": 47,
        "ry": 12
      }
    },
    {
      "id": "spot-3",
      "cx": 310,
      "cy": 154,
      "rx": 7,
      "ry": 5,
      "tone": "cyan",
      "beamLeft": {
        "id": "spot-3-beam-left",
        "points": [
          [
            306,
            160
          ],
          [
            284,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "beamRight": {
        "id": "spot-3-beam-right",
        "points": [
          [
            314,
            160
          ],
          [
            350,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "fallZone": {
        "cx": 317,
        "cy": 505,
        "rx": 33,
        "ry": 11
      }
    },
    {
      "id": "spot-4",
      "cx": 545,
      "cy": 154,
      "rx": 7,
      "ry": 5,
      "tone": "magenta",
      "beamLeft": {
        "id": "spot-4-beam-left",
        "points": [
          [
            541,
            160
          ],
          [
            510,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "beamRight": {
        "id": "spot-4-beam-right",
        "points": [
          [
            549,
            160
          ],
          [
            582,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "fallZone": {
        "cx": 546,
        "cy": 505,
        "rx": 36,
        "ry": 11
      }
    },
    {
      "id": "spot-5",
      "cx": 631,
      "cy": 144,
      "rx": 7,
      "ry": 5,
      "tone": "cyan",
      "beamLeft": {
        "id": "spot-5-beam-left",
        "points": [
          [
            627,
            150
          ],
          [
            584,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "beamRight": {
        "id": "spot-5-beam-right",
        "points": [
          [
            635,
            150
          ],
          [
            690,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "fallZone": {
        "cx": 637,
        "cy": 505,
        "rx": 53,
        "ry": 12
      }
    },
    {
      "id": "spot-6",
      "cx": 757,
      "cy": 115,
      "rx": 8,
      "ry": 6,
      "tone": "cyan",
      "beamLeft": {
        "id": "spot-6-beam-left",
        "points": [
          [
            753,
            121
          ],
          [
            700,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "beamRight": {
        "id": "spot-6-beam-right",
        "points": [
          [
            761,
            121
          ],
          [
            824,
            510
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      "fallZone": {
        "cx": 762,
        "cy": 505,
        "rx": 62,
        "ry": 13
      }
    }
  ],
  "risers": [
    {
      "id": "riser-1",
      "topSegments": RISER_1_TOP_SEGMENTS,
      "lowerSegments": RISER_1_LOWER_SEGMENTS,
      "lowerEdgeIsFloorRim": false
    },
    {
      "id": "riser-2",
      "topSegments": RISER_2_TOP_SEGMENTS,
      "lowerSegments": RISER_2_LOWER_SEGMENTS,
      "lowerEdgeIsFloorRim": false
    },
    {
      "id": "riser-3",
      "topSegments": RISER_3_TOP_SEGMENTS,
      "lowerSegments": RISER_3_LOWER_SEGMENTS,
      "lowerEdgeIsFloorRim": true
    }
  ],
  "floor": {
    "frontRimSegments": RISER_3_LOWER_SEGMENTS,
    "gridVertical": [
      {
        "id": "floor-v-1",
        "points": [
          [
            37,
            650
          ],
          [
            28,
            760
          ],
          [
            18,
            875
          ],
          [
            8,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-v-2",
        "points": [
          [
            124,
            646
          ],
          [
            116,
            760
          ],
          [
            108,
            875
          ],
          [
            100,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-v-3",
        "points": [
          [
            214,
            641
          ],
          [
            208,
            760
          ],
          [
            202,
            875
          ],
          [
            196,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-v-4",
        "points": [
          [
            307,
            638
          ],
          [
            304,
            760
          ],
          [
            302,
            875
          ],
          [
            300,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-v-5",
        "points": [
          [
            432,
            636
          ],
          [
            432,
            760
          ],
          [
            432,
            875
          ],
          [
            432,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-v-6",
        "points": [
          [
            557,
            638
          ],
          [
            560,
            760
          ],
          [
            562,
            875
          ],
          [
            564,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-v-7",
        "points": [
          [
            650,
            641
          ],
          [
            656,
            760
          ],
          [
            662,
            875
          ],
          [
            668,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-v-8",
        "points": [
          [
            740,
            646
          ],
          [
            748,
            760
          ],
          [
            756,
            875
          ],
          [
            764,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-v-9",
        "points": [
          [
            827,
            650
          ],
          [
            836,
            760
          ],
          [
            846,
            875
          ],
          [
            856,
            1044
          ]
        ],
        "accuracy": "approximate-diffuse"
      }
    ],
    "gridHorizontal": [
      {
        "id": "floor-h-1",
        "points": [
          [
            0,
            684
          ],
          [
            100,
            679
          ],
          [
            220,
            674
          ],
          [
            432,
            671
          ],
          [
            644,
            674
          ],
          [
            764,
            679
          ],
          [
            864,
            684
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-h-2",
        "points": [
          [
            0,
            724
          ],
          [
            100,
            719
          ],
          [
            220,
            714
          ],
          [
            432,
            711
          ],
          [
            644,
            714
          ],
          [
            764,
            719
          ],
          [
            864,
            724
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-h-3",
        "points": [
          [
            0,
            773
          ],
          [
            100,
            768
          ],
          [
            220,
            762
          ],
          [
            432,
            759
          ],
          [
            644,
            762
          ],
          [
            764,
            768
          ],
          [
            864,
            773
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-h-4",
        "points": [
          [
            0,
            830
          ],
          [
            100,
            824
          ],
          [
            220,
            818
          ],
          [
            432,
            815
          ],
          [
            644,
            818
          ],
          [
            764,
            824
          ],
          [
            864,
            830
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-h-5",
        "points": [
          [
            0,
            894
          ],
          [
            100,
            889
          ],
          [
            220,
            882
          ],
          [
            432,
            878
          ],
          [
            644,
            882
          ],
          [
            764,
            889
          ],
          [
            864,
            894
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-h-6",
        "points": [
          [
            0,
            965
          ],
          [
            100,
            960
          ],
          [
            220,
            953
          ],
          [
            432,
            949
          ],
          [
            644,
            953
          ],
          [
            764,
            960
          ],
          [
            864,
            965
          ]
        ],
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "floor-h-7",
        "points": [
          [
            0,
            1038
          ],
          [
            100,
            1034
          ],
          [
            220,
            1028
          ],
          [
            432,
            1024
          ],
          [
            644,
            1028
          ],
          [
            764,
            1034
          ],
          [
            864,
            1038
          ]
        ],
        "accuracy": "approximate-diffuse"
      }
    ],
    "reflectionLanes": [
      {
        "id": "reflection-cyan-left",
        "points": [
          [
            0,
            650
          ],
          [
            28,
            650
          ],
          [
            58,
            760
          ],
          [
            63,
            900
          ],
          [
            52,
            1044
          ],
          [
            13,
            1044
          ],
          [
            18,
            900
          ],
          [
            14,
            760
          ]
        ],
        "tone": "cyan",
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "reflection-violet-center",
        "points": [
          [
            326,
            640
          ],
          [
            374,
            634
          ],
          [
            490,
            634
          ],
          [
            538,
            640
          ],
          [
            582,
            1044
          ],
          [
            280,
            1044
          ]
        ],
        "tone": "violet",
        "accuracy": "approximate-diffuse"
      },
      {
        "id": "reflection-magenta-right",
        "points": [
          [
            836,
            650
          ],
          [
            864,
            650
          ],
          [
            850,
            760
          ],
          [
            846,
            900
          ],
          [
            851,
            1044
          ],
          [
            812,
            1044
          ],
          [
            801,
            900
          ],
          [
            806,
            760
          ]
        ],
        "tone": "magenta",
        "accuracy": "approximate-diffuse"
      }
    ]
  },
  "rings": {
    "leftOuter": {
      "cx": 112,
      "cy": 788,
      "ellipses": [
        {
          "rx": 91,
          "ry": 25
        },
        {
          "rx": 78,
          "ry": 19
        },
        {
          "rx": 66,
          "ry": 13
        }
      ],
      "accuracy": "pixel-traced"
    },
    "leftNear": {
      "cx": 268,
      "cy": 851,
      "ellipses": [
        {
          "rx": 108,
          "ry": 30
        },
        {
          "rx": 93,
          "ry": 24
        },
        {
          "rx": 78,
          "ry": 18
        }
      ],
      "accuracy": "pixel-traced"
    },
    "host": {
      "cx": 432,
      "cy": 956,
      "ellipses": [
        {
          "rx": 166,
          "ry": 43
        },
        {
          "rx": 146,
          "ry": 34
        },
        {
          "rx": 126,
          "ry": 26
        }
      ],
      "accuracy": "pixel-traced"
    },
    "rightNear": {
      "cx": 603,
      "cy": 852,
      "ellipses": [
        {
          "rx": 108,
          "ry": 29
        },
        {
          "rx": 93,
          "ry": 23
        },
        {
          "rx": 78,
          "ry": 18
        }
      ],
      "accuracy": "pixel-traced"
    },
    "rightOuter": {
      "cx": 756,
      "cy": 801,
      "ellipses": [
        {
          "rx": 95,
          "ry": 27
        },
        {
          "rx": 82,
          "ry": 20
        },
        {
          "rx": 68,
          "ry": 14
        }
      ],
      "accuracy": "pixel-traced"
    }
  },
  "colorZones": [
    {
      "key": "upperBackground",
      "label": "UPPER BG",
      "x": 350,
      "y": 130,
      "width": 165,
      "height": 50,
      "target": "#120952",
      "luma": 6.4
    },
    {
      "key": "leftWing",
      "label": "LEFT WING",
      "x": 90,
      "y": 310,
      "width": 90,
      "height": 20,
      "target": "#181b92",
      "luma": 13.8
    },
    {
      "key": "rightWing",
      "label": "RIGHT WING",
      "x": 685,
      "y": 310,
      "width": 90,
      "height": 20,
      "target": "#1d1690",
      "luma": 12.5
    },
    {
      "key": "centerBackground",
      "label": "CENTER BG",
      "x": 360,
      "y": 385,
      "width": 140,
      "height": 7,
      "target": "#3f09b8",
      "luma": 13.1
    },
    {
      "key": "logoSurround",
      "label": "LOGO SURROUND",
      "x": 180,
      "y": 280,
      "width": 35,
      "height": 70,
      "target": "#340b85",
      "luma": 11.2
    },
    {
      "key": "riserTop",
      "label": "RISER TOP",
      "x": 8,
      "y": 515,
      "width": 62,
      "height": 17,
      "target": "#191d90",
      "luma": 14.3
    },
    {
      "key": "riserFace",
      "label": "RISER FACE",
      "x": 8,
      "y": 536,
      "width": 62,
      "height": 14,
      "target": "#2c218c",
      "luma": 16.9
    },
    {
      "key": "floorLeft",
      "label": "FLOOR LEFT",
      "x": 20,
      "y": 900,
      "width": 75,
      "height": 30,
      "target": "#0a56b1",
      "luma": 30.1
    },
    {
      "key": "floorCenter",
      "label": "FLOOR CENTER",
      "x": 390,
      "y": 1020,
      "width": 85,
      "height": 20,
      "target": "#051499",
      "luma": 10.3
    },
    {
      "key": "floorRight",
      "label": "FLOOR RIGHT",
      "x": 760,
      "y": 900,
      "width": 75,
      "height": 30,
      "target": "#662da8",
      "luma": 25.8
    },
    {
      "key": "cyanReflection",
      "label": "CYAN REFLECTION",
      "x": 34,
      "y": 840,
      "width": 18,
      "height": 140,
      "target": "#12d2fd",
      "luma": 67.4
    },
    {
      "key": "magentaReflection",
      "label": "MAGENTA REFLECTION",
      "x": 810,
      "y": 840,
      "width": 18,
      "height": 140,
      "target": "#8527a3",
      "luma": 26.8
    },
    {
      "key": "cyanRing",
      "label": "CYAN RING",
      "x": 276,
      "y": 940,
      "width": 24,
      "height": 30,
      "target": "#3e90f7",
      "luma": 52.5
    },
    {
      "key": "magentaRing",
      "label": "MAGENTA RING",
      "x": 166,
      "y": 842,
      "width": 24,
      "height": 20,
      "target": "#cc5df0",
      "luma": 49.8
    },
    {
      "key": "hostSkin",
      "label": "HOST SKIN",
      "x": 423,
      "y": 455,
      "width": 20,
      "height": 25,
      "target": "#e8adb2",
      "luma": 72.9
    },
    {
      "key": "sideSkin",
      "label": "SIDE SKIN",
      "x": 110,
      "y": 475,
      "width": 15,
      "height": 20,
      "target": "#a97c84",
      "luma": 52.7
    },
    {
      "key": "neutralShirt",
      "label": "NEUTRAL SHIRT",
      "x": 390,
      "y": 545,
      "width": 80,
      "height": 40,
      "target": "#9c93d2",
      "luma": 60.3
    }
  ]
} as const;

export type WaitingRoomGoldenTrace = typeof WAITING_ROOM_GOLDEN_TRACE;
