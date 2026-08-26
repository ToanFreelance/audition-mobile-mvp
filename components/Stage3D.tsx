"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Stage3DProps = {
  pulseToken?: number;
};

type DancerRig = {
  root: THREE.Group;
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  phase: number;
  main: boolean;
  baseY: number;
};

const COLORS = {
  pink: 0xff4fd8,
  cyan: 0x62d8ff,
  violet: 0x8c7dff,
  skin: 0xf0b39b,
  hair: 0x241a2b,
  black: 0x10111d,
  floor: 0x130f28
};

export default function Stage3D({
  pulseToken = 0
}: Stage3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pulseRef = useRef(pulseToken);

  pulseRef.current = pulseToken;

  useEffect(() => {
    const host = hostRef.current;

    if (!host) return;

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x080717);

    scene.fog = new THREE.FogExp2(
      0x080717,
      0.045
    );

    const camera =
      new THREE.PerspectiveCamera(
        43,
        16 / 9,
        0.1,
        100
      );

    camera.position.set(
      0,
      4.1,
      13.5
    );

    camera.lookAt(
      0,
      2.6,
      0
    );

    const renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
      });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.75)
    );

    renderer.setSize(
      host.clientWidth,
      host.clientHeight,
      false
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.08;

    renderer.domElement.className =
      "stage-3d-canvas";

    host.appendChild(
      renderer.domElement
    );

    const stage = new THREE.Group();

    scene.add(stage);

    /*
     * Lighting
     */

    scene.add(
      new THREE.HemisphereLight(
        0xaaa6ff,
        0x090817,
        1.8
      )
    );

    const keyLight =
      new THREE.DirectionalLight(
        0xffeaff,
        2.2
      );

    keyLight.position.set(
      2,
      8,
      8
    );

    scene.add(keyLight);

    const spotData = [
      [-5.2, 7.5, 4.5, COLORS.cyan],
      [-2.0, 8.5, 2.5, COLORS.pink],
      [2.0, 8.5, 2.5, COLORS.violet],
      [5.2, 7.5, 4.5, COLORS.pink]
    ] as const;

    const spotLights: THREE.SpotLight[] = [];

    for (const [
      x,
      y,
      z,
      color
    ] of spotData) {
      const light =
        new THREE.SpotLight(
          color,
          55,
          18,
          Math.PI / 7,
          0.55,
          1.1
        );

      light.position.set(
        x,
        y,
        z
      );

      light.target.position.set(
        x * 0.3,
        0,
        -0.5
      );

      scene.add(
        light,
        light.target
      );

      spotLights.push(light);
    }

    /*
     * Back wall
     */

    const wall =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          18,
          8,
          0.5
        ),
        new THREE.MeshStandardMaterial({
          color: 0x111025,
          roughness: 0.85,
          metalness: 0.1
        })
      );

    wall.position.set(
      0,
      4.2,
      -2.8
    );

    stage.add(wall);

    /*
     * Wall panels
     */

    for (
      let i = -4;
      i <= 4;
      i++
    ) {
      const panel =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            1.55,
            6.8,
            0.08
          ),
          new THREE.MeshStandardMaterial({
            color:
              i % 2 === 0
                ? 0x16152f
                : 0x101126,
            roughness: 0.75,
            metalness: 0.2
          })
        );

      panel.position.set(
        i * 1.85,
        4.15,
        -2.48
      );

      stage.add(panel);
    }

    /*
     * Stage frame
     */

    const frameMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x281545,
        emissive: 0x6d2478,
        emissiveIntensity: 0.8,
        metalness: 0.55,
        roughness: 0.35
      });

    const topFrame =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          14.5,
          0.16,
          0.18
        ),
        frameMaterial
      );

    topFrame.position.set(
      0,
      7.55,
      -2.15
    );

    stage.add(topFrame);

    for (const x of [-7.2, 7.2]) {
      const pillar =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.16,
            7.6,
            0.18
          ),
          frameMaterial
        );

      pillar.position.set(
        x,
        3.8,
        -2.15
      );

      stage.add(pillar);
    }

    /*
     * Dance floor
     */

    const floor =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          20,
          18
        ),
        new THREE.MeshStandardMaterial({
          color: COLORS.floor,
          roughness: 0.62,
          metalness: 0.45
        })
      );

    floor.rotation.x =
      -Math.PI / 2;

    floor.position.set(
      0,
      0,
      1.2
    );

    stage.add(floor);

    /*
     * Floor rings
     */

    for (
      let i = 0;
      i < 6;
      i++
    ) {
      const ring =
        new THREE.Mesh(
          new THREE.RingGeometry(
            1.8 + i * 0.7,
            1.82 + i * 0.7,
            64
          ),
          new THREE.MeshBasicMaterial({
            color:
              i % 2
                ? COLORS.cyan
                : COLORS.pink,
            transparent: true,
            opacity: 0.16,
            side:
              THREE.DoubleSide
          })
        );

      ring.rotation.x =
        -Math.PI / 2;

      ring.position.set(
        0,
        0.018,
        1.2
      );

      stage.add(ring);
    }

    /*
     * Neon CLUB AUDITION sign
     */

    const signTexture =
      makeNeonSignTexture();

    const sign =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          4.8,
          1.35
        ),
        new THREE.MeshBasicMaterial({
          map: signTexture,
          transparent: true,
          depthWrite: false
        })
      );

    sign.position.set(
      0,
      6.05,
      -2.12
    );

    stage.add(sign);

    /*
     * Speakers
     */

    createSpeaker(
      stage,
      -6.15,
      3.2,
      COLORS.cyan
    );

    createSpeaker(
      stage,
      6.15,
      3.2,
      COLORS.pink
    );

    /*
     * Crowd
     */

    const crowd =
      new THREE.Group();

    stage.add(crowd);

    for (
      let i = 0;
      i < 30;
      i++
    ) {
      const x =
        -8 +
        (i % 15) * 1.15;

      const z =
        -1.45 +
        Math.floor(i / 15) *
          0.42;

      const head =
        new THREE.Mesh(
          new THREE.SphereGeometry(
            0.18 +
              (i % 3) * 0.025,
            10,
            8
          ),
          new THREE.MeshStandardMaterial({
            color:
              i % 2
                ? 0x242341
                : 0x302443
          })
        );

      head.position.set(
        x,
        1.4 +
          (i % 3) * 0.08,
        z
      );

      crowd.add(head);

      const torso =
        new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.28,
            0.36,
            0.8,
            8
          ),
          new THREE.MeshStandardMaterial({
            color:
              i % 2
                ? 0x17172c
                : 0x21182f
          })
        );

      torso.position.set(
        x,
        0.92,
        z
      );

      crowd.add(torso);
    }

    /*
     * Dancers
     */

    const dancers: DancerRig[] = [];

    const dancerData = [
      {
        x: -4.4,
        z: 0.3,
        scale: 0.82,
        accent: COLORS.cyan,
        main: false,
        phase: 0.1
      },
      {
        x: -2.25,
        z: 0.1,
        scale: 0.96,
        accent: COLORS.pink,
        main: false,
        phase: 1.0
      },
      {
        x: 0,
        z: -0.05,
        scale: 1.25,
        accent: COLORS.pink,
        main: true,
        phase: 2.0
      },
      {
        x: 2.25,
        z: 0.1,
        scale: 0.96,
        accent: COLORS.violet,
        main: false,
        phase: 2.9
      },
      {
        x: 4.4,
        z: 0.3,
        scale: 0.82,
        accent: COLORS.cyan,
        main: false,
        phase: 3.8
      }
    ];

    for (const data of dancerData) {
      const rig =
        createDancer(
          data.accent,
          data.main
        );

      rig.root.position.set(
        data.x,
        0.02,
        data.z
      );

      rig.root.scale.setScalar(
        data.scale
      );

      rig.phase =
        data.phase;

      rig.main =
        data.main;

      rig.baseY =
        0.02;

      dancers.push(rig);

      stage.add(rig.root);
    }

    /*
     * Responsive camera
     */

    const onResize = () => {
      const width =
        Math.max(
          1,
          host.clientWidth
        );

      const height =
        Math.max(
          1,
          host.clientHeight
        );

      const portrait =
        height > width;

      camera.fov =
        portrait ? 48 : 43;

      camera.position.set(
        0,
        portrait ? 3.8 : 4.1,
        portrait ? 15.8 : 13.5
      );

      camera.lookAt(
        0,
        portrait ? 2.7 : 2.6,
        0
      );

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
        false
      );
    };

    const resizeObserver =
      new ResizeObserver(
        onResize
      );

    resizeObserver.observe(
      host
    );

    onResize();

    /*
     * Animation
     */

    const clock =
      new THREE.Clock();

    let animationFrame = 0;
    let previousPulse =
      pulseRef.current;

    let pulseUntil = 0;
    let disposed = false;

    const animate = () => {
      if (disposed) return;

      animationFrame =
        window.requestAnimationFrame(
          animate
        );

      const elapsed =
        clock.getElapsedTime();

      if (
        pulseRef.current !==
        previousPulse
      ) {
        previousPulse =
          pulseRef.current;

        pulseUntil =
          elapsed + 0.24;

        for (
          const light of spotLights
        ) {
          light.intensity = 85;
        }
      }

      const pulsing =
        elapsed < pulseUntil;

      for (
        let i = 0;
        i < dancers.length;
        i++
      ) {
        const dancer =
          dancers[i];

        const local =
          elapsed *
            (dancer.main
              ? 2.35
              : 2.15) +
          dancer.phase;

        const bounce =
          Math.abs(
            Math.sin(local)
          ) * 0.065;

        const groove =
          Math.sin(
            local * 0.5
          ) * 0.055;

        const baseScale =
          dancer.main
            ? 1.25
            : i === 1 || i === 3
              ? 0.96
              : 0.82;

        const scaleBoost =
          pulsing &&
          dancer.main
            ? 1.035
            : 1;

        dancer.root.position.y =
          dancer.baseY +
          bounce +
          groove;

        dancer.root.rotation.y =
          Math.sin(
            local * 0.32
          ) * 0.12;

        dancer.body.rotation.z =
          Math.sin(
            local * 0.72
          ) * 0.04;

        dancer.leftArm.rotation.z =
          -0.25 -
          Math.sin(local) *
            0.32;

        dancer.rightArm.rotation.z =
          0.25 +
          Math.sin(
            local + 0.8
          ) * 0.32;

        dancer.leftLeg.rotation.x =
          Math.sin(
            local + 0.6
          ) * 0.13;

        dancer.rightLeg.rotation.x =
          Math.sin(
            local +
              Math.PI +
              0.6
          ) * 0.13;

        dancer.root.scale.setScalar(
          baseScale *
            scaleBoost
        );
      }

      stage.rotation.y =
        Math.sin(
          elapsed * 0.11
        ) * 0.012;

      for (
        let i = 0;
        i < spotLights.length;
        i++
      ) {
        if (!pulsing) {
          spotLights[i].intensity =
            38 +
            (Math.sin(
              elapsed * 2.1 +
                i
            ) +
              1) *
              8;
        }
      }

      const signPulse =
        1 +
        Math.max(
          0,
          Math.sin(
            elapsed *
              Math.PI *
              4.266
          )
        ) *
          0.006;

      sign.scale.set(
        signPulse,
        signPulse,
        signPulse
      );

      renderer.render(
        scene,
        camera
      );
    };

    animate();

    return () => {
      disposed = true;

      window.cancelAnimationFrame(
        animationFrame
      );

      resizeObserver.disconnect();

      renderer.dispose();

      signTexture.dispose();

      if (
        renderer.domElement.parentElement ===
        host
      ) {
        host.removeChild(
          renderer.domElement
        );
      }

      scene.traverse(
        (object: THREE.Object3D) => {
          const mesh =
            object as THREE.Mesh;

          if (mesh.geometry) {
            mesh.geometry.dispose();
          }

          const material =
            mesh.material;

          if (
            Array.isArray(material)
          ) {
            material.forEach(
              (item) =>
                item.dispose()
            );
          } else if (material) {
            material.dispose();
          }
        }
      );
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="stage-3d"
      aria-label="3D dance stage"
    />
  );
}

function makeNeonSignTexture() {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = 900;
  canvas.height = 260;

  const ctx =
    canvas.getContext("2d")!;

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font =
    "900 78px Arial Black, Arial, sans-serif";

  ctx.shadowColor =
    "#ff4fd8";

  ctx.shadowBlur = 28;

  ctx.fillStyle =
    "#f67ce8";

  ctx.fillText(
    "AUDITION",
    450,
    145
  );

  ctx.shadowBlur = 12;

  ctx.font =
    "700 34px Arial, sans-serif";

  ctx.fillStyle =
    "#f2dcff";

  ctx.fillText(
    "CLUB",
    450,
    62
  );

  const texture =
    new THREE.CanvasTexture(
      canvas
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}

function createSpeaker(
  parent: THREE.Group,
  x: number,
  y: number,
  accent: number
) {
  const group =
    new THREE.Group();

  group.position.set(
    x,
    y,
    -1.55
  );

  const cabinet =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.9,
        3.3,
        0.8
      ),
      new THREE.MeshStandardMaterial({
        color: 0x101020,
        roughness: 0.6,
        metalness: 0.3
      })
    );

  group.add(cabinet);

  for (
    let i = 0;
    i < 4;
    i++
  ) {
    const cone =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.27 -
            i * 0.025,
          0.27 -
            i * 0.025,
          0.06,
          24
        ),
        new THREE.MeshStandardMaterial({
          color: 0x16162a,
          emissive: accent,
          emissiveIntensity: 0.35
        })
      );

    cone.rotation.x =
      Math.PI / 2;

    cone.position.set(
      0,
      1.05 -
        i * 0.72,
      0.43
    );

    group.add(cone);
  }

  parent.add(group);
}

function createDancer(
  accent: number,
  main: boolean
): DancerRig {
  const root =
    new THREE.Group();

  const body =
    new THREE.Group();

  const leftArm =
    new THREE.Group();

  const rightArm =
    new THREE.Group();

  const leftLeg =
    new THREE.Group();

  const rightLeg =
    new THREE.Group();

  const skin =
    new THREE.MeshStandardMaterial({
      color: COLORS.skin,
      roughness: 0.62
    });

  const hair =
    new THREE.MeshStandardMaterial({
      color: COLORS.hair,
      roughness: 0.5
    });

  const outfit =
    new THREE.MeshStandardMaterial({
      color: accent,
      roughness: 0.42,
      metalness: 0.08
    });

  const dark =
    new THREE.MeshStandardMaterial({
      color: COLORS.black,
      roughness: 0.55
    });

  const shoe =
    new THREE.MeshStandardMaterial({
      color: 0x1a1b29,
      roughness: 0.5,
      metalness: 0.15
    });

  const shadow =
    new THREE.Mesh(
      new THREE.CircleGeometry(
        main ? 1.15 : 0.85,
        48
      ),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28
      })
    );

  shadow.rotation.x =
    -Math.PI / 2;

  shadow.position.y =
    0.015;

  root.add(shadow);

  const torso =
    new THREE.Mesh(
      new THREE.CapsuleGeometry(
        main ? 0.47 : 0.39,
        main ? 1.1 : 0.9,
        6,
        12
      ),
      outfit
    );

  torso.position.y = 2.0;

  body.add(torso);

  if (main) {
    const jacket =
      new THREE.Mesh(
        new THREE.CapsuleGeometry(
          0.54,
          0.62,
          6,
          12
        ),
        dark
      );

    jacket.position.set(
      0,
      2.2,
      -0.05
    );

    jacket.scale.set(
      1,
      0.8,
      0.72
    );

    body.add(jacket);
  }

  const neck =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.13,
        0.15,
        0.25,
        12
      ),
      skin
    );

  neck.position.y =
    2.85;

  body.add(neck);

  const head =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        main ? 0.5 : 0.42,
        20,
        16
      ),
      skin
    );

  head.position.y =
    3.3;

  body.add(head);

  const hairCap =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        main ? 0.53 : 0.45,
        20,
        12
      ),
      hair
    );

  hairCap.position.set(
    0,
    3.47,
    -0.02
  );

  hairCap.scale.set(
    1,
    0.52,
    1.02
  );

  body.add(hairCap);

  const eyeMaterial =
    new THREE.MeshBasicMaterial({
      color: 0x181424
    });

  for (
    const x of [-0.16, 0.16]
  ) {
    const eye =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.035,
          8,
          8
        ),
        eyeMaterial
      );

    eye.position.set(
      x,
      3.3,
      0.42
    );

    body.add(eye);
  }

  const mouth =
    new THREE.Mesh(
      new THREE.TorusGeometry(
        0.12,
        0.018,
        6,
        18,
        Math.PI
      ),
      new THREE.MeshBasicMaterial({
        color: 0x6a2945
      })
    );

  mouth.rotation.x =
    Math.PI;

  mouth.position.set(
    0,
    3.16,
    0.43
  );

  body.add(mouth);

  root.add(body);

  leftArm.add(
    createLimb(
      skin,
      0.13,
      new THREE.Vector3(
        0,
        0,
        0
      ),
      new THREE.Vector3(
        -0.55,
        -0.85,
        0
      )
    )
  );

  rightArm.add(
    createLimb(
      skin,
      0.13,
      new THREE.Vector3(
        0,
        0,
        0
      ),
      new THREE.Vector3(
        0.55,
        -0.85,
        0
      )
    )
  );

  leftArm.position.set(
    -0.4,
    2.55,
    0
  );

  rightArm.position.set(
    0.4,
    2.55,
    0
  );

  body.add(
    leftArm,
    rightArm
  );

  leftLeg.add(
    createLimb(
      shoe,
      0.17,
      new THREE.Vector3(
        0,
        0,
        0
      ),
      new THREE.Vector3(
        -0.16,
        -1.25,
        0
      )
    )
  );

  rightLeg.add(
    createLimb(
      shoe,
      0.17,
      new THREE.Vector3(
        0,
        0,
        0
      ),
      new THREE.Vector3(
        0.16,
        -1.25,
        0
      )
    )
  );

  leftLeg.position.set(
    -0.22,
    1.35,
    0
  );

  rightLeg.position.set(
    0.22,
    1.35,
    0
  );

  root.add(
    leftLeg,
    rightLeg
  );

  return {
    root,
    body,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    phase: 0,
    main,
    baseY: 0.02
  };
}

function createLimb(
  material: THREE.Material,
  radius: number,
  start: THREE.Vector3,
  end: THREE.Vector3
) {
  const direction =
    new THREE.Vector3()
      .subVectors(end, start);

  const length =
    direction.length();

  const mesh =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius,
        radius * 1.08,
        length,
        10
      ),
      material
    );

  mesh.position
    .copy(start)
    .add(end)
    .multiplyScalar(0.5);

  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(
      0,
      1,
      0
    ),
    direction.normalize()
  );

  return mesh;
}