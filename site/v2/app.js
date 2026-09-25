import * as THREE from "three";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#scene");
const loading = $("#loading");
const progress = $("#loading-progress");
const roomLabel = $("#room-label");
const roomIndex = $("#room-index");
const roomNav = $("#room-nav");
const card = $("#room-card");
const cardContent = $("#card-content");
const doorPrompt = $("#door-prompt");
const promptTitle = $("#prompt-title");
const promptDetail = $("#prompt-detail");
const walkHud = $("#walk-hud");
const walkState = $("#walk-state");
let rooms = [];
let scene, camera, renderer, clock;
let corridorGroup, doors = [], entryGate;
let entered = false;
let entryOpened = false;
let targetZ = 8;
let currentZ = 8;
let targetX = 0;
let currentX = 0;
let targetYaw = 0;
let currentYaw = 0;
let targetPitch = 0;
let currentPitch = 0;
let pointerDown = false;
let pointerX = 0;
let pointerY = 0;
let nearDoorIndex = -1;
let nearEntry = false;
let openingDoor = null;
let insideRoomIndex = -1;
const ENTRY_Z = 4.45;

const state = { progress: 0, active: -1 };

function createRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

function material(color, roughness = .8, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: .05, emissive, emissiveIntensity: emissive ? .35 : 0 });
}

function makeTextTexture(text, options = {}) {
  const width = options.width || 800;
  const height = options.height || 240;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = options.background || "#e7e3d6";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = options.color || "#252823";
  ctx.font = `${options.weight || 700} ${options.size || 68}px Arial`;
  ctx.textAlign = options.align || "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addWallTexture(group, x, y, z, width, height, text, accent) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: makeTextTexture(text, { width: 900, height: 250, background: "#d8d3c4", color: "#34382f", size: 71 }), transparent: true }));
  plane.position.set(x, y, z);
  plane.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
  group.add(plane);
  const line = new THREE.Mesh(new THREE.BoxGeometry(width * .65, .015, .015), material(accent));
  line.position.set(x + (x < 0 ? .01 : -.01), y - height * .68, z);
  line.rotation.y = plane.rotation.y;
  group.add(line);
}

function buildScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c0d);
  scene.fog = new THREE.Fog(0x0b0c0d, 8, 43);
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, .1, 100);
  camera.position.set(0, 2.05, currentZ);
  camera.rotation.x = -.04;
  clock = new THREE.Clock();

  scene.add(new THREE.HemisphereLight(0xeae6d8, 0x161919, 1.5));
  const key = new THREE.DirectionalLight(0xdbe9bd, 1.5);
  key.position.set(-4, 8, 9);
  scene.add(key);
  const blue = new THREE.PointLight(0x718bff, 8, 18, 2);
  blue.position.set(-2, 3.5, -15);
  scene.add(blue);
  const amber = new THREE.PointLight(0xffa765, 7, 16, 2);
  amber.position.set(2, 3.5, -5);
  scene.add(amber);

  corridorGroup = new THREE.Group();
  scene.add(corridorGroup);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 70), material(0x242824, .92));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -19);
  corridorGroup.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(12, 70), material(0x101313, .95));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 6.6, -19);
  corridorGroup.add(ceiling);
  // Leave a real opening around every side door. The room behind the door is
  // actual geometry, so moving through a doorway reveals another space.
  for (const side of [-1, 1]) addSideWallSegments(side);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.6), material(0x171c1d));
  back.position.set(0, 3.3, -54);
  corridorGroup.add(back);
  for (let z = 6; z > -53; z -= 4) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.018, .015, 2.1), material(0x758269));
    strip.position.set(0, .018, z);
    corridorGroup.add(strip);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 1.15), new THREE.MeshBasicMaterial({ map: makeTextTexture("EDWARD / THE OPEN ROOM", { width: 1100, height: 300, background: "#dad6c9", color: "#20241e", size: 65 }), transparent: true }));
  sign.position.set(0, 5.15, -3.7);
  sign.rotation.x = -.06;
  corridorGroup.add(sign);
  createEntranceGate();
  for (let z = 2; z > -53; z -= 9) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(1.5, .035, .18), new THREE.MeshBasicMaterial({ color: 0xd2dfba }));
    light.position.set(0, 6.3, z);
    corridorGroup.add(light);
  }
  rooms.forEach((room, index) => createDoor(room, index));
}

function addSideWallSegments(side) {
  const doorZs = rooms.map((_, index) => -index * 8 - 1).sort((a, b) => b - a);
  let cursor = 6;
  for (const z of doorZs) {
    addSideWallSegment(side, z + 1.65, cursor);
    cursor = z - 1.65;
  }
  addSideWallSegment(side, -54, cursor);
}

function addSideWallSegment(side, start, end) {
  const length = Math.abs(start - end);
  if (length < .08) return;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(.28, 6.6, length), material(0x222725, .98));
  wall.position.set(side * 5.7, 3.3, (start + end) / 2);
  corridorGroup.add(wall);
}

function createEntranceGate() {
  const group = new THREE.Group();
  group.position.z = ENTRY_Z;
  group.userData = { isEntryGate: true, z: ENTRY_Z, opened: false, opening: false, progress: 0 };
  const stone = material(0x9ba196, .72);
  const dark = material(0x27312b, .78, 0x536d4e);
  const columnL = new THREE.Mesh(new THREE.BoxGeometry(.5, 5.3, .55), stone);
  const columnR = columnL.clone();
  columnL.position.set(-2.85, 2.65, 0);
  columnR.position.set(2.85, 2.65, 0);
  const top = new THREE.Mesh(new THREE.BoxGeometry(6.2, .58, .58), stone);
  top.position.set(0, 5.15, 0);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.45, .16, .12), material(0xd9fa72, .45));
  lintel.position.set(0, 4.76, -.33);
  group.add(columnL, columnR, top, lintel);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(3.7, .48), new THREE.MeshBasicMaterial({ map: makeTextTexture("ENTER / EDWARD", { width: 1000, height: 170, background: "#d9fa72", color: "#162015", size: 60 }), transparent: true }));
  label.position.set(0, 5.14, -.34);
  group.add(label);
  const leafWidth = 2.6;
  const leaves = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.x = side * 2.3;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(leafWidth, 4.25, .22), dark);
    leaf.position.x = -side * (leafWidth / 2);
    const inset = new THREE.Mesh(new THREE.BoxGeometry(leafWidth * .7, 3.25, .04), material(side < 0 ? 0x3d5945 : 0x3d4b5e, .94));
    inset.position.set(-side * (leafWidth / 2), 0, -.14);
    pivot.add(leaf, inset);
    pivot.userData = { side, isGateLeaf: true };
    group.add(pivot);
    leaves.push(pivot);
  });
  group.userData.leaves = leaves;
  const glow = new THREE.PointLight(0xd9fa72, 0, 9, 2);
  glow.position.set(0, 2.5, -.8);
  group.add(glow);
  group.userData.glow = glow;
  corridorGroup.add(group);
  entryGate = group;
}

function createDoor(room, index) {
  const z = -index * 8 - 1;
  const side = index % 2 === 0 ? -1 : 1;
  const x = side * 5.47;
  const group = new THREE.Group();
  group.position.set(x, 2.25, z);
  group.userData = { room, index, z, side, opened: false, opening: false, progress: 0 };
  const frame = new THREE.Mesh(new THREE.BoxGeometry(.25, 4.5, 2.6), material(0xb4b1a6, .65));
  const opening = new THREE.Mesh(new THREE.BoxGeometry(.08, 4.3, 2.35), material(0x0c1110, .98));
  opening.position.x = -side * .08;
  const leaf = new THREE.Group();
  const hingeZ = side * 1.02;
  leaf.position.z = hingeZ;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(.18, 4.1, 2.25), material(index % 2 ? 0x27313f : 0x2d342c, .75, new THREE.Color(room.accent).getHex()));
  slab.material.emissiveIntensity = .16;
  slab.position.set(-side * 1.02, 0, -hingeZ);
  const inset = new THREE.Mesh(new THREE.BoxGeometry(.035, 3.35, 1.85), material(new THREE.Color(room.accent).multiplyScalar(.45).getHex(), .95));
  inset.position.set(-side * 1.125, 0, -hingeZ);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.78, .45), new THREE.MeshBasicMaterial({ map: makeTextTexture(`${room.number}  ${room.short}`, { width: 900, height: 220, background: room.accent, color: "#161a15", size: 54 }), transparent: true }));
  label.position.set(-side * 1.14, .55, -hingeZ);
  label.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  const handle = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 12), material(0xe5dfc4, .25));
  handle.position.set(-side * 1.14, -.15, side < 0 ? -.12 : .12);
  leaf.add(slab, inset, label, handle);
  group.add(frame, opening, leaf);
  const roomLight = new THREE.PointLight(new THREE.Color(room.accent).getHex(), 0, 7, 2);
  roomLight.position.set(side * .55, .4, 0);
  group.add(roomLight);
  group.userData.leaf = leaf;
  group.userData.light = roomLight;
  corridorGroup.add(group);
  doors.push(group);
  createRoomSpace(room, index, z, side);
  addWallTexture(corridorGroup, side < 0 ? -5.63 : 5.63, 3.3, z - 2.25, 2.2, 1.05, room.label, room.accent);
}

function createRoomSpace(room, index, z, side) {
  const x = side * 8.55;
  const accent = new THREE.Color(room.accent).getHex();
  const roomGroup = new THREE.Group();
  roomGroup.userData = { room, index, side };
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.7, .14, 5.65), material(0x30342f, .94));
  floor.position.set(x, .06, z);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(5.7, .12, 5.65), material(0x141918, .96));
  ceiling.position.set(x, 6.35, z);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(.2, 6.2, 5.65), material(0x18201d, .93));
  rear.position.set(side * 11.38, 3.1, z);
  const partitionA = new THREE.Mesh(new THREE.BoxGeometry(5.7, 6.2, .18), material(0x202624, .95));
  const partitionB = partitionA.clone();
  partitionA.position.set(x, 3.1, z - 2.82);
  partitionB.position.set(x, 3.1, z + 2.82);
  roomGroup.add(floor, ceiling, rear, partitionA, partitionB);

  // A glowing threshold and a local lamp make the room visibly different
  // before the visitor steps through its door.
  const glow = new THREE.Mesh(new THREE.BoxGeometry(.06, 4.05, 2.72), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .2 }));
  glow.position.set(side * 5.77, 2.22, z);
  roomGroup.add(glow);
  const lamp = new THREE.PointLight(accent, 2.8, 9, 2);
  lamp.position.set(side * 8.2, 4.85, z);
  roomGroup.add(lamp);

  // Small installation + title board gives every room a discoverable identity.
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(.7, .84, .24, 24), material(0x555a50, .7));
  plinth.position.set(side * 9.35, .16, z);
  const object = new THREE.Group();
  object.position.set(side * 9.35, 1.65, z);
  if (room.id === "ai") {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.56, 1), material(accent, .35, accent));
    core.material.emissiveIntensity = .25;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.86, .035, 8, 48), new THREE.MeshBasicMaterial({ color: accent }));
    ring.rotation.x = .85;
    const ring2 = ring.clone();
    ring2.rotation.set(-.6, .4, .2);
    object.add(core, ring, ring2);
  } else if (room.id === "projects") {
    [-.65, 0, .65].forEach((offset, blockIndex) => {
      const block = new THREE.Mesh(new THREE.BoxGeometry(.42, .7 + blockIndex * .2, .42), material(accent, .55, accent));
      block.material.emissiveIntensity = .17;
      block.position.set(offset, .38 + blockIndex * .1, 0);
      object.add(block);
    });
  } else if (room.id === "visuals" && room.media?.[0]?.[0]) {
    const texture = new THREE.TextureLoader().load(room.media[0][0]);
    texture.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(.1, 2.5, 1.85), material(0xd6d0bf, .65));
    frame.position.x = -.03;
    const picture = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.38), new THREE.MeshBasicMaterial({ map: texture }));
    picture.position.x = .04;
    picture.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    frame.rotation.y = picture.rotation.y;
    object.add(frame, picture);
  } else if (room.id === "growth") {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.045, .08, 1.7, 8), material(accent, .55, accent));
    stem.position.y = .35;
    object.add(stem);
    [-.5, .05, .6].forEach((height, ringIndex) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.42 + ringIndex * .09, .035, 8, 32), new THREE.MeshBasicMaterial({ color: accent }));
      ring.position.y = height + .45;
      object.add(ring);
    });
  } else if (room.id === "contact") {
    const portal = new THREE.Mesh(new THREE.TorusKnotGeometry(.62, .1, 72, 8, 2, 3), material(accent, .4, accent));
    portal.material.emissiveIntensity = .22;
    object.add(portal);
  } else {
    const sculpture = new THREE.Mesh(new THREE.IcosahedronGeometry(.66, 1), material(accent, .45, accent));
    sculpture.material.emissiveIntensity = .2;
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(.94, .035, 8, 48), new THREE.MeshBasicMaterial({ color: accent }));
    orbit.rotation.y = Math.PI / 2;
    orbit.rotation.x = .55;
    object.add(sculpture, orbit);
  }
  object.rotation.y = index * .36;
  roomGroup.add(plinth, object);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.55), new THREE.MeshBasicMaterial({ map: makeTextTexture(room.label, { width: 1000, height: 580, background: "#d8d3c4", color: "#20251f", size: 92 }), transparent: true }));
  board.position.set(side * 10.95, 3.25, z);
  board.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  roomGroup.add(board);
  const accentLine = new THREE.Mesh(new THREE.BoxGeometry(.025, .025, 2.55), material(accent));
  accentLine.position.set(side * 10.81, 2.35, z);
  roomGroup.add(accentLine);
  corridorGroup.add(roomGroup);
}

function setupNav() {
  rooms.forEach((room, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${room.number} ${room.label}`;
    button.dataset.index = index;
    button.addEventListener("click", () => goToRoom(index, true));
    roomNav.append(button);
  });
}

function syncRoom() {
  if (insideRoomIndex >= 0 && rooms[insideRoomIndex]) {
    const room = rooms[insideRoomIndex];
    roomLabel.textContent = room.label;
    roomIndex.textContent = room.number;
    roomNav.querySelectorAll("button").forEach((button, index) => button.classList.toggle("is-active", index === insideRoomIndex));
    return;
  }
  if (!card.hidden && rooms[state.active]) {
    const openRoomData = rooms[state.active];
    roomLabel.textContent = openRoomData.label;
    roomIndex.textContent = openRoomData.number;
    roomNav.querySelectorAll("button").forEach((button, index) => button.classList.toggle("is-active", index === state.active));
    return;
  }
  let best = -1;
  let distance = Infinity;
  rooms.forEach((room, index) => {
    const z = -index * 8 - 1;
    const delta = Math.abs(currentZ - z);
    if (delta < distance) { best = index; distance = delta; }
  });
  if (best >= 0 && distance < 4.7) {
    state.active = best;
    const room = rooms[best];
    roomLabel.textContent = room.label;
    roomIndex.textContent = room.number;
    roomNav.querySelectorAll("button").forEach((button, index) => button.classList.toggle("is-active", index === best));
  } else {
    state.active = -1;
    roomLabel.textContent = entered ? "走廊" : "入口";
    roomIndex.textContent = "00";
    roomNav.querySelectorAll("button").forEach(button => button.classList.remove("is-active"));
  }
}

function showPrompt(title, detail = "走近一点，开始探索", actionText = "打开") {
  if (!doorPrompt) return;
  promptTitle.textContent = title;
  promptDetail.textContent = detail;
  const action = $("#door-action");
  if (action) action.firstChild.textContent = `${actionText} `;
  doorPrompt.hidden = false;
}

function hidePrompt() {
  if (doorPrompt) doorPrompt.hidden = true;
}

function updateProximity() {
  if (!entered || openingDoor || !card.hidden) {
    nearEntry = false;
    nearDoorIndex = -1;
    hidePrompt();
    return;
  }
  if (insideRoomIndex >= 0) {
    nearEntry = false;
    nearDoorIndex = -1;
    const room = rooms[insideRoomIndex];
    showPrompt(`${room.label} · 已进入`, room.doorHint || "在房间里自由观察，查看这里的内容。", "查看");
    return;
  }
  nearEntry = !entryOpened && Math.abs(currentZ - ENTRY_Z) < 2.65 && Math.abs(currentX) < 2.35;
  if (nearEntry) {
    nearDoorIndex = -1;
    showPrompt("打开入口大门", "按 E 或点击大门，走进 Edward 的空间");
    return;
  }
  let best = -1;
  let bestDistance = Infinity;
  doors.forEach((door, index) => {
    const { x, z } = door.position;
    const distance = Math.hypot(currentX - x, currentZ - z);
    if (distance < bestDistance && distance < 2.85) {
      best = index;
      bestDistance = distance;
    }
  });
  nearDoorIndex = best;
  if (best >= 0) {
    const room = rooms[best];
    showPrompt(`打开 ${room.label}`, room.doorHint || "按 E 或点击门，进入这个房间", "打开");
  } else {
    hidePrompt();
  }
}

function openEntrance(force = false) {
  if (!entryGate || entryOpened || (!force && !nearEntry)) return;
  entryOpened = true;
  entryGate.userData.opening = true;
  targetZ = 1.2;
  const hint = $("#door-hint");
  hint?.classList.remove("is-hidden");
  if (hint) {
    hint.querySelector(".hint-key").textContent = "W A S D / ↑ ↓ ← →";
    hint.querySelector("span:last-child").textContent = "自由探索每一个房间";
  }
  if (walkState) walkState.textContent = "走廊 · 找到一扇想打开的门";
  hidePrompt();
}

function openDoor(index, force = false) {
  const door = doors[index];
  if (!door || !entryOpened || openingDoor || (!force && nearDoorIndex !== index)) return;
  // Once the latch is reached, carry the visitor through the opening. The
  // room remains fully explorable after the information card is closed.
  targetX = door.userData.side * 6.8;
  targetZ = door.userData.z;
  targetYaw = -door.userData.side * (Math.PI / 2);
  if (door.userData.opened) {
    enterRoom(index);
    if (force) window.setTimeout(() => openRoom(index), 500);
    return;
  }
  openingDoor = door;
  door.userData.opening = true;
  hidePrompt();
  window.setTimeout(() => {
    door.userData.opened = true;
    openingDoor = null;
    enterRoom(index);
    if (force) window.setTimeout(() => openRoom(index), 500);
  }, 900);
}

function enterRoom(index) {
  const door = doors[index];
  const room = rooms[index];
  if (!door || !room) return;
  insideRoomIndex = index;
  state.active = index;
  targetX = door.userData.side * 6.8;
  targetZ = door.userData.z;
  targetYaw = -door.userData.side * (Math.PI / 2);
  targetPitch = 0;
  const exit = $("#exit-room");
  if (exit) exit.hidden = false;
  if (walkState) walkState.textContent = `${room.label} · 已进入房间，自由观察`;
  hidePrompt();
}

function goToRoom(index, showCard = false) {
  entered = true;
  enterSpace();
  if (!entryOpened) {
    openEntrance(true);
  }
  const door = doors[index];
  if (!door) return;
  targetX = door.userData.side * 6.8;
  targetZ = door.userData.z;
  if (showCard) window.setTimeout(() => openDoor(index, true), 420);
}

function openRoom(index) {
  const room = rooms[index];
  if (!room) return;
  state.active = index;
  roomLabel.textContent = room.label;
  roomIndex.textContent = room.number;
  roomNav.querySelectorAll("button").forEach((button, buttonIndex) => button.classList.toggle("is-active", buttonIndex === index));
  $("#card-number").textContent = room.number;
  cardContent.replaceChildren();
  cardContent.append(Object.assign(document.createElement("p"), { className: "card-kicker", textContent: room.kicker }));
  cardContent.append(Object.assign(document.createElement("h2"), { textContent: room.title }));
  cardContent.append(Object.assign(document.createElement("p"), { className: "card-body", textContent: room.body }));
  if (room.media) {
    const media = document.createElement("div");
    media.className = "card-media";
    room.media.forEach(([src, caption]) => {
      const figure = document.createElement("figure");
      const image = document.createElement("img");
      image.src = src;
      image.alt = caption;
      image.loading = "lazy";
      figure.append(image, Object.assign(document.createElement("figcaption"), { textContent: caption }));
      media.append(figure);
    });
    cardContent.append(media);
  }
  if (room.video) {
    const video = document.createElement("video");
    video.className = "card-video";
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    const source = document.createElement("source");
    source.src = room.video;
    source.type = "video/webm";
    video.append(source);
    cardContent.append(video);
  }
  if (room.list) {
    const list = document.createElement("ul");
    list.className = "card-list";
    room.list.forEach(([key, value, extra]) => {
      const item = document.createElement("li");
      item.append(Object.assign(document.createElement("span"), { textContent: key }), Object.assign(document.createElement("span"), { textContent: extra ? `${value} · ${extra}` : value }));
      list.append(item);
    });
    cardContent.append(list);
  }
  if (room.entries) {
    const entries = document.createElement("div");
    entries.className = "card-entries";
    room.entries.forEach(({ date, title, summary, status, url }) => {
      const entry = document.createElement("article");
      entry.className = "card-entry";
      const meta = document.createElement("div");
      meta.className = "entry-meta";
      meta.append(Object.assign(document.createElement("time"), { textContent: date }), Object.assign(document.createElement("span"), { textContent: status }));
      entry.append(meta, Object.assign(document.createElement("h3"), { textContent: title }), Object.assign(document.createElement("p"), { textContent: summary }));
      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = "查看项目 ↗";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        entry.append(link);
      }
      entries.append(entry);
    });
    cardContent.append(entries);
  }
  if (room.timeline) {
    const timeline = document.createElement("div");
    timeline.className = "timeline";
    room.timeline.forEach(([time, title, text]) => {
      const item = document.createElement("article");
      item.className = "timeline-item";
      item.append(Object.assign(document.createElement("time"), { textContent: time }), Object.assign(document.createElement("h3"), { textContent: title }), Object.assign(document.createElement("p"), { textContent: text }));
      timeline.append(item);
    });
    cardContent.append(timeline);
  }
  if (room.tags) {
    const tags = document.createElement("div");
    tags.className = "card-tags";
    room.tags.forEach(tag => tags.append(Object.assign(document.createElement("span"), { textContent: tag })));
    cardContent.append(tags);
  }
  if (room.id === "contact") {
    const link = document.createElement("a");
    link.className = "card-link";
    link.href = "mailto:";
    link.textContent = "添加邮箱后联系我 ↗";
    cardContent.append(link);
  }
  card.hidden = false;
  const exit = $("#exit-room");
  if (exit) exit.hidden = false;
}

function closeRoom() {
  card.hidden = true;
  const exit = $("#exit-room");
  if (exit) exit.hidden = insideRoomIndex < 0;
}

function leaveRoom() {
  const index = insideRoomIndex >= 0 ? insideRoomIndex : state.active;
  closeRoom();
  const door = doors[index];
  if (door) {
    insideRoomIndex = -1;
    targetX = 0;
    targetZ = door.userData.z + 2.7;
    targetYaw = 0;
    targetPitch = 0;
    if (walkState) walkState.textContent = "走廊 · 继续寻找下一扇门";
  }
}

function onPointerDown(event) { pointerDown = true; pointerX = event.clientX; pointerY = event.clientY; }
function onPointerMove(event) {
  if (!pointerDown || card.hidden === false) return;
  const dx = event.clientX - pointerX;
  const dy = event.clientY - pointerY;
  pointerX = event.clientX;
  pointerY = event.clientY;
  if (event.pointerType === "touch") {
    targetYaw -= dx * .004;
    targetPitch = THREE.MathUtils.clamp(targetPitch - dy * .003, -.45, .45);
    if (Math.abs(dy) > 1) moveRelative(0, -Math.sign(dy) * Math.min(Math.abs(dy) * .015, 1.1));
  } else {
    targetYaw -= dx * .004;
    targetPitch = THREE.MathUtils.clamp(targetPitch - dy * .003, -.45, .45);
  }
}
function onPointerUp() { pointerDown = false; }
function onWheel(event) {
  if (!entered || card.hidden === false) return;
  moveRelative(0, THREE.MathUtils.clamp(event.deltaY * .0035, -1.4, 1.4));
}
function onKey(event) {
  if (event.key === "Escape") closeRoom();
  if (!entered && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); enterSpace(); }
  if (event.key.toLowerCase() === "e") {
    if (insideRoomIndex >= 0) openRoom(insideRoomIndex);
    else if (nearEntry) openEntrance();
    else if (nearDoorIndex >= 0) openDoor(nearDoorIndex);
    return;
  }
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") moveRelative(0, 1.5);
  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") moveRelative(0, -1.5);
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") moveRelative(-1, 0);
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") moveRelative(1, 0);
}

function moveRelative(strafe, forward) {
  const sin = Math.sin(targetYaw);
  const cos = Math.cos(targetYaw);
  targetX += -sin * forward * 1.5 + cos * strafe * 1.25;
  targetZ += -cos * forward * 1.5 - sin * strafe * 1.25;
  if (insideRoomIndex >= 0) {
    const door = doors[insideRoomIndex];
    const side = door.userData.side;
    targetX = side < 0 ? THREE.MathUtils.clamp(targetX, -10.8, -6.3) : THREE.MathUtils.clamp(targetX, 6.3, 10.8);
    targetZ = THREE.MathUtils.clamp(targetZ, door.userData.z - 2.35, door.userData.z + 2.35);
  } else {
    targetX = THREE.MathUtils.clamp(targetX, -4.15, 4.15);
    targetZ = THREE.MathUtils.clamp(targetZ, -48, 8);
  }
}

function enterSpace() {
  entered = true;
  targetZ = 5;
  $("#intro-copy").classList.add("is-hidden");
  const hint = $("#door-hint");
  hint.classList.remove("is-hidden");
  hint.querySelector(".hint-key").textContent = "W A S D / ↑ ↓ ← →";
  hint.querySelector("span:last-child").textContent = "走近入口大门";
  roomNav.classList.add("is-visible");
  walkHud?.classList.add("is-visible");
}

function onCanvasClick(event) {
  if (!entered || !card.hidden) return;
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects([...(entryGate ? [entryGate] : []), ...doors], true);
  const findOwner = (object, key) => {
    let current = object;
    while (current) {
      if (current.userData?.[key]) return current;
      current = current.parent;
    }
    return null;
  };
  const gate = intersections.map(item => findOwner(item.object, "isEntryGate")).find(Boolean);
  if (gate) {
    if (nearEntry) openEntrance();
    else targetZ = ENTRY_Z;
    return;
  }
  const door = intersections.map(item => findOwner(item.object, "room")).find(Boolean);
  if (door) {
    const { index } = door.userData;
    if (insideRoomIndex >= 0) openRoom(insideRoomIndex);
    else if (nearDoorIndex === index) openDoor(index);
    else {
      targetX = door.userData.side * 3.35;
      targetZ = door.userData.z + 1.8;
    }
  }
}

function render() {
  currentZ += (targetZ - currentZ) * .14;
  currentX += (targetX - currentX) * .15;
  camera.position.z = currentZ;
  camera.position.x = currentX;
  camera.position.y = 2.05 + Math.sin(clock.elapsedTime * .45) * .018;
  currentYaw += (targetYaw - currentYaw) * .24;
  currentPitch += (targetPitch - currentPitch) * .1;
  camera.rotation.y = currentYaw + Math.sin(clock.elapsedTime * .18) * .0015;
  camera.rotation.x = -.04 + currentPitch;
  if (entryGate?.userData.opening) {
    const data = entryGate.userData;
    data.progress = Math.min(1, data.progress + .055);
    data.leaves.forEach((leaf) => { leaf.rotation.y = leaf.userData.side * 1.18 * data.progress; });
    data.glow.intensity = 4 * data.progress;
    if (data.progress >= 1) data.opening = false;
  }
  doors.forEach((door) => {
    const data = door.userData;
    if (data.opening || data.opened) {
      data.progress = Math.min(1, data.progress + (data.opening ? .065 : 0));
      data.leaf.rotation.y = data.side * 1.23 * data.progress;
      data.light.intensity = 4.6 * data.progress;
      if (data.progress >= 1) data.opening = false;
    }
  });
  syncRoom();
  updateProximity();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function resize() {
  if (!renderer || !camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = window.innerWidth < 760 ? 68 : 62;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.25 : 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

async function init() {
  try {
    const response = await fetch("content.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("无法读取房间内容");
    const content = await response.json();
    rooms = content.rooms;
    setupNav();
    buildScene();
    createRenderer();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("click", onCanvasClick);
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    $("#enter-button").addEventListener("click", enterSpace);
    $("#card-close").addEventListener("click", closeRoom);
    $("#door-action")?.addEventListener("click", () => {
      if (insideRoomIndex >= 0) openRoom(insideRoomIndex);
      else if (nearEntry) openEntrance();
      else if (nearDoorIndex >= 0) openDoor(nearDoorIndex);
    });
    $("#exit-room")?.addEventListener("click", leaveRoom);
    resize();
    let value = 0;
    const timer = setInterval(() => {
      value = Math.min(100, value + 7);
      progress.textContent = `${value}%`;
      if (value >= 100) { clearInterval(timer); setTimeout(() => loading.classList.add("is-done"), 300); }
    }, 42);
    render();
  } catch (error) {
    loading.innerHTML = `<p>空间暂时无法打开。<br><a href="../">回到简洁版网站</a></p>`;
    console.error(error);
  }
}

init();
