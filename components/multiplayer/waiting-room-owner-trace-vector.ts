// QA-ONLY OWNER TRACE VECTOR.
// Derived directly from owner-authored trace.
// Do not use as runtime scene-generation input.
//
// Source coordinates are sampled from the owner upload itself (IMG_2724(1).png),
// not from WaitingRoomStage3D, waiting-room-sketch-blueprint, or the legacy
// waiting-room-golden-trace geometry. Curved samples are rendered through
// Catmull-Rom -> cubic SVG segments that pass through the sampled points.

export type OwnerTraceAccuracy = "pixel-traced" | "approximate-occluded";
export type OwnerTracePoint = readonly [x: number, y: number];
export type OwnerTracePath = {
  readonly id: string;
  readonly points: readonly OwnerTracePoint[];
  readonly accuracy: OwnerTraceAccuracy;
};

export const WAITING_ROOM_OWNER_TRACE_VECTOR = {
  "id": "owner-authored-vector-trace-v4",
  "source": {
    "uploadName": "IMG_2724(1).png",
    "sha256": "59615be18d091205f0d65f8b772d7fd1db0c8b70e65f4dcd2f8b32dde722b7fb",
    "width": 768,
    "height": 1364,
    "stageHeight": 928,
    "stageCrop": {
      "x": 0,
      "y": 0,
      "width": 768,
      "height": 928
    }
  },
  "geometryAuthority": {
    "kind": "owner-authored-vector-trace",
    "method": "direct-pixel-sampling",
    "coordinateSpace": "owner-source-stage-crop-768x928",
    "smoothing": "catmull-rom-to-cubic-through-sampled-points",
    "rasterRuntimeDependency": false
  },
  "roof": {
    "chords": [
      {
        "id": "roof-truss-upper",
        "points": [
          [
            90,
            60
          ],
          [
            122,
            65
          ],
          [
            154,
            66
          ],
          [
            186,
            80
          ],
          [
            218,
            80
          ],
          [
            250,
            85
          ],
          [
            282,
            86
          ],
          [
            314,
            88
          ],
          [
            346,
            90
          ],
          [
            378,
            90
          ],
          [
            410,
            90
          ],
          [
            442,
            91
          ],
          [
            474,
            89
          ],
          [
            506,
            85
          ],
          [
            538,
            81
          ],
          [
            570,
            81
          ],
          [
            602,
            73
          ],
          [
            634,
            67
          ],
          [
            666,
            57
          ],
          [
            678,
            58
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-truss-lower",
        "points": [
          [
            90,
            73
          ],
          [
            122,
            82
          ],
          [
            154,
            86
          ],
          [
            186,
            93
          ],
          [
            218,
            99
          ],
          [
            250,
            104
          ],
          [
            282,
            107
          ],
          [
            314,
            109
          ],
          [
            346,
            111
          ],
          [
            378,
            111
          ],
          [
            410,
            111
          ],
          [
            442,
            110
          ],
          [
            474,
            107
          ],
          [
            506,
            104
          ],
          [
            538,
            99
          ],
          [
            570,
            94
          ],
          [
            602,
            87
          ],
          [
            634,
            84
          ],
          [
            666,
            74
          ],
          [
            678,
            72
          ]
        ],
        "accuracy": "pixel-traced"
      }
    ],
    "continuations": [
      {
        "id": "roof-left-continuation",
        "points": [
          [
            0,
            24
          ],
          [
            28,
            38
          ],
          [
            58,
            50
          ],
          [
            90,
            60
          ]
        ],
        "accuracy": "approximate-occluded"
      },
      {
        "id": "roof-right-continuation",
        "points": [
          [
            678,
            58
          ],
          [
            708,
            49
          ],
          [
            739,
            36
          ],
          [
            767,
            22
          ]
        ],
        "accuracy": "approximate-occluded"
      }
    ],
    "rim": [
      {
        "id": "roof-rim-upper",
        "points": [
          [
            0,
            91
          ],
          [
            48,
            114
          ],
          [
            96,
            132
          ],
          [
            144,
            145
          ],
          [
            192,
            156
          ],
          [
            240,
            163
          ],
          [
            288,
            168
          ],
          [
            336,
            170
          ],
          [
            384,
            171
          ],
          [
            432,
            170
          ],
          [
            480,
            168
          ],
          [
            528,
            162
          ],
          [
            576,
            155
          ],
          [
            624,
            145
          ],
          [
            672,
            131
          ],
          [
            720,
            113
          ],
          [
            767,
            91
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-rim-lower",
        "points": [
          [
            0,
            96
          ],
          [
            48,
            114
          ],
          [
            96,
            132
          ],
          [
            144,
            145
          ],
          [
            192,
            156
          ],
          [
            240,
            167
          ],
          [
            288,
            172
          ],
          [
            336,
            175
          ],
          [
            384,
            176
          ],
          [
            432,
            175
          ],
          [
            480,
            172
          ],
          [
            528,
            166
          ],
          [
            576,
            155
          ],
          [
            624,
            145
          ],
          [
            672,
            131
          ],
          [
            720,
            114
          ],
          [
            767,
            96
          ]
        ],
        "accuracy": "pixel-traced"
      }
    ],
    "braces": [
      {
        "id": "roof-brace-1",
        "points": [
          [
            100,
            60
          ],
          [
            128,
            80
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-2",
        "points": [
          [
            128,
            80
          ],
          [
            156,
            66
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-3",
        "points": [
          [
            156,
            66
          ],
          [
            184,
            93
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-4",
        "points": [
          [
            184,
            93
          ],
          [
            212,
            79
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-5",
        "points": [
          [
            212,
            79
          ],
          [
            240,
            102
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-6",
        "points": [
          [
            240,
            102
          ],
          [
            268,
            87
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-7",
        "points": [
          [
            268,
            87
          ],
          [
            296,
            108
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-8",
        "points": [
          [
            296,
            108
          ],
          [
            324,
            89
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-9",
        "points": [
          [
            324,
            89
          ],
          [
            352,
            111
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-10",
        "points": [
          [
            352,
            111
          ],
          [
            380,
            90
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-11",
        "points": [
          [
            380,
            90
          ],
          [
            408,
            111
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-12",
        "points": [
          [
            408,
            111
          ],
          [
            436,
            88
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-13",
        "points": [
          [
            436,
            88
          ],
          [
            464,
            108
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-14",
        "points": [
          [
            464,
            108
          ],
          [
            492,
            87
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-15",
        "points": [
          [
            492,
            87
          ],
          [
            520,
            102
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-16",
        "points": [
          [
            520,
            102
          ],
          [
            548,
            79
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-17",
        "points": [
          [
            548,
            79
          ],
          [
            576,
            93
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-18",
        "points": [
          [
            576,
            93
          ],
          [
            604,
            73
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-19",
        "points": [
          [
            604,
            73
          ],
          [
            632,
            84
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "roof-brace-20",
        "points": [
          [
            632,
            84
          ],
          [
            660,
            62
          ]
        ],
        "accuracy": "pixel-traced"
      }
    ]
  },
  "wings": {
    "left": {
      "outline": [
        {
          "id": "left-wing-top",
          "points": [
            [
              0,
              135
            ],
            [
              24,
              145
            ],
            [
              48,
              153
            ],
            [
              72,
              162
            ],
            [
              96,
              170
            ],
            [
              120,
              177
            ],
            [
              144,
              183
            ],
            [
              168,
              189
            ],
            [
              176,
              191
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-wing-outer-vertical",
          "points": [
            [
              176,
              191
            ],
            [
              176,
              445
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-wing-bottom",
          "points": [
            [
              0,
              433
            ],
            [
              24,
              435
            ],
            [
              48,
              436
            ],
            [
              72,
              438
            ],
            [
              96,
              439
            ],
            [
              120,
              440
            ],
            [
              144,
              441
            ],
            [
              168,
              442
            ],
            [
              174,
              442
            ]
          ],
          "accuracy": "pixel-traced"
        }
      ],
      "innerBoundaries": [
        {
          "id": "left-wing-inner-boundary",
          "points": [
            [
              71,
              158
            ],
            [
              71,
              439
            ]
          ],
          "accuracy": "pixel-traced"
        }
      ],
      "rails": [
        {
          "id": "left-rail-1",
          "points": [
            [
              0,
              187
            ],
            [
              24,
              195
            ],
            [
              48,
              202
            ],
            [
              72,
              207
            ],
            [
              96,
              215
            ],
            [
              120,
              221
            ],
            [
              144,
              227
            ],
            [
              168,
              233
            ],
            [
              174,
              234
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-2",
          "points": [
            [
              0,
              240
            ],
            [
              24,
              246
            ],
            [
              48,
              249
            ],
            [
              72,
              255
            ],
            [
              96,
              260
            ],
            [
              120,
              265
            ],
            [
              144,
              270
            ],
            [
              168,
              274
            ],
            [
              174,
              275
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-3",
          "points": [
            [
              0,
              287
            ],
            [
              24,
              292
            ],
            [
              48,
              297
            ],
            [
              72,
              301
            ],
            [
              96,
              305
            ],
            [
              120,
              309
            ],
            [
              144,
              313
            ],
            [
              168,
              316
            ],
            [
              174,
              316
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-4",
          "points": [
            [
              0,
              340
            ],
            [
              24,
              344
            ],
            [
              48,
              344
            ],
            [
              72,
              350
            ],
            [
              96,
              350
            ],
            [
              120,
              353
            ],
            [
              144,
              355
            ],
            [
              168,
              357
            ],
            [
              174,
              358
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "left-rail-5",
          "points": [
            [
              0,
              384
            ],
            [
              24,
              387
            ],
            [
              48,
              390
            ],
            [
              72,
              392
            ],
            [
              96,
              394
            ],
            [
              120,
              396
            ],
            [
              144,
              398
            ],
            [
              168,
              400
            ],
            [
              174,
              400
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
              24,
              435
            ],
            [
              48,
              436
            ],
            [
              72,
              438
            ],
            [
              96,
              439
            ],
            [
              120,
              440
            ],
            [
              144,
              441
            ],
            [
              168,
              442
            ],
            [
              174,
              442
            ]
          ],
          "accuracy": "pixel-traced"
        }
      ]
    },
    "right": {
      "outline": [
        {
          "id": "right-wing-top",
          "points": [
            [
              592,
              191
            ],
            [
              616,
              185
            ],
            [
              640,
              179
            ],
            [
              664,
              172
            ],
            [
              688,
              164
            ],
            [
              712,
              157
            ],
            [
              736,
              146
            ],
            [
              760,
              138
            ],
            [
              767,
              135
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-wing-outer-vertical",
          "points": [
            [
              592,
              191
            ],
            [
              592,
              445
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-wing-bottom",
          "points": [
            [
              594,
              442
            ],
            [
              618,
              441
            ],
            [
              642,
              440
            ],
            [
              666,
              439
            ],
            [
              690,
              438
            ],
            [
              714,
              436
            ],
            [
              738,
              437
            ],
            [
              762,
              433
            ],
            [
              767,
              433
            ]
          ],
          "accuracy": "pixel-traced"
        }
      ],
      "innerBoundaries": [
        {
          "id": "right-wing-inner-boundary",
          "points": [
            [
              697,
              158
            ],
            [
              697,
              439
            ]
          ],
          "accuracy": "pixel-traced"
        }
      ],
      "rails": [
        {
          "id": "right-rail-1",
          "points": [
            [
              594,
              234
            ],
            [
              618,
              229
            ],
            [
              642,
              223
            ],
            [
              666,
              216
            ],
            [
              690,
              210
            ],
            [
              714,
              204
            ],
            [
              738,
              198
            ],
            [
              762,
              193
            ],
            [
              767,
              191
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-2",
          "points": [
            [
              594,
              275
            ],
            [
              618,
              271
            ],
            [
              642,
              266
            ],
            [
              666,
              261
            ],
            [
              690,
              256
            ],
            [
              714,
              251
            ],
            [
              738,
              245
            ],
            [
              762,
              241
            ],
            [
              767,
              240
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-3",
          "points": [
            [
              594,
              318
            ],
            [
              618,
              316
            ],
            [
              642,
              310
            ],
            [
              666,
              306
            ],
            [
              690,
              302
            ],
            [
              714,
              298
            ],
            [
              738,
              294
            ],
            [
              762,
              288
            ],
            [
              767,
              287
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-4",
          "points": [
            [
              594,
              357
            ],
            [
              618,
              355
            ],
            [
              642,
              353
            ],
            [
              666,
              350
            ],
            [
              690,
              348
            ],
            [
              714,
              345
            ],
            [
              738,
              342
            ],
            [
              762,
              341
            ],
            [
              767,
              340
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-5",
          "points": [
            [
              594,
              400
            ],
            [
              618,
              398
            ],
            [
              642,
              397
            ],
            [
              666,
              395
            ],
            [
              690,
              392
            ],
            [
              714,
              390
            ],
            [
              738,
              389
            ],
            [
              762,
              385
            ],
            [
              767,
              384
            ]
          ],
          "accuracy": "pixel-traced"
        },
        {
          "id": "right-rail-6",
          "points": [
            [
              594,
              442
            ],
            [
              618,
              441
            ],
            [
              642,
              440
            ],
            [
              666,
              439
            ],
            [
              690,
              438
            ],
            [
              714,
              436
            ],
            [
              738,
              437
            ],
            [
              762,
              433
            ],
            [
              767,
              433
            ]
          ],
          "accuracy": "pixel-traced"
        }
      ]
    }
  },
  "columns": {
    "left": {
      "id": "left-neon-column",
      "points": [
        [
          31,
          119
        ],
        [
          49,
          124
        ],
        [
          48,
          452
        ],
        [
          29,
          450
        ]
      ],
      "accuracy": "pixel-traced"
    },
    "right": {
      "id": "right-neon-column",
      "points": [
        [
          719,
          124
        ],
        [
          738,
          119
        ],
        [
          740,
          450
        ],
        [
          721,
          452
        ]
      ],
      "accuracy": "pixel-traced"
    }
  },
  "risers": [
    {
      "id": "riser-1",
      "top": {
        "id": "riser-1-top",
        "points": [
          [
            0,
            457
          ],
          [
            48,
            459
          ],
          [
            96,
            461
          ],
          [
            144,
            463
          ],
          [
            192,
            465
          ],
          [
            240,
            466
          ],
          [
            288,
            467
          ],
          [
            336,
            468
          ],
          [
            384,
            468
          ],
          [
            432,
            468
          ],
          [
            480,
            467
          ],
          [
            528,
            466
          ],
          [
            576,
            465
          ],
          [
            624,
            463
          ],
          [
            672,
            461
          ],
          [
            720,
            459
          ],
          [
            767,
            457
          ]
        ],
        "accuracy": "pixel-traced"
      },
      "lower": {
        "id": "riser-1-lower",
        "points": [
          [
            0,
            481
          ],
          [
            48,
            481
          ],
          [
            96,
            481
          ],
          [
            144,
            482
          ],
          [
            192,
            483
          ],
          [
            240,
            483
          ],
          [
            288,
            483
          ],
          [
            336,
            483
          ],
          [
            384,
            483
          ],
          [
            432,
            483
          ],
          [
            480,
            483
          ],
          [
            528,
            483
          ],
          [
            576,
            484
          ],
          [
            624,
            482
          ],
          [
            672,
            481
          ],
          [
            720,
            481
          ],
          [
            767,
            481
          ]
        ],
        "accuracy": "pixel-traced"
      }
    },
    {
      "id": "riser-2",
      "top": {
        "id": "riser-2-top",
        "points": [
          [
            0,
            507
          ],
          [
            48,
            508
          ],
          [
            96,
            508
          ],
          [
            144,
            508
          ],
          [
            192,
            505
          ],
          [
            240,
            505
          ],
          [
            288,
            505
          ],
          [
            336,
            505
          ],
          [
            384,
            505
          ],
          [
            432,
            505
          ],
          [
            480,
            505
          ],
          [
            528,
            505
          ],
          [
            576,
            505
          ],
          [
            624,
            508
          ],
          [
            672,
            508
          ],
          [
            720,
            509
          ],
          [
            767,
            511
          ]
        ],
        "accuracy": "pixel-traced"
      },
      "lower": {
        "id": "riser-2-lower",
        "points": [
          [
            0,
            534
          ],
          [
            48,
            531
          ],
          [
            96,
            530
          ],
          [
            144,
            529
          ],
          [
            192,
            528
          ],
          [
            240,
            528
          ],
          [
            288,
            527
          ],
          [
            336,
            527
          ],
          [
            384,
            527
          ],
          [
            432,
            527
          ],
          [
            480,
            527
          ],
          [
            528,
            527
          ],
          [
            576,
            528
          ],
          [
            624,
            529
          ],
          [
            672,
            529
          ],
          [
            720,
            531
          ],
          [
            767,
            534
          ]
        ],
        "accuracy": "pixel-traced"
      }
    },
    {
      "id": "riser-3",
      "top": {
        "id": "riser-3-top",
        "points": [
          [
            0,
            576
          ],
          [
            48,
            565
          ],
          [
            96,
            562
          ],
          [
            144,
            559
          ],
          [
            192,
            557
          ],
          [
            240,
            556
          ],
          [
            288,
            555
          ],
          [
            336,
            554
          ],
          [
            384,
            554
          ],
          [
            432,
            554
          ],
          [
            480,
            555
          ],
          [
            528,
            556
          ],
          [
            576,
            557
          ],
          [
            624,
            559
          ],
          [
            672,
            561
          ],
          [
            720,
            565
          ],
          [
            767,
            576
          ]
        ],
        "accuracy": "pixel-traced"
      },
      "lower": {
        "id": "riser-3-lower",
        "points": [
          [
            0,
            613
          ],
          [
            48,
            609
          ],
          [
            96,
            604
          ],
          [
            144,
            601
          ],
          [
            192,
            592
          ],
          [
            240,
            590
          ],
          [
            288,
            589
          ],
          [
            336,
            589
          ],
          [
            384,
            589
          ],
          [
            432,
            589
          ],
          [
            480,
            589
          ],
          [
            528,
            590
          ],
          [
            576,
            592
          ],
          [
            624,
            601
          ],
          [
            672,
            604
          ],
          [
            720,
            609
          ],
          [
            767,
            613
          ]
        ],
        "accuracy": "pixel-traced"
      }
    }
  ],
  "floor": {
    "frontRim": {
      "id": "floor-front-rim",
      "points": [
        [
          0,
          668
        ],
        [
          48,
          662
        ],
        [
          96,
          655
        ],
        [
          144,
          644
        ],
        [
          192,
          641
        ],
        [
          240,
          639
        ],
        [
          288,
          638
        ],
        [
          336,
          638
        ],
        [
          384,
          637
        ],
        [
          432,
          638
        ],
        [
          480,
          638
        ],
        [
          528,
          640
        ],
        [
          576,
          642
        ],
        [
          624,
          644
        ],
        [
          672,
          656
        ],
        [
          720,
          663
        ],
        [
          767,
          668
        ]
      ],
      "accuracy": "pixel-traced"
    },
    "gridHorizontal": [
      {
        "id": "floor-grid-horizontal-1",
        "points": [
          [
            0,
            700
          ],
          [
            48,
            695
          ],
          [
            96,
            689
          ],
          [
            144,
            687
          ],
          [
            192,
            680
          ],
          [
            240,
            678
          ],
          [
            288,
            676
          ],
          [
            336,
            675
          ],
          [
            384,
            675
          ],
          [
            432,
            676
          ],
          [
            480,
            677
          ],
          [
            528,
            679
          ],
          [
            576,
            682
          ],
          [
            624,
            685
          ],
          [
            672,
            690
          ],
          [
            720,
            696
          ],
          [
            767,
            701
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "floor-grid-horizontal-2",
        "points": [
          [
            0,
            729
          ],
          [
            48,
            722
          ],
          [
            96,
            719
          ],
          [
            144,
            715
          ],
          [
            192,
            711
          ],
          [
            240,
            708
          ],
          [
            288,
            706
          ],
          [
            336,
            705
          ],
          [
            384,
            704
          ],
          [
            432,
            705
          ],
          [
            480,
            707
          ],
          [
            528,
            710
          ],
          [
            576,
            713
          ],
          [
            624,
            714
          ],
          [
            672,
            719
          ],
          [
            720,
            724
          ],
          [
            767,
            730
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "floor-grid-horizontal-3",
        "points": [
          [
            0,
            749
          ],
          [
            48,
            741
          ],
          [
            96,
            737
          ],
          [
            144,
            734
          ],
          [
            192,
            730
          ],
          [
            240,
            728
          ],
          [
            288,
            726
          ],
          [
            336,
            724
          ],
          [
            384,
            724
          ],
          [
            432,
            725
          ],
          [
            480,
            726
          ],
          [
            528,
            728
          ],
          [
            576,
            730
          ],
          [
            624,
            733
          ],
          [
            672,
            737
          ],
          [
            720,
            741
          ],
          [
            767,
            749
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "floor-grid-horizontal-4",
        "points": [
          [
            0,
            777
          ],
          [
            48,
            767
          ],
          [
            96,
            759
          ],
          [
            144,
            754
          ],
          [
            192,
            751
          ],
          [
            240,
            747
          ],
          [
            288,
            744
          ],
          [
            336,
            743
          ],
          [
            384,
            741
          ],
          [
            432,
            743
          ],
          [
            480,
            746
          ],
          [
            528,
            743
          ],
          [
            576,
            749
          ],
          [
            624,
            757
          ],
          [
            672,
            759
          ],
          [
            720,
            772
          ],
          [
            767,
            780
          ]
        ],
        "accuracy": "approximate-occluded"
      },
      {
        "id": "floor-grid-horizontal-5",
        "points": [
          [
            0,
            808
          ],
          [
            48,
            804
          ],
          [
            96,
            806
          ],
          [
            144,
            803
          ],
          [
            192,
            799
          ],
          [
            240,
            796
          ],
          [
            288,
            794
          ],
          [
            336,
            793
          ],
          [
            384,
            793
          ],
          [
            432,
            794
          ],
          [
            480,
            796
          ],
          [
            528,
            797
          ],
          [
            576,
            800
          ],
          [
            624,
            803
          ],
          [
            672,
            802
          ],
          [
            720,
            805
          ],
          [
            767,
            807
          ]
        ],
        "accuracy": "approximate-occluded"
      }
    ],
    "gridVertical": [
      {
        "id": "floor-grid-vertical-left",
        "points": [
          [
            269,
            677
          ],
          [
            154,
            926
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "floor-grid-vertical-center",
        "points": [
          [
            384,
            676
          ],
          [
            385,
            926
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "floor-grid-vertical-right",
        "points": [
          [
            499,
            677
          ],
          [
            636,
            926
          ]
        ],
        "accuracy": "pixel-traced"
      },
      {
        "id": "floor-grid-vertical-left-edge",
        "points": [
          [
            0,
            901
          ],
          [
            111,
            926
          ]
        ],
        "accuracy": "approximate-occluded"
      },
      {
        "id": "floor-grid-vertical-right-edge",
        "points": [
          [
            767,
            901
          ],
          [
            657,
            926
          ]
        ],
        "accuracy": "approximate-occluded"
      }
    ],
    "bottomBoundary": {
      "id": "floor-bottom-boundary",
      "points": [
        [
          10,
          926
        ],
        [
          384,
          926
        ],
        [
          758,
          926
        ]
      ],
      "accuracy": "approximate-occluded"
    }
  },
  "rings": {
    "leftOuter": {
      "cx": 104.5,
      "cy": 700.5,
      "accuracy": "pixel-traced",
      "ellipses": [
        {
          "rx": 86.5,
          "ry": 20.5
        },
        {
          "rx": 78,
          "ry": 16.5
        },
        {
          "rx": 69,
          "ry": 12.5
        }
      ]
    },
    "leftNear": {
      "cx": 244,
      "cy": 757,
      "accuracy": "pixel-traced",
      "ellipses": [
        {
          "rx": 101,
          "ry": 27
        },
        {
          "rx": 91,
          "ry": 21
        },
        {
          "rx": 80,
          "ry": 16
        }
      ]
    },
    "host": {
      "cx": 389,
      "cy": 850,
      "accuracy": "pixel-traced",
      "ellipses": [
        {
          "rx": 155,
          "ry": 47
        },
        {
          "rx": 141,
          "ry": 39
        },
        {
          "rx": 128,
          "ry": 31
        }
      ]
    },
    "rightNear": {
      "cx": 529.5,
      "cy": 758.5,
      "accuracy": "pixel-traced",
      "ellipses": [
        {
          "rx": 103.5,
          "ry": 28.5
        },
        {
          "rx": 94,
          "ry": 22
        },
        {
          "rx": 83,
          "ry": 16.5
        }
      ]
    },
    "rightOuter": {
      "cx": 669,
      "cy": 710,
      "accuracy": "pixel-traced",
      "ellipses": [
        {
          "rx": 85,
          "ry": 21
        },
        {
          "rx": 77,
          "ry": 17
        },
        {
          "rx": 68,
          "ry": 12.5
        }
      ]
    }
  },
  "centerPanel": {
    "x": 178,
    "y": 176,
    "width": 412,
    "height": 270,
    "accuracy": "approximate-occluded"
  },
  "logo": {
    "bbox": {
      "x": 190,
      "y": 242,
      "width": 391,
      "height": 78,
      "accuracy": "pixel-traced"
    },
    "subtitleBox": {
      "x": 271,
      "y": 324,
      "width": 225,
      "height": 20,
      "accuracy": "pixel-traced"
    }
  },
  "spotlights": [],
  "notes": {
    "spotlights": "No beam boundary is explicit enough in the owner trace; beams are intentionally omitted.",
    "floorOcclusion": "Lower floor arcs cross ring glow/controls and are tagged approximate-occluded rather than presented as exact."
  }
} as const;
