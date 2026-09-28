export type SketchNormalizedPoint = {
  x: number;
  y: number;
};

export type SketchNormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SketchNeonPalette = {
  core: number;
  glow: number;
  highlight: number;
  lowlight: number;
};

// V35 OWNER TRACE RUNTIME COPY.
// This is a runtime-owned COPY of the owner-approved QA geometry.
// It intentionally does NOT import waiting-room-owner-trace-vector.
// Runtime presentation can consume these copied measurements, while the QA
// authority remains independent and anti-circular.
type RuntimeTracePoint = readonly [number, number];
const OWNER_TRACE_RUNTIME_SCALE = 1.125;

const OWNER_TRACE_RUNTIME_POINTS = {
  "roofUpper": [
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
  "roofLower": [
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
  "roofRimUpper": [
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
  "roofRimLower": [
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
  "roofContinuations": [
    [
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
    [
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
    ]
  ],
  "roofBraces": [
    [
      [
        100,
        60
      ],
      [
        128,
        80
      ]
    ],
    [
      [
        128,
        80
      ],
      [
        156,
        66
      ]
    ],
    [
      [
        156,
        66
      ],
      [
        184,
        93
      ]
    ],
    [
      [
        184,
        93
      ],
      [
        212,
        79
      ]
    ],
    [
      [
        212,
        79
      ],
      [
        240,
        102
      ]
    ],
    [
      [
        240,
        102
      ],
      [
        268,
        87
      ]
    ],
    [
      [
        268,
        87
      ],
      [
        296,
        108
      ]
    ],
    [
      [
        296,
        108
      ],
      [
        324,
        89
      ]
    ],
    [
      [
        324,
        89
      ],
      [
        352,
        111
      ]
    ],
    [
      [
        352,
        111
      ],
      [
        380,
        90
      ]
    ],
    [
      [
        380,
        90
      ],
      [
        408,
        111
      ]
    ],
    [
      [
        408,
        111
      ],
      [
        436,
        88
      ]
    ],
    [
      [
        436,
        88
      ],
      [
        464,
        108
      ]
    ],
    [
      [
        464,
        108
      ],
      [
        492,
        87
      ]
    ],
    [
      [
        492,
        87
      ],
      [
        520,
        102
      ]
    ],
    [
      [
        520,
        102
      ],
      [
        548,
        79
      ]
    ],
    [
      [
        548,
        79
      ],
      [
        576,
        93
      ]
    ],
    [
      [
        576,
        93
      ],
      [
        604,
        73
      ]
    ],
    [
      [
        604,
        73
      ],
      [
        632,
        84
      ]
    ],
    [
      [
        632,
        84
      ],
      [
        660,
        62
      ]
    ]
  ],
  "leftTop": [
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
  "leftBottom": [
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
  "rightTop": [
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
  "rightBottom": [
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
  "leftRails": [
    [
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
    [
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
    [
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
    [
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
    [
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
    [
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
    ]
  ],
  "rightRails": [
    [
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
    [
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
    [
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
    [
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
    [
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
    [
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
    ]
  ],
  "leftColumn": [
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
  "rightColumn": [
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
  "risers": [
    {
      "top": [
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
      "lower": [
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
      ]
    },
    {
      "top": [
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
      "lower": [
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
      ]
    },
    {
      "top": [
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
      "lower": [
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
      ]
    }
  ],
  "floorFrontRim": [
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
  "floorHorizontal": [
    [
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
    [
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
    [
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
    [
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
    [
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
    ]
  ],
  "floorVertical": [
    [
      [
        269,
        677
      ],
      [
        154,
        926
      ]
    ],
    [
      [
        384,
        676
      ],
      [
        385,
        926
      ]
    ],
    [
      [
        499,
        677
      ],
      [
        636,
        926
      ]
    ],
    [
      [
        0,
        901
      ],
      [
        111,
        926
      ]
    ],
    [
      [
        767,
        901
      ],
      [
        657,
        926
      ]
    ]
  ],
  "floorBottomBoundary": [
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
  ]
} as const;

function scaleRuntimeTracePoint([x, y]: RuntimeTracePoint): RuntimeTracePoint {
  return [x * OWNER_TRACE_RUNTIME_SCALE, y * OWNER_TRACE_RUNTIME_SCALE];
}

function scaledRuntimeTracePoints(points: readonly RuntimeTracePoint[]) {
  return points.map(scaleRuntimeTracePoint);
}

function runtimeCurveCommands(points: readonly RuntimeTracePoint[]) {
  if (points.length < 2) return "";
  let commands = "";
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    commands += ` C ${c1x.toFixed(3)} ${c1y.toFixed(3)} ${c2x.toFixed(3)} ${c2y.toFixed(3)} ${p2[0].toFixed(3)} ${p2[1].toFixed(3)}`;
  }
  return commands;
}

function runtimeTracePath(sourcePoints: readonly RuntimeTracePoint[]) {
  const points = scaledRuntimeTracePoints(sourcePoints);
  if (points.length === 0) return "";
  return `M ${points[0][0].toFixed(3)} ${points[0][1].toFixed(3)}${runtimeCurveCommands(points)}`;
}

function runtimeTraceRibbonPath(
  topSource: readonly RuntimeTracePoint[],
  lowerSource: readonly RuntimeTracePoint[],
) {
  const top = scaledRuntimeTracePoints(topSource);
  const lower = scaledRuntimeTracePoints(lowerSource).reverse();
  return `M ${top[0][0].toFixed(3)} ${top[0][1].toFixed(3)}${runtimeCurveCommands(top)} L ${lower[0][0].toFixed(3)} ${lower[0][1].toFixed(3)}${runtimeCurveCommands(lower)} Z`;
}

function runtimeTracePolygon(sourcePoints: readonly RuntimeTracePoint[]) {
  return scaledRuntimeTracePoints(sourcePoints)
    .map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)
    .join(" ");
}

function sampleRuntimeTraceCurve(sourcePoints: readonly RuntimeTracePoint[], t: number) {
  const points = scaledRuntimeTracePoints(sourcePoints);
  const clamped = Math.max(0, Math.min(1, t));
  if (points.length === 1) return { x: points[0][0], y: points[0][1] };
  const scaledIndex = clamped * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaledIndex));
  const u = scaledIndex - index;
  const p0 = points[index - 1] ?? points[index];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[index + 2] ?? p2;
  const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6] as const;
  const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6] as const;
  const v = 1 - u;
  return {
    x: v * v * v * p1[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p2[0],
    y: v * v * v * p1[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p2[1],
  };
}

export function sketchRoofPoint(t: number, lower = false) {
  return sampleRuntimeTraceCurve(
    lower ? OWNER_TRACE_RUNTIME_POINTS.roofLower : OWNER_TRACE_RUNTIME_POINTS.roofUpper,
    t,
  );
}

function createSketchRoof() {
  return {
    upperPath: runtimeTracePath(OWNER_TRACE_RUNTIME_POINTS.roofUpper),
    lowerPath: runtimeTracePath(OWNER_TRACE_RUNTIME_POINTS.roofLower),
    rimUpperPath: runtimeTracePath(OWNER_TRACE_RUNTIME_POINTS.roofRimUpper),
    rimLowerPath: runtimeTracePath(OWNER_TRACE_RUNTIME_POINTS.roofRimLower),
    continuations: OWNER_TRACE_RUNTIME_POINTS.roofContinuations.map(runtimeTracePath),
    braces: OWNER_TRACE_RUNTIME_POINTS.roofBraces.map(points => {
      const [start, end] = scaledRuntimeTracePoints(points);
      return `M ${start[0].toFixed(3)} ${start[1].toFixed(3)} L ${end[0].toFixed(3)} ${end[1].toFixed(3)}`;
    }),
  };
}

export const WAITING_ROOM_SKETCH_BLUEPRINT = {
  id: "golden-864x1536-v12",
  source: {
    width: 864,
    height: 1536,
    // Stage ends at the top edge of the avatar strip in the accepted reference.
    stageViewportPx: { x: 0, y: 0, width: 864, height: 1044 },
  },
  screen: {
    centerLineX: 0.5,
    truss: {
      apex: { x: 0.506510, y: 0.066650 },
      leftEnd: { x: 0.117188, y: 0.043945 },
      rightEnd: { x: 0.882813, y: 0.042480 },
    },
    columns: {
      leftCenter: { x: 0.050781, y: 0.209106 },
      rightCenter: { x: 0.949870, y: 0.209106 },
    },
    centerOpening: {
      leftX: 0.229167,
      rightX: 0.770833,
    },
    logo: {
      // Owner-trace V35 envelope copied after QA-vector approval.
      bbox: { x: 0.247396, y: 0.177246, width: 0.509115, height: 0.057129 },
      center: { x: 0.501953, y: 0.205811 },
      subtitleCenter: { x: 0.499349, y: 0.244263 },
    },
    rings: {
      // Owner-trace V35 ring centers, normalized against the 864x1536 runtime reference.
      leftOuter: { x: 0.136068, y: 0.513062 },
      leftNear: { x: 0.317708, y: 0.554443 },
      host: { x: 0.506510, y: 0.622559 },
      rightNear: { x: 0.689453, y: 0.555542 },
      rightOuter: { x: 0.871094, y: 0.520020 },
    },
    actorScreenHeight: {
      // Full visible actor height / golden stage height (1044 px).
      leftOuter: 0.3266,
      leftNear: 0.3650,
      host: 0.5517,
      rightNear: 0.3726,
      rightOuter: 0.3209,
    },
    controls: {
      stageArrowCenterY: 0.704,
    },
    referenceSamples: {
      // Latest pixel samples from the owner-provided golden reference.
      upperCenter: 0x5b1e52,
      upperLeft: 0x510fbb,
      upperRight: 0x4d30c0,
      leftWall: 0x081560,
      rightWall: 0x130d61,
      floorBaseBlue: 0x1106af,
      floorLeftReflection: 0x120bba,
      floorRightReflection: 0x110364,
      cyanColumn: 0x22c7fd,
      magentaColumn: 0xf94bfc,
      logoEdge: 0xd228f3,
      hostRingBlue: 0x0e0fbf,
      pinkRing: 0x950cdf,
    },
  },
  traceArchitecture: {
    enabled: true,
    source: "owner-verified-copy-v35",
    viewBox: { width: 864, height: 1044 },
    wallLeftPath: runtimeTraceRibbonPath(
      OWNER_TRACE_RUNTIME_POINTS.leftTop,
      OWNER_TRACE_RUNTIME_POINTS.leftBottom,
    ),
    wallRightPath: runtimeTraceRibbonPath(
      OWNER_TRACE_RUNTIME_POINTS.rightTop,
      OWNER_TRACE_RUNTIME_POINTS.rightBottom,
    ),
    railsLeft: OWNER_TRACE_RUNTIME_POINTS.leftRails.map(runtimeTracePath),
    railsRight: OWNER_TRACE_RUNTIME_POINTS.rightRails.map(runtimeTracePath),
    truss: createSketchRoof(),
    columns: {
      left: {
        x: 32.625,
        y: 133.875,
        width: 22.500,
        height: 374.625,
        polygon: runtimeTracePolygon(OWNER_TRACE_RUNTIME_POINTS.leftColumn),
      },
      right: {
        x: 808.875,
        y: 133.875,
        width: 23.625,
        height: 374.625,
        polygon: runtimeTracePolygon(OWNER_TRACE_RUNTIME_POINTS.rightColumn),
      },
    },
    risers: OWNER_TRACE_RUNTIME_POINTS.risers.map(riser => ({
      surface: runtimeTraceRibbonPath(riser.top, riser.lower),
      edge: runtimeTracePath(riser.top),
      lowerEdge: runtimeTracePath(riser.lower),
    })),
    floor: {
      frontRim: runtimeTracePath(OWNER_TRACE_RUNTIME_POINTS.floorFrontRim),
      gridVertical: OWNER_TRACE_RUNTIME_POINTS.floorVertical.map(runtimeTracePath),
      gridHorizontal: OWNER_TRACE_RUNTIME_POINTS.floorHorizontal.map(runtimeTracePath),
      bottomBoundary: runtimeTracePath(OWNER_TRACE_RUNTIME_POINTS.floorBottomBoundary),
      sideLeft: runtimeTracePath(OWNER_TRACE_RUNTIME_POINTS.floorFrontRim.slice(0, 5)),
      sideRight: runtimeTracePath(OWNER_TRACE_RUNTIME_POINTS.floorFrontRim.slice(-5)),
    },
  },
  ownerOverrides: {
    // The sketch puts the host crown/name too high. Owner explicitly requested
    // the runtime label to follow the same head-relative offset as other actors.
    hostWideLabelOffsetPx: -14,
    guestWideLabelOffsetPx: -14,
  },
  palette: {
    columns: {
      leftCyan: {
        core: 0x22c7fd,
        glow: 0x5deaff,
        highlight: 0xbaf7ff,
        lowlight: 0x075ed0,
      } satisfies SketchNeonPalette,
      rightMagenta: {
        core: 0xf94bfc,
        glow: 0xff78ff,
        highlight: 0xffb1ff,
        lowlight: 0x8b0ac6,
      } satisfies SketchNeonPalette,
    },
    logo: {
      fill: 0xc105f1,
      edge: 0xd228f3,
      glow: 0xf329f5,
      shadow: 0x5f0aa1,
      subtitle: 0x90aaff,
    },
    backdrop: {
      dark: 0x050327,
      mid: 0x120541,
      violet: 0x49105f,
    },
    truss: {
      dark: 0x07105c,
      body: 0x2947a0,
      bright: 0x6686ff,
      glow: 0x456cff,
    },
    structure: {
      leftBody: 0x0b1458,
      rightBody: 0x160d61,
      uprightBody: 0x1b1c58,
      riserEdge: 0xe6beff,
      riserGlow: 0xb24cff,
    },
    beams: {
      cyan: 0x62ddff,
      blue: 0x78bfff,
      violet: 0xb96dff,
      pinkViolet: 0xd96bec,
      pink: 0xea72e1,
      magenta: 0xff65dc,
    },
    floor: {
      baseDark: 0x0b0b4b,
      baseMid: 0x3035da,
      baseViolet: 0x561db2,
      surface: 0x9aa8ef,
      emissive: 0x29268f,
      reflectorTint: 0x8a8da8,
      halo: 0x8092ff,
      runway: 0xc279ff,
      cyanReflection: 0x43ecff,
      violetReflection: 0xb57aff,
      magentaReflection: 0xf86aeb,
    },
    rings: {
      maleCyan: 0x39d7ff,
      femalePink: 0xea30ff,
      cyanHighlight: 0xbdf4ff,
      pinkHighlight: 0xffa4ff,
    },
    status: {
      ready: 0x58f0d8,
      notReady: 0xf878f8,
    },
    crown: {
      highlight: 0xf5db74,
      body: 0xe7b94e,
      shadow: 0x8c5a1e,
    },
    actor: {
      key: 0xffd2cb,
      fill: 0xffeee7,
      hemisphereSky: 0x7887d8,
      hemisphereGround: 0x010108,
    },
  },
  material: {
    floor: {
      opacity: 0.50,
      roughness: 0.035,
      metalness: 0.64,
      clearcoat: 1,
      clearcoatRoughness: 0.014,
      emissiveIntensity: 0.32,
      haloOpacity: 0.135,
      runwayOpacity: 0.068,
    },
    riser: {
      treadColor: 0x4b22a7,
      treadEmissive: 0x6d26c2,
      treadEmissiveIntensity: 0.50,
      treadRoughness: 0.055,
      treadMetalness: 0.62,
      faceColor: 0x0c154b,
      faceEmissive: 0x251366,
      faceEmissiveIntensity: 0.29,
      faceRoughness: 0.18,
      faceMetalness: 0.42,
    },
    rails: {
      opacity: 0.60,
      glowOpacity: 0.13,
      emissiveIntensity: 0.72,
      roughness: 0.32,
      metalness: 0.44,
    },
  },
  scene: {
    camera: {
      wide: {
        fov: 35,
        position: { x: 0, y: 3.84, z: 12.78 },
        lookAt: { x: 0, y: 1.86, z: 0.5 },
      },
    },
    formation: {
      // V35: x/z are inverse-projected from the verified owner ring centers.
      // Actor y/scale hierarchy stays locked; ring footprint is calibrated independently.
      center: {
        x: 0.0312, y: 0, z: 4.0969, rotationY: 0, scale: 0.785,
        ringScale: 0.9850, ringDepthScale: 0.7222,
      },
      leftNear: {
        x: -1.0269, y: 0.045, z: 2.4654, rotationY: 0.028, scale: 0.645,
        ringScale: 0.7544, ringDepthScale: 0.7498,
      },
      rightNear: {
        x: 1.0642, y: 0.045, z: 2.4963, rotationY: -0.028, scale: 0.647,
        ringScale: 0.7709, ringDepthScale: 0.7702,
      },
      leftOuter: {
        x: -2.2946, y: 0.12, z: 1.1616, rotationY: 0.052, scale: 0.664,
        ringScale: 0.7232, ringDepthScale: 0.7442,
      },
      rightOuter: {
        x: 2.2938, y: 0.12, z: 1.4021, rotationY: -0.052, scale: 0.637,
        ringScale: 0.6966, ringDepthScale: 0.7605,
      },
    },
    floor: {
      radius: 9,
      haloInner: 4.45,
      haloOuter: 8.4,
      runwayWidth: 9.55,
      runwayDepth: 3.35,
    },
    backdrop: {
      width: 6.55,
      height: 3.65,
      y: 3.18,
      z: -5.28,
      glowOpacity: 0.08,
    },
    risers: {
      count: 3,
      halfWidth: 7.6,
      topStart: 0.30,
      topStep: 0.44,
      frontBaseZ: -1.16,
      frontTierStepZ: 0.96,
      frontCurveDepth: 2.62,
      frontCurvePower: 1.62,
      backZ: -5.08,
    },
    wing: {
      railRows: 6,
      railYStart: 1.08,
      railYStep: 0.68,
      railRadius: 0.020,
      railGlowRadius: 0.035,
      railPoints: [
        // Hybrid V29: the 3D rail starts deep near the center opening and bows
        // outward toward the camera, restoring the curved venue depth lost in V28.
        { x: 2.58, y: 0, z: -4.48 },
        { x: 2.74, y: 0.020, z: -4.34 },
        { x: 3.00, y: 0.060, z: -3.98 },
        { x: 3.38, y: 0.125, z: -3.28 },
        { x: 3.84, y: 0.205, z: -2.18 },
        { x: 4.20, y: 0.270, z: -0.92 },
      ],
      uprights: [
        { x: 2.58, z: -4.18, height: 4.18 },
        { x: 3.32, z: -3.28, height: 4.48 },
      ],
      column: {
        x: 3.62,
        z: -2.52,
        bottom: 1.06,
        top: 5.28,
      },
    },
    beams: [
      { x: -3.44, y: 5.86, z: -2.34, color: 0x57ddff, targetX: -2.55, opacity: 0.20 },
      { x: -1.76, y: 5.68, z: -3.08, color: 0x758cff, targetX: -0.92, opacity: 0.16 },
      { x: -0.88, y: 5.62, z: -3.24, color: 0xa75cff, targetX: -0.30, opacity: 0.078 },
      { x: 0.88, y: 5.62, z: -3.24, color: 0xd34dff, targetX: 0.30, opacity: 0.078 },
      { x: 1.76, y: 5.68, z: -3.08, color: 0xee62df, targetX: 0.92, opacity: 0.16 },
      { x: 3.44, y: 5.86, z: -2.34, color: 0xff55d8, targetX: 2.55, opacity: 0.20 },
    ],
    lighting: {
      // V26: preserve deep wall values while restoring localized neon punch.
      hemisphereIntensity: 0.68,
      keyIntensity: 1.58,
      fillIntensity: 0.90,
      cyanRimIntensity: 17.5,
      magentaRimIntensity: 17.5,
      overheadIntensity: 9.8,
      beamSpotIntensity: 10.2,
      upperGlowColor: 0x7c32ff,
      upperGlowIntensity: 2.8,
    },
    truss: {
      // Golden roof: sides stay near the top edge while the center dips to ~10%
      // of stage height. V24's curve was too shallow and visually clipped.
      upperPoints: [
        { x: -6.45, y: 6.26, z: -1.34 },
        { x: -4.20, y: 6.02, z: -2.05 },
        { x: -2.08, y: 5.68, z: -2.92 },
        { x: 0, y: 5.52, z: -3.28 },
        { x: 2.08, y: 5.68, z: -2.92 },
        { x: 4.20, y: 6.02, z: -2.05 },
        { x: 6.45, y: 6.26, z: -1.34 },
      ],
      curveTension: 0.38,
      lowerOffsetY: -0.18,
      lowerOffsetZ: 0.025,
    },
  },
} as const;

export function sketchColorCss(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function sketchColorRgba(color: number, alpha: number) {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function sketchStagePoint(point: SketchNormalizedPoint): SketchNormalizedPoint {
  const source = WAITING_ROOM_SKETCH_BLUEPRINT.source;
  const stage = source.stageViewportPx;
  const px = point.x * source.width;
  const py = point.y * source.height;
  return {
    x: (px - stage.x) / stage.width,
    y: (py - stage.y) / stage.height,
  };
}

export function sketchStageRect(rect: SketchNormalizedRect): SketchNormalizedRect {
  const source = WAITING_ROOM_SKETCH_BLUEPRINT.source;
  const stage = source.stageViewportPx;
  return {
    x: ((rect.x * source.width) - stage.x) / stage.width,
    y: ((rect.y * source.height) - stage.y) / stage.height,
    width: (rect.width * source.width) / stage.width,
    height: (rect.height * source.height) / stage.height,
  };
}
