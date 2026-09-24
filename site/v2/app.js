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
let rooms = [];
let scene, camera, renderer, clock;
let corridorGroup, doors = [];
let entered = false;
let targetZ = 8;
let currentZ = 8;
let pointerDown = false;
let pointerX = 0;

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
  for (const x of [-5.7, 5.7]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 6.6), material(0x222725, .98));
    wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(x, 3.3, -19);
    corridorGroup.add(wall);
  }
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
  for (let z = 2; z > -53; z -= 9) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(1.5, .035, .18), new THREE.MeshBasicMaterial({ color: 0xd2dfba }));
    light.position.set(0, 6.3, z);
    corridorGroup.add(light);
  }
  rooms.forEach((room, index) => createDoor(room, index));
}

function createDoor(room, index) {
  const z = -index * 8 - 1;
  const side = index % 2 === 0 ? -1 : 1;
  const x = side * 4.8;
  const group = new THREE.Group();
  group.position.set(x, 2.25, z);
  group.userData = { room, index, z, side };
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.5, .2), material(0xb4b1a6, .65));
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.25, 4.1, .18), material(index % 2 ? 0x27313f : 0x2d342c, .75, new THREE.Color(room.accent).getHex()));
  slab.material.emissiveIntensity = .16;
  slab.position.z = .13;
  const inset = new THREE.Mesh(new THREE.BoxGeometry(1.85, 3.35, .03), material(new THREE.Color(room.accent).multiplyScalar(.45).getHex(), .95));
  inset.position.z = .24;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.78, .45), new THREE.MeshBasicMaterial({ map: makeTextTexture(`${room.number}  ${room.short}`, { width: 900, height: 220, background: room.accent, color: "#161a15", size: 54 }), transparent: true }));
  label.position.set(0, .55, .265);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 12), material(0xe5dfc4, .25));
  handle.position.set(side < 0 ? .75 : -.75, -.15, .29);
  group.add(frame, slab, inset, label, handle);
  group.rotation.y = side < 0 ? .14 : -.14;
  corridorGroup.add(group);
  doors.push(group);
  addWallTexture(corridorGroup, side < 0 ? -5.63 : 5.63, 3.3, z - 2.25, 2.2, 1.05, room.label, room.accent);
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

function goToRoom(index, showCard = false) {
  entered = true;
  enterSpace();
  targetZ = -index * 8 - 1;
  if (showCard) openRoom(index);
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
}

function closeRoom() { card.hidden = true; }

function onPointerDown(event) { pointerDown = true; pointerX = event.clientX; }
function onPointerMove(event) {
  if (!pointerDown || card.hidden === false) return;
  const dx = event.clientX - pointerX;
  pointerX = event.clientX;
  targetZ -= dx * .035;
  targetZ = THREE.MathUtils.clamp(targetZ, -48, 8);
}
function onPointerUp() { pointerDown = false; }
function onWheel(event) {
  if (!entered || card.hidden === false) return;
  targetZ -= event.deltaY * .018;
  targetZ = THREE.MathUtils.clamp(targetZ, -48, 8);
}
function onKey(event) {
  if (event.key === "Escape") closeRoom();
  if (!entered && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); enterSpace(); }
  if (event.key === "ArrowDown" || event.key === "ArrowRight") { targetZ -= 1.7; targetZ = THREE.MathUtils.clamp(targetZ, -48, 8); }
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") { targetZ += 1.7; targetZ = THREE.MathUtils.clamp(targetZ, -48, 8); }
}

function enterSpace() {
  entered = true;
  targetZ = 5;
  $("#intro-copy").classList.add("is-hidden");
  $("#door-hint").classList.add("is-hidden");
  roomNav.classList.add("is-visible");
}

function onCanvasClick(event) {
  if (!entered || !card.hidden) return;
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(doors, true);
  const door = intersections.map(item => item.object.parent).find(parent => parent?.userData?.room);
  if (door) { const { index } = door.userData; goToRoom(index, true); }
}

function render() {
  currentZ += (targetZ - currentZ) * .075;
  camera.position.z = currentZ;
  camera.position.x += (0 - camera.position.x) * .06;
  camera.position.y = 2.05 + Math.sin(clock.elapsedTime * .45) * .018;
  camera.rotation.y = Math.sin(clock.elapsedTime * .18) * .008;
  syncRoom();
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
