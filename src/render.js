import * as THREE from "three";
import { CONFIG, OBSTACLES, WEAPONS, WEAPON_IDS } from "./config.js";

import { PAINTS } from "./loadout.js";
import { ChaseCamera } from "./camera.js";

const COLORS = {
  mint: 0x62d5b7,
  orange: 0xeb8544,
  dark: 0x263b37,
  steel: 0x68736a,
  tire: 0x25302d,
  cream: 0xe8e2b9,
};
const material = (color, options = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.25,
    ...options,
  });
const seeded = () => {
  let state = 9173;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

function mesh(geometry, mat, parent, x = 0, y = 0, z = 0, cast = true) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = cast;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function box(parent, mat, size, position, cast = true) {
  return mesh(new THREE.BoxGeometry(...size), mat, parent, ...position, cast);
}
function cylinder(parent, mat, radius, length, position, segments = 12) {
  return mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    mat,
    parent,
    ...position,
  );
}
function bevelGeometry(width, depth, height) {
  const shape = new THREE.Shape(),
    w = width / 2,
    d = depth / 2,
    c = 0.16;
  shape.moveTo(-w + c, -d);
  shape.lineTo(w - c, -d);
  shape.lineTo(w, -d + c);
  shape.lineTo(w, d - c);
  shape.lineTo(w - c, d);
  shape.lineTo(-w + c, d);
  shape.lineTo(-w, d - c);
  shape.lineTo(-w, -d + c);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.045,
    bevelThickness: 0.045,
  });
  geometry.translate(0, 0, -height / 2);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
function textTexture(
  text,
  background,
  foreground = "#f1eed1",
  width = 512,
  height = 128,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = foreground;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.floor(height * 0.45)}px Arial`;
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGround() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1687;
  const ctx = canvas.getContext("2d"),
    random = seeded();
  ctx.fillStyle = "#879185";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 13000; i++) {
    const tone = random() > 0.5 ? "255,248,218" : "32,49,36";
    ctx.fillStyle = `rgba(${tone},${random() * 0.065})`;
    ctx.fillRect(
      random() * canvas.width,
      random() * canvas.height,
      random() * 9 + 1,
      random() * 7 + 1,
    );
  }
  ctx.strokeStyle = "#57645750";
  ctx.lineWidth = 2;
  for (let x = 0; x < canvas.width; x += 241) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 241) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#ece3ae96";
  ctx.lineWidth = 6;
  ctx.strokeRect(72, 72, canvas.width - 144, canvas.height - 144);
  ctx.setLineDash([38, 28]);
  ctx.strokeStyle = "#d9d5ac4a";
  ctx.beginPath();
  ctx.arc(1024, 845, 330, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const b of OBSTACLES) {
    const x = ((b.x + 17 - b.hx - 0.5) / 34) * canvas.width;
    const y = ((b.z + 14 - b.hz - 0.5) / 28) * canvas.height;
    const width = ((b.hx * 2 + 1) / 34) * canvas.width,
      height = ((b.hz * 2 + 1) / 28) * canvas.height;
    ctx.strokeStyle = "#ead69ba8";
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#25382b25";
    ctx.fillRect(x + 5, y + 5, width - 10, height - 10);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + height + 9, width, 17);
    ctx.clip();
    for (let s = -20; s < width + 20; s += 24) {
      ctx.fillStyle = Math.floor(s / 24) % 2 === 0 ? "#d7bb70" : "#3c4636";
      ctx.beginPath();
      ctx.moveTo(x + s, y + height + 9);
      ctx.lineTo(x + s + 16, y + height + 9);
      ctx.lineTo(x + s + 4, y + height + 26);
      ctx.lineTo(x + s - 12, y + height + 26);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle = "#e7e2b778";
  ctx.font = "900 110px Arial";
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(1550, 1380);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("BB / 01", 0, 0);
  ctx.restore();
  ctx.font = "bold 25px monospace";
  ctx.fillStyle = "#364d3d9c";
  ctx.fillText("PATIO DE CHATARRA  ·  ZONA DE COMBATE", 1024, 125);
  // Painted starting bays and chevrons.
  for (const [x, y, color] of [
    [410, 1325, "#60bca777"],
    [1630, 300, "#dca77399"],
  ]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.strokeRect(x - 125, y - 85, 250, 170);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createMeleeWeapon(id, steel, black, paint) {
  const group = new THREE.Group(),
    pivot = new THREE.Group();
  group.add(pivot);
  let rotor = null;
  box(group, black, [1.1, 0.18, 0.2], [0, 0.65, -0.9]);
  if (id === "spike" || id === "forks") {
    const positions = id === "spike" ? [0] : [-0.45, 0.45];
    for (const x of positions) {
      const tip = mesh(
        new THREE.ConeGeometry(id === "spike" ? 0.22 : 0.17, 0.85, 5),
        steel,
        pivot,
        x,
        0.7,
        -1.35,
      );
      tip.rotation.x = -Math.PI / 2;
      box(pivot, paint, [0.3, 0.25, 0.35], [x, 0.7, -0.92]);
    }
  } else if (id === "hammer" || id === "mace") {
    pivot.position.set(0, 1.05, -0.1);
    box(pivot, steel, [0.14, 0.16, 1.25], [0, 0, -0.65]);
    cylinder(group, black, 0.2, 0.42, [0, 1.05, -0.1]).rotation.z = Math.PI / 2;
    if (id === "hammer") {
      mesh(bevelGeometry(0.92, 0.46, 0.4), steel, pivot, 0, 0, -1.48);
      box(pivot, paint, [0.42, 0.43, 0.5], [0, 0, -1.48]);
      for (const x of [-0.35, 0.35])
        box(pivot, black, [0.09, 0.42, 0.48], [x, 0, -1.48]);
    } else {
      mesh(new THREE.DodecahedronGeometry(0.38), steel, pivot, 0, 0, -1.35);
      for (const vector of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, -1],
      ]) {
        const direction = new THREE.Vector3(...vector);
        const tip = mesh(
          new THREE.ConeGeometry(0.11, 0.3, 4),
          steel,
          pivot,
          direction.x * 0.42,
          direction.y * 0.42,
          -1.35 + direction.z * 0.42,
        );
        tip.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction,
        );
      }
    }
  } else if (id === "saw") {
    box(group, paint, [0.35, 0.28, 0.65], [0, 0.7, -1.12]);
    rotor = new THREE.Group();
    rotor.position.set(0, 0.83, -1.4);
    pivot.add(rotor);
    const disc = cylinder(rotor, steel, 0.54, 0.16, [0, 0, 0], 18);
    disc.rotation.z = Math.PI / 2;
    cylinder(rotor, black, 0.15, 0.2, [0, 0, 0], 8).rotation.z = Math.PI / 2;
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const direction = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle));
      const tooth = mesh(
        new THREE.ConeGeometry(0.1, 0.2, 3),
        steel,
        rotor,
        0,
        direction.y * 0.59,
        direction.z * 0.59,
      );
      tooth.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction,
      );
    }
  } else {
    pivot.position.set(0, 0.7, -0.75);
    const points = [
      [-0.95, 0, 0],
      [0.95, 0, 0],
      [-0.95, -0.5, -1.02],
      [0.95, -0.5, -1.02],
      [-0.95, -0.18, 0],
      [0.95, -0.18, 0],
    ];
    const triangles = [
      0, 1, 2, 1, 3, 2, 0, 4, 1, 1, 4, 5, 0, 2, 4, 1, 5, 3, 4, 2, 5, 5, 2, 3,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        triangles.flatMap((index) => points[index]),
        3,
      ),
    );
    geometry.computeVertexNormals();
    mesh(geometry, paint, pivot);
    for (const x of [-0.65, 0, 0.65]) {
      const rail = box(pivot, steel, [0.1, 0.07, 1.13], [x, -0.22, -0.5]);
      rail.rotation.x = -0.46;
    }
    cylinder(group, black, 0.16, 1.1, [0, 0.7, -0.75]).rotation.z = Math.PI / 2;
  }
  return { group, pivot, rotor };
}

function animateMeleeWeapon(visual, robot, dt) {
  for (const [id, model] of Object.entries(visual.weapons)) {
    model.group.visible = id === robot.weaponId;
    if (!model.group.visible) continue;
    const weapon = WEAPONS[id];
    const elapsed = robot.attacking ? robot.attackElapsed : 0;
    const phase = robot.attacking ? Math.min(1, elapsed / weapon.duration) : 0;
    const raised = !robot.attacking
      ? 0
      : elapsed < weapon.windup
        ? elapsed / weapon.windup
        : elapsed < weapon.hitTime
          ? 1 - (elapsed - weapon.windup) / (weapon.hitTime - weapon.windup)
          : 0;
    model.pivot.rotation.set(0, 0, 0);
    model.group.position.z = 0;
    if (id === "hammer") model.pivot.rotation.x = raised * 1.35;
    if (id === "mace")
      model.pivot.rotation.y = robot.attacking
        ? Math.sin(phase * Math.PI * 2) * 0.95
        : 0;
    if (id === "wedge")
      model.pivot.rotation.x = robot.attacking
        ? Math.sin(phase * Math.PI) * 1.0
        : 0;
    if (id === "spike" || id === "forks")
      model.group.position.z = -Math.sin(phase * Math.PI) * 0.22;
    if (model.rotor)
      model.rotor.rotation.x += dt * (robot.attacking ? 35 : 1.5);
  }
}

function createRobot(color, id) {
  const group = new THREE.Group(),
    metal = material(color, { roughness: 0.52, metalness: 0.45 });
  const black = material(COLORS.dark),
    steel = material(0x9ca596, { metalness: 0.65, roughness: 0.45 });
  const rubber = material(COLORS.tire, { metalness: 0.05 }),
    cream = material(COLORS.cream);
  const emissive = new THREE.MeshStandardMaterial({
    color: 0xcaf8b4,
    emissive: 0x9bdc88,
    emissiveIntensity: 0.6,
  });
  const body = new THREE.Group();
  group.add(body);
  mesh(bevelGeometry(1.55, 1.9, 0.32), black, group, 0, 0.53, 0);
  mesh(bevelGeometry(1.7, 1.78, 0.36), metal, body, 0, 0.86, 0.02);
  const lid = mesh(bevelGeometry(1.43, 1.28, 0.13), metal, body, 0, 1.12, 0.18);
  lid.rotation.x = -0.08;
  box(group, black, [1.28, 0.1, 0.31], [0, 1.22, 0.52]);
  for (let i = -2; i <= 2; i++)
    box(group, steel, [0.07, 0.08, 0.27], [i * 0.2, 1.28, 0.52]);
  // Screws and scuffed corner plates.
  for (const x of [-0.59, 0.59])
    for (const z of [-0.36, 0.69]) {
      cylinder(group, steel, 0.045, 0.04, [x, 1.24, z], 6);
    }
  for (const x of [-0.77, 0.77]) {
    box(group, steel, [0.12, 0.21, 0.45], [x, 0.98, -0.5]);
    box(group, cream, [0.03, 0.06, 0.46], [x * 1.11, 0.88, 0.12]);
  }
  const weapons = Object.fromEntries(
    WEAPON_IDS.map((id) => {
      const model = createMeleeWeapon(id, steel, black, metal);
      model.group.visible = false;
      group.add(model.group);
      return [id, model];
    }),
  );
  const bumper = box(group, steel, [1.8, 0.18, 0.18], [0, 0.55, -1.04]);
  bumper.rotation.x = 0.18;
  for (const x of [-0.55, 0.55])
    box(group, emissive, [0.22, 0.12, 0.035], [x, 0.89, -0.9]);
  box(group, black, [0.32, 0.12, 0.23], [0, 1.28, 0.1]);
  const eye = box(
    group,
    id === 0 ? cream : black,
    [0.22, 0.05, 0.035],
    [0, 1.28, -0.025],
  );
  eye.material = material(id === 0 ? 0xecf6be : 0xffd099, {
    emissive: id === 0 ? 0x80d59b : 0xe87935,
    emissiveIntensity: 0.5,
  });
  const wheels = [];
  const rimPaint = material(color, { roughness: 0.35, metalness: 0.65 });
  for (const x of [-0.98, 0.98])
    for (const z of [-0.64, 0.64]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.44, z);
      group.add(wheel);
      wheels.push(wheel);
      wheel.userData.treads = [];
      const tire = cylinder(wheel, rubber, 0.43, 0.31, [0, 0, 0], 14);
      tire.rotation.z = Math.PI / 2;
      const hub = cylinder(wheel, steel, 0.25, 0.33, [0, 0, 0], 10);
      hub.rotation.z = Math.PI / 2;
      const cap = cylinder(wheel, black, 0.12, 0.35, [0, 0, 0], 6);
      cap.rotation.z = Math.PI / 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const tread = box(
          wheel,
          rubber,
          [0.34, 0.065, 0.1],
          [0, Math.cos(a) * 0.43, Math.sin(a) * 0.43],
        );
        tread.rotation.x = a;
        wheel.userData.treads.push(tread);
      }
      const ring = mesh(
        new THREE.TorusGeometry(0.29, 0.025, 6, 20),
        rimPaint,
        wheel,
        Math.sign(x) * 0.185,
        0,
        0,
      );
      ring.rotation.y = Math.PI / 2;
      box(group, black, [0.32, 0.12, 0.34], [x, 0.82, z]);
    }
  // Different silhouettes as well as colours: aerial/01 versus two armour fins.
  if (id === 0) {
    cylinder(group, steel, 0.023, 0.52, [0.53, 1.48, 0.59], 6);
    mesh(new THREE.SphereGeometry(0.075, 8, 6), metal, group, 0.53, 1.75, 0.59);
  } else {
    for (const x of [-0.47, 0.47]) {
      const fin = box(group, steel, [0.07, 0.28, 0.41], [x, 1.32, 0.34]);
      fin.rotation.x = -0.3;
    }
  }
  const badge = mesh(
    new THREE.PlaneGeometry(0.42, 0.35),
    new THREE.MeshBasicMaterial({
      map: textTexture(
        id === 0 ? "01" : "02",
        id === 0 ? "#244d42" : "#653523",
        "#efedc9",
        128,
        128,
      ),
    }),
    group,
    -0.36,
    1.26,
    -0.22,
  );
  badge.rotation.x = -Math.PI / 2;
  const shells = Object.fromEntries(
    ["balanced", "light", "armored"].map((key) => {
      const object = new THREE.Group();
      group.add(object);
      return [key, object];
    }),
  );
  for (const x of [-0.86, 0.86]) {
    box(shells.armored, metal, [0.14, 0.58, 1.72], [x, 0.99, 0.02]);
    for (const z of [-0.58, 0.6])
      cylinder(shells.armored, steel, 0.055, 0.035, [x, 1.3, z], 6);
    box(shells.light, steel, [0.08, 0.13, 1.12], [x * 0.85, 0.82, 0.2]);
  }
  for (let i = -2; i <= 2; i++)
    box(shells.light, black, [0.11, 0.025, 0.57], [i * 0.2, 1.08, 0.19]);
  const modules = Object.fromEntries(
    ["none", "motor", "actuator", "shield", "stabilizer"].map((key) => {
      const object = new THREE.Group();
      group.add(object);
      return [key, object];
    }),
  );
  for (const x of [-0.61, 0.61]) {
    box(modules.motor, black, [0.4, 0.33, 0.45], [x, 1.25, 0.66]);
    for (let i = 0; i < 3; i++)
      box(modules.motor, steel, [0.3, 0.035, 0.035], [x, 1.43, 0.53 + i * 0.1]);
    box(modules.motor, emissive, [0.21, 0.045, 0.03], [x, 1.34, 0.9]);
    cylinder(modules.actuator, steel, 0.09, 0.56, [x, 1.18, -0.48]);
    cylinder(modules.actuator, black, 0.14, 0.22, [x, 0.93, -0.48]);
  }
  for (const x of [-1.11, 1.11]) {
    const plate = box(
      modules.shield,
      metal,
      [0.1, 0.53, 1.42],
      [x, 0.73, -0.1],
    );
    plate.rotation.z = x > 0 ? -0.12 : 0.12;
    box(modules.shield, steel, [0.14, 0.07, 1.45], [x, 0.99, -0.1]);
  }
  cylinder(modules.stabilizer, black, 0.31, 0.12, [0, 1.4, 0.36], 20);
  cylinder(modules.stabilizer, steel, 0.23, 0.14, [0, 1.43, 0.36], 20);
  const gyro = mesh(
    new THREE.TorusGeometry(0.34, 0.035, 6, 24),
    rimPaint,
    modules.stabilizer,
    0,
    1.48,
    0.36,
  );
  gyro.rotation.x = Math.PI / 2;
  for (const x of [-0.65, 0.65])
    cylinder(modules.stabilizer, steel, 0.045, 0.6, [x, 1.45, 0.6], 6);
  box(modules.stabilizer, steel, [1.39, 0.07, 0.09], [0, 1.76, 0.6]);

  const groundRing = mesh(
    new THREE.TorusGeometry(1.36, 0.025, 4, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }),
    group,
    0,
    0.035,
    0,
    false,
  );
  groundRing.rotation.x = Math.PI / 2;
  const marker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: textTexture(
        id === 0 ? "▼ TÚ / REMACHE" : "◆ IA / ÓXIDO",
        "#1a312ad9",
        id === 0 ? "#acffd2" : "#ffc89b",
      ),
      depthTest: false,
      transparent: true,
    }),
  );
  marker.position.set(0, 2.25, 0);
  marker.scale.set(2.5, 0.62, 1);
  group.add(marker);
  return {
    group,
    wheels,
    metal,
    rimPaint,
    body,
    shells,
    modules,
    badge,
    marker,
    groundRing,
    weapons,
  };
}

export class Renderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, CONFIG.effects.pixelRatio),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa5b6a6);
    // A reusable studio reflection map gives painted metal shape without imported assets.
    const sky = document.createElement("canvas");
    sky.width = 512;
    sky.height = 256;
    const skyCtx = sky.getContext("2d"),
      gradient = skyCtx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#bfd7da");
    gradient.addColorStop(0.44, "#dce8df");
    gradient.addColorStop(0.5, "#819490");
    gradient.addColorStop(1, "#182b34");
    skyCtx.fillStyle = gradient;
    skyCtx.fillRect(0, 0, 512, 256);
    skyCtx.fillStyle = "#fff4d9";
    skyCtx.fillRect(70, 35, 55, 40);
    skyCtx.fillStyle = "#c3ddfa";
    skyCtx.fillRect(350, 50, 28, 70);
    const reflection = new THREE.CanvasTexture(sky);
    reflection.mapping = THREE.EquirectangularReflectionMapping;
    reflection.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromEquirectangular(reflection);
    this.scene.environment = this.environment.texture;
    reflection.dispose();
    pmrem.dispose();
    this.scene.environmentIntensity = 0.65;
    this.scene.fog = new THREE.Fog(0xa5b6a6, 55, 95);
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 120);
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shake = 0;
    this.time = 0;
    this.chase = new ChaseCamera();
    this.wasHome = null;
    this.scene.add(new THREE.HemisphereLight(0xf4f6d7, 0x40544a, 2.4));
    const sun = new THREE.DirectionalLight(0xffefc9, 3.1);
    sun.position.set(-16, 27, 12);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 22,
      bottom: -22,
      near: 1,
      far: 65,
    });
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);
    this.arena = new THREE.Group();
    this.scene.add(this.arena);
    this.workshop = new THREE.Group();
    this.scene.add(this.workshop);
    this.buildArena();
    this.buildWorkshop();
    this.previewAngle = 0;
    this.previewTime = 0;
    this.studioLight = new THREE.PointLight(0xb5e3ff, 16, 14, 2);
    this.studioLight.position.set(3, 5, 2);
    this.scene.add(this.studioLight);
    this.robots = [createRobot(COLORS.mint, 0), createRobot(COLORS.orange, 1)];
    this.robots.forEach((robot) => this.scene.add(robot.group));
    const sparkGeometry = new THREE.BoxGeometry(0.085, 0.085, 0.2),
      sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd083 });
    this.particles = Array.from({ length: CONFIG.effects.maxParticles }, () => {
      const object = mesh(
        sparkGeometry,
        sparkMaterial,
        this.scene,
        0,
        0,
        0,
        false,
      );
      object.visible = false;
      return { object, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 };
    });
    this.flipBounds = new THREE.Box3();
    this.partBounds = new THREE.Box3();
    this.cursor = 0;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    document.getElementById("garage").addEventListener("scroll", () => {
      this.layoutDirty = true;
    });
  }
  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.layoutDirty = true;
  }
  buildArena() {
    const steel = material(0x4d6155),
      rust = material(0x916c4d),
      cream = material(0xc3bd95),
      dark = material(0x35463d);
    const floor = material(0xffffff, {
      map: createGround(),
      roughness: 0.95,
      metalness: 0,
    });
    box(this.arena, material(0x4e6554), [90, 0.25, 80], [0, -0.48, 0], false);
    box(this.arena, floor, [34, 0.3, 28], [0, -0.16, 0], false);
    // Walls are visible low concrete/metal curbs at the exact collision limits.
    for (const z of [-14.25, 14.25]) {
      box(this.arena, cream, [35, 0.7, 0.5], [0, 0.3, z]);
      box(this.arena, steel, [35, 0.14, 0.56], [0, 0.69, z]);
    }
    for (const x of [-17.25, 17.25]) {
      box(this.arena, cream, [0.5, 0.7, 28], [x, 0.3, 0]);
      box(this.arena, steel, [0.56, 0.14, 28], [x, 0.69, 0]);
    }
    for (const b of OBSTACLES) {
      const base = material(
        b.kind === "container"
          ? 0x577563
          : b.kind === "crate"
            ? 0x847b59
            : 0xaaa482,
      );
      box(
        this.arena,
        base,
        [b.hx * 2, b.height, b.hz * 2],
        [b.x, b.height / 2, b.z],
      );
      box(
        this.arena,
        steel,
        [b.hx * 2 + 0.05, 0.12, b.hz * 2 + 0.05],
        [b.x, b.height + 0.02, b.z],
      );
      for (const x of [-b.hx + 0.1, b.hx - 0.1])
        for (const z of [-b.hz + 0.1, b.hz - 0.1]) {
          box(
            this.arena,
            dark,
            [0.13, b.height, 0.13],
            [b.x + x, b.height / 2, b.z + z],
          );
          cylinder(
            this.arena,
            cream,
            0.04,
            0.04,
            [b.x + x, b.height + 0.1, b.z + z],
            6,
          );
        }
      if (b.kind === "container") {
        for (let x = -b.hx + 0.3; x < b.hx; x += 0.38) {
          box(
            this.arena,
            base,
            [0.065, b.height - 0.24, 0.1],
            [b.x + x, b.height / 2, b.z + b.hz + 0.04],
          );
          box(
            this.arena,
            base,
            [0.065, b.height - 0.24, 0.1],
            [b.x + x, b.height / 2, b.z - b.hz - 0.04],
          );
        }
      } else if (b.kind === "crate") {
        box(
          this.arena,
          cream,
          [b.hx * 2 - 0.2, 0.16, 0.05],
          [b.x, b.height * 0.55, b.z + b.hz + 0.025],
        );
        const slash = box(
          this.arena,
          dark,
          [b.hx * 1.6, 0.13, 0.05],
          [b.x, b.height * 0.55, b.z + b.hz + 0.06],
        );
        slash.rotation.z = 0.35;
      }
      const label = mesh(
        new THREE.PlaneGeometry(b.kind === "barrier" ? 1.6 : 0.75, 0.32),
        new THREE.MeshBasicMaterial({
          map: textTexture(
            b.kind === "barrier" ? "PRECAUCIÓN" : "BB / 01",
            "#2b4435",
            "#ded6aa",
          ),
        }),
        this.arena,
        b.x,
        b.height * 0.63,
        b.z + b.hz + 0.07,
      );
      label.receiveShadow = false;
    }
    // Industrial perimeter is outside the playable region and behind the camera's sight lines.
    for (let x = -20; x <= 20; x += 4) {
      cylinder(this.arena, steel, 0.07, 3.6, [x, 1.65, -16.5], 6);
      box(this.arena, rust, [3.95, 1.9, 0.11], [x + 2, 1.2, -16.5]);
      for (let i = 0; i < 6; i++)
        box(
          this.arena,
          steel,
          [0.045, 1.8, 0.13],
          [x + 0.2 + i * 0.65, 1.3, -16.48],
        );
    }
    box(this.arena, cream, [9.5, 0.2, 0.2], [0, 3.37, -16.5]);
    const sign = mesh(
      new THREE.PlaneGeometry(6.5, 1.1),
      new THREE.MeshStandardMaterial({
        map: textTexture("PATIO DE CHATARRA", "#283f32", "#ece3b4"),
        roughness: 0.9,
      }),
      this.arena,
      0,
      2.75,
      -16.38,
    );
    sign.castShadow = true;
    for (const x of [-19.5, 19.5]) {
      cylinder(this.arena, dark, 0.12, 6, [x, 3, -12]);
      box(this.arena, steel, [1.4, 0.12, 0.2], [x - 0.4, 5.98, -12]);
      box(this.arena, cream, [0.8, 0.2, 0.45], [x - 0.9, 5.87, -12]);
      for (const z of [-8, -4, 0, 4, 8, 12]) {
        box(this.arena, rust, [0.4, 1.5, 3.9], [x, 0.7, z]);
        box(this.arena, steel, [0.46, 0.15, 3.9], [x, 1.5, z]);
      }
    }
    const random = seeded();
    for (let i = 0; i < 12; i++) {
      const x = (i < 6 ? -1 : 1) * (18.5 + random() * 3),
        z = -11 + random() * 22;
      const tyre = mesh(
        new THREE.TorusGeometry(0.46, 0.17, 6, 12),
        material(COLORS.tire),
        this.arena,
        x,
        0.25,
        z,
      );
      tyre.rotation.x = Math.PI / 2;
      if (i % 3 === 0) cylinder(this.arena, rust, 0.45, 1.1, [x, 1, z]);
    }
    box(this.arena, dark, [6.5, 2, 3.5], [-10, 1, -20]);
    box(this.arena, rust, [7, 0.2, 3.7], [-10, 2, -20]);
    for (let i = 0; i < 3; i++)
      box(this.arena, cream, [1.3, 0.6, 0.1], [-12 + i * 2, 1.35, -18.2]);
  }
  buildWorkshop() {
    const graphite = material(0x172d38, { roughness: 0.62, metalness: 0.25 }),
      steel = material(0x667e86, { roughness: 0.42, metalness: 0.7 });
    const floor = document.createElement("canvas");
    floor.width = floor.height = 512;
    const ctx = floor.getContext("2d");
    ctx.fillStyle = "#243c46";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#3c5560";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(floor);
    texture.colorSpace = THREE.SRGBColorSpace;
    box(
      this.workshop,
      material(0xffffff, { map: texture, roughness: 0.78 }),
      [22, 0.25, 18],
      [0, -0.35, -1],
    );
    cylinder(this.workshop, graphite, 2.6, 0.18, [0, -0.06, 0], 64);
    const ring = mesh(
      new THREE.TorusGeometry(2.43, 0.018, 4, 80),
      new THREE.MeshBasicMaterial({ color: 0x8df3cb }),
      this.workshop,
      0,
      0.04,
      0,
    );
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const stripe = box(
        this.workshop,
        material(i % 2 ? 0xe4bc72 : 0x253944),
        [0.16, 0.012, 0.31],
        [Math.sin(angle) * 2.26, 0.035, Math.cos(angle) * 2.26],
        false,
      );
      stripe.rotation.y = angle;
    }
    box(this.workshop, graphite, [19, 5.5, 0.3], [0, 2.5, -6]);
    for (let x = -9; x <= 9; x += 0.65)
      box(this.workshop, steel, [0.045, 4.9, 0.03], [x, 2.5, -5.82]);
    const strip = new THREE.MeshBasicMaterial({ color: 0xb6f1df });
    box(this.workshop, strip, [13, 0.045, 0.04], [0, 4.3, -5.8], false);
    const sign = mesh(
      new THREE.PlaneGeometry(4, 0.7),
      new THREE.MeshBasicMaterial({
        map: textTexture("REMACHE / TALLER 01", "#172d38", "#9ceacc"),
      }),
      this.workshop,
      1.1,
      3.5,
      -5.79,
    );
    sign.castShadow = false;
    for (const x of [-4.8, 4.8]) {
      box(this.workshop, graphite, [1.8, 1.25, 1.3], [x, 0.48, -4]);
      box(this.workshop, steel, [1.94, 0.12, 1.44], [x, 1.18, -4]);
      for (let y = 0.1; y < 1; y += 0.26)
        box(this.workshop, steel, [0.55, 0.025, 0.04], [x, y, -3.33]);
      for (let i = 0; i < 4; i++)
        box(
          this.workshop,
          material(0xbe9858),
          [0.12, 0.18, 0.5],
          [x - 0.45 + i * 0.28, 1.32, -4],
        );
    }
  }
  resetPreview() {
    this.previewAngle = 0;
    this.previewTime = 0;
  }
  rotatePreview(delta) {
    this.previewAngle += delta;
  }
  testPreview() {
    this.previewTime = 1;
  }
  burst(x, z, count = 9, power = 1) {
    for (let i = 0; i < count; i++) {
      const particle = this.particles[this.cursor++ % this.particles.length];
      particle.object.visible = true;
      particle.object.position.set(x, 0.95, z);
      particle.life = particle.maxLife = 0.2 + Math.random() * 0.35;
      particle.vx = (Math.random() - 0.5) * 8 * power;
      particle.vz = (Math.random() - 0.5) * 8 * power;
      particle.vy = (2 + Math.random() * 4) * power;
      particle.object.rotation.set(
        Math.random() * 3,
        Math.random() * 3,
        Math.random() * 3,
      );
      particle.object.scale.setScalar(power);
    }
  }
  handle(events) {
    for (const event of events) {
      if (event.type === "impact") this.burst(event.x, event.z, 7, 0.65);
      if (event.type === "damage") {
        this.burst(event.x, event.z, 12, 0.8);
        if (event.target === 0) this.shake = 0.065;
      }
      if (event.type === "destroy") {
        this.burst(event.x, event.z, 42, 1.5);
        this.shake = 0.12;
      }
    }
  }
  clearEffects() {
    this.particles.forEach((p) => {
      p.life = 0;
      p.object.visible = false;
    });
    this.shake = 0;
  }
  resetView(robot) {
    this.chase.reset(robot);
    this.wasHome = null;
  }
  update(sim, dt, rear = false) {
    this.time += dt;
    const home = ["home", "garage"].includes(sim.state);
    const studioChanged =
      this.layoutDirty ||
      this.lastRenderedState !== sim.state ||
      this.renderedLoadout !== sim.loadout ||
      this.renderedPreviewAngle !== this.previewAngle ||
      this.previewTime > 0 ||
      this.renderedPreviewTime > 0;
    this.arena.visible = !home;
    this.workshop.visible = home;
    this.studioLight.visible = home;
    this.scene.background.setHex(home ? 0x152831 : 0xa5b6a6);
    this.scene.fog.color.copy(this.scene.background);
    this.previewTime = Math.max(0, this.previewTime - dt);
    sim.robots.forEach((robot, id) => {
      const visual = this.robots[id];
      visual.group.visible = !home || id === 0;
      const loadout = robot.loadout;
      visual.metal.color.set(PAINTS[loadout.paint].hex);
      visual.rimPaint.color.copy(visual.metal.color);
      visual.body.scale.y =
        loadout.shell === "light"
          ? 0.75
          : loadout.shell === "armored"
            ? 1.1
            : 1;
      visual.body.position.y = loadout.shell === "light" ? 0.2 : 0;
      visual.badge.position.y =
        loadout.shell === "light"
          ? 1.11
          : loadout.shell === "armored"
            ? 1.38
            : 1.26;
      for (const [key, object] of Object.entries(visual.shells))
        object.visible = key === loadout.shell;
      for (const [key, object] of Object.entries(visual.modules))
        object.visible = key === loadout.module;
      for (const wheel of visual.wheels) {
        wheel.scale.x =
          loadout.wheels === "road"
            ? 0.76
            : loadout.wheels === "agile"
              ? 0.84
              : loadout.wheels === "grip"
                ? 1.17
                : 1;
        for (const tread of wheel.userData.treads) {
          tread.visible = ["standard", "grip"].includes(loadout.wheels);
          tread.scale.y = loadout.wheels === "grip" ? 1.5 : 1;
        }
      }
      visual.group.position.set(home ? 0 : robot.x, 0, home ? 0 : robot.z);
      visual.group.rotation.set(
        0,
        home ? -(2.45 + this.previewAngle) : -robot.angle,
        0,
      );
      visual.group.scale.setScalar(home ? 1.25 : 1);
      if (robot.hp <= 0 && !home) {
        visual.group.rotation.z = 0.16;
        visual.group.position.y = -0.19;
      }
      if (robot.flipTime > 0 && !home && robot.hp > 0) {
        const roll = Math.sin(
          Math.PI * (1 - robot.flipTime / robot.flipDuration),
        );
        visual.group.rotation.z = roll * 2.8;
      }
      const preview =
        home && this.previewTime > 0
          ? {
              ...robot,
              attacking: true,
              attackElapsed: (1 - this.previewTime) % robot.weapon.duration,
            }
          : robot;
      animateMeleeWeapon(
        visual,
        preview,
        sim.state === "paused" || (home && this.previewTime === 0) ? 0 : dt,
      );
      visual.wheels.forEach((w) => (w.rotation.x = robot.travel / 0.43));
      visual.marker.visible =
        !home && id === 1 && robot.hp > 0 && robot.flipTime <= 0;
      visual.groundRing.visible = !home && robot.hp > 0 && robot.flipTime <= 0;
      if (robot.flipTime > 0 && !home && robot.hp > 0) {
        // Fit the equipped silhouette, including auxiliaries, above the floor.
        visual.group.updateWorldMatrix(true, true);
        this.flipBounds.makeEmpty();
        visual.group.traverseVisible((object) => {
          if (!object.geometry) return;
          if (!object.geometry.boundingBox)
            object.geometry.computeBoundingBox();
          this.partBounds
            .copy(object.geometry.boundingBox)
            .applyMatrix4(object.matrixWorld);
          this.flipBounds.union(this.partBounds);
        });
        visual.group.position.y = Math.max(0, 0.025 - this.flipBounds.min.y);
      }
      visual.metal.emissive.setHex(robot.hitFlash > 0 ? 0xffffff : 0);
      visual.metal.emissiveIntensity = robot.hitFlash > 0 ? 0.7 : 0;
    });
    if (sim.state !== "paused")
      for (const particle of this.particles) {
        if (particle.life <= 0) continue;
        particle.life -= dt;
        particle.object.visible = particle.life > 0;
        particle.vy -= 12 * dt;
        particle.object.position.x += particle.vx * dt;
        particle.object.position.z += particle.vz * dt;
        particle.object.position.y += particle.vy * dt;
        particle.object.scale.setScalar(
          Math.max(0.01, particle.life / particle.maxLife),
        );
      }
    const desiredFov = home ? CONFIG.camera.home.fov : CONFIG.camera.fov;
    if (this.camera.fov !== desiredFov) {
      this.camera.fov = desiredFov;
      this.camera.updateProjectionMatrix();
    }
    if (home) {
      const narrow = this.camera.aspect < 1.1;
      this.camera.position.set(
        narrow ? 7.5 : 6,
        narrow ? 6.5 : 5.1,
        narrow ? 12.5 : 8.5,
      );
      this.target.set(0, 0.8, 0);
      if (this.layoutDirty || this.lastStudioState !== sim.state) {
        let centerX = window.innerWidth * 0.71,
          centerY = window.innerHeight * 0.53;
        if (sim.state === "garage") {
          const panel = document
            .querySelector(".garage-preview")
            .getBoundingClientRect();
          const controls = document
            .querySelector(".preview-buttons")
            .getBoundingClientRect();
          centerX = panel.left + panel.width * 0.5;
          centerY = (panel.top + 60 + controls.top) * 0.5;
        }
        this.camera.setViewOffset(
          window.innerWidth,
          window.innerHeight,
          window.innerWidth * 0.5 - centerX,
          window.innerHeight * 0.5 - centerY,
          window.innerWidth,
          window.innerHeight,
        );
        this.layoutDirty = false;
        this.lastStudioState = sim.state;
      }
    } else {
      if (this.camera.view?.enabled) this.camera.clearViewOffset();
      this.lastStudioState = null;
      if (this.wasHome !== false) this.chase.reset(sim.robots[0]);
      const pose = this.chase.update(
        sim.robots[0],
        dt,
        rear,
        this.camera.aspect,
      );
      this.shake = Math.max(0, this.shake - dt * 0.7);
      const shake = (Math.random() - 0.5) * this.shake;
      this.camera.position.set(
        pose.position.x + shake,
        pose.position.y,
        pose.position.z,
      );
      this.target.set(pose.target.x + shake, pose.target.y, pose.target.z);
    }
    this.wasHome = home;
    this.look.copy(this.target);
    this.camera.lookAt(this.look);
    if (!home || studioChanged) this.renderer.render(this.scene, this.camera);
    this.lastRenderedState = sim.state;
    this.renderedLoadout = sim.loadout;
    this.renderedPreviewAngle = this.previewAngle;
    this.renderedPreviewTime = this.previewTime;
  }
}
