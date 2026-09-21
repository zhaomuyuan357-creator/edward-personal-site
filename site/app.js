"use strict";
const $ = (selector) => document.querySelector(selector);
const make = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
let siteContent;
let lastProjectTrigger;

function safeLink(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch { return ""; }
}

function setLines(element, value) {
  element.replaceChildren();
  String(value).split("\n").forEach((line, index) => {
    if (index) element.append(document.createElement("br"));
    element.append(document.createTextNode(line));
  });
}

function fitTitle() {
  const title = $("#hero-title");
  title.style.fontSize = "";
  const available = title.parentElement.clientWidth - parseFloat(getComputedStyle(title.parentElement).paddingLeft) - parseFloat(getComputedStyle(title.parentElement).paddingRight);
  const range = document.createRange();
  range.selectNodeContents(title);
  const textWidth = range.getBoundingClientRect().width;
  if (textWidth > 0) title.style.fontSize = `${Math.min(available * .38, parseFloat(getComputedStyle(title).fontSize) * available * .985 / textWidth)}px`;
}

function openProject(project, trigger) {
  lastProjectTrigger = trigger;
  $("#dialog-title").textContent = project.title;
  $("#dialog-category").textContent = [project.category, project.year].filter(Boolean).join(" / ") + (project.demo ? " · 示例项目" : "");
  $("#dialog-kicker").textContent = project.englishTitle;
  $("#dialog-description").textContent = project.description;
  $("#dialog-image").src = project.image;
  $("#dialog-image").alt = project.alt || project.title;
  $("#dialog-image").hidden = Boolean(project.video);
  const video = $("#dialog-video");
  $("#dialog-video-wrap").hidden = !project.video;
  $("#video-start").hidden = !project.video;
  if (project.video) {
    video.replaceChildren();
    if (project.videoWebm) {
      const webm = make("source");
      webm.src = project.videoWebm;
      webm.type = "video/webm";
      video.append(webm);
    }
    const source = make("source");
    source.src = project.video;
    source.type = project.video.endsWith(".webm") ? "video/webm" : "video/mp4";
    video.append(source);
    video.poster = project.image;
    video.setAttribute("aria-label", project.title);
    video.load();
  }
  const link = safeLink(project.link);
  $("#dialog-link").hidden = !link;
  if (link) $("#dialog-link").href = link;
  $("#project-dialog").showModal();
  document.body.classList.add("modal-open");
  $("#dialog-close").focus();
}

function renderProjects(filter = "全部") {
  const grid = $("#project-grid");
  grid.replaceChildren();
  siteContent.projects.forEach((project, index) => {
    if (filter !== "全部" && project.category !== filter) return;
    const card = make("article", "project-card");
    const button = make("button", "project-trigger");
    button.type = "button";
    button.setAttribute("aria-label", `查看${project.title}的项目详情`);
    button.setAttribute("aria-haspopup", "dialog");
    const visual = make("div", "project-visual");
    const image = make("img");
    image.src = project.image;
    image.alt = project.alt || project.title;
    image.style.objectPosition = project.position || "50% 50%";
    image.width = 1200;
    image.height = 960;
    image.loading = index < 2 ? "eager" : "lazy";
    image.decoding = "async";
    const arrow = make("span", "project-open", "↗");
    arrow.setAttribute("aria-hidden", "true");
    visual.append(image, arrow);
    if (project.video) {
      const play = make("span", "project-play", "▶");
      play.setAttribute("aria-hidden", "true");
      visual.append(play, make("span", "project-video-label", "播放短片"));
    }
    if (project.demo) visual.append(make("span", "project-demo", "示例作品"));
    const info = make("div", "project-info");
    const name = make("div");
    const title = make("h3", "project-title");
    title.append(make("span", "project-number", String(index + 1).padStart(2, "0")), document.createTextNode(project.title));
    name.append(title, make("span", "project-english", project.englishTitle));
    const meta = make("span", "project-meta");
    meta.append(document.createTextNode(project.category));
    if (project.year) meta.append(make("i"), document.createTextNode(project.year));
    info.append(name, meta);
    button.append(visual, info);
    button.addEventListener("click", () => openProject(project, button));
    card.append(button);
    grid.append(card);
  });
}

function populate(content) {
  siteContent = content;
  document.title = `${content.name} — 个人作品集`;
  document.querySelector('meta[name="description"]').content = `${content.name} · ${content.role}。${content.intro.replace(/\n/g, "")}`;
  document.querySelector('meta[property="og:title"]').content = document.title;
  document.querySelector('meta[property="og:description"]').content = content.intro.replace(/\n/g, "");
  document.querySelectorAll("[data-name]").forEach((el) => el.textContent = content.name);
  document.querySelectorAll("[data-year]").forEach((el) => el.textContent = new Date().getFullYear());
  const title = $("#hero-title");
  title.textContent = content.wordmark || content.name;
  if (!/[.!。！]$/.test(title.textContent)) title.append(make("span", "hero-period", "."));
  $("#hero-role").textContent = content.role;
  setLines($("#hero-intro"), content.intro);
  setLines($("#about-title"), content.aboutTitle);
  $("#about-text").replaceChildren(...content.aboutText.split(/\n\s*\n/).map(p => make("p", "", p)));
  $("#about-tags").replaceChildren(...content.tags.map(tag => make("span", "", tag)));
  if (content.aboutImage) {
    const art = $(".about-art");
    art.removeAttribute("role");
    art.removeAttribute("aria-label");
    art.classList.add("about-portrait");
    const portrait = make("img");
    portrait.src = content.aboutImage;
    portrait.alt = content.aboutImageAlt || content.name;
    portrait.loading = "lazy";
    portrait.width = 1206;
    portrait.height = 1586;
    art.replaceChildren(portrait, make("span", "portrait-caption", "EDWARD / 生活的另一面"));
  }
  $(".work-count").textContent = String(content.projects.length).padStart(2, "0");
  if (content.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.email)) {
    const display = $("#contact-display");
    const contact = make("a", "contact-display");
    contact.id = "contact-display";
    contact.href = `mailto:${content.email}`;
    contact.setAttribute("aria-label", `发送邮件至 ${content.email}`);
    contact.append(...Array.from(display.childNodes));
    display.replaceWith(contact);
    const email = make("a", "", content.email);
    email.href = `mailto:${content.email}`;
    $("#email-label").replaceChildren(email);
  }
  content.socials.forEach(social => {
    const url = safeLink(social.url);
    if (!url) return;
    const link = make("a", "", `${social.label} ↗`);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    $("#social-links").append(link);
  });
  const filters = $("#filters");
  [...new Set(content.projects.map(p => p.category))].forEach(category => {
    const button = make("button", "filter-button", category);
    button.type = "button";
    button.dataset.filter = category;
    button.setAttribute("aria-pressed", "false");
    filters.append(button);
  });
  filters.addEventListener("click", event => {
    const selected = event.target.closest("button[data-filter]");
    if (!selected) return;
    filters.querySelectorAll("button").forEach(button => {
      const active = button === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderProjects(selected.dataset.filter);
  });
  renderProjects();
  fitTitle();
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }), {threshold:0.08});
  document.querySelectorAll(".about-art,.about-copy").forEach(el => {el.classList.add("reveal");observer.observe(el);});
}

$("#dialog-close").addEventListener("click", () => $("#project-dialog").close());
$("#video-start").addEventListener("click", () => {
  const video = $("#dialog-video");
  video.play().then(() => {$("#video-start").hidden = true;}).catch(() => {
    $("#video-start").textContent = "播放暂不可用，请重试";
  });
});
$("#project-dialog").addEventListener("click", event => {
  if (event.target !== $("#project-dialog")) return;
  const bounds = event.target.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close();
});
$("#project-dialog").addEventListener("close", () => {
  const video = $("#dialog-video");
  video.pause();
  video.removeAttribute("src");
  video.replaceChildren();
  video.load();
  document.body.classList.remove("modal-open");
  lastProjectTrigger?.focus({preventScroll:true});
});
window.addEventListener("resize", fitTitle);
fetch("content.json", {cache:"no-cache"})
  .then(response => { if (!response.ok) throw new Error("无法读取网站内容"); return response.json(); })
  .then(populate)
  .catch(error => {$("#site-error").hidden = false; console.error(error);});
