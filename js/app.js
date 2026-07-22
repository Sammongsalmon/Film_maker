(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const canvas = $("previewCanvas");
  const canvasStage = $("canvasStage");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const deg = (value) => value * Math.PI / 180;
  const uidSeed = () => Math.floor(Math.random() * 0x7fffffff);
  const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function makeImageState() {
    return { img: null, name: "", zoom: 1, x: 0, y: 0, angle: 0, quarter: 0 };
  }

  function makeEffects() {
    return {
      filter: { id: "none", strength: 1 },
      lightLeak: { enabled: false, type: "edge-left", color: "#ff8a38", intensity: 0.48, spread: 0.52, seed: uidSeed() },
      overlay: { enabled: false, type: "dust", blend: "screen", opacity: 0.35, includeFrame: false, customImage: null, customName: "", seed: uidSeed() },
      grain: { enabled: false, amount: 0.28, size: 0.32, roughness: 0.52, color: false, seed: uidSeed() }
    };
  }

  function makeCut() {
    return { image: makeImageState(), effects: makeEffects() };
  }

  const state = {
    mode: "movie",
    renderScale: 1,
    renderLayout: null,
    hitMap: [],
    isExporting: false,
    movie: {
      image: makeImageState(), effects: makeEffects(), aspect: "2.39", customAspect: 2.39,
      barsEnabled: true, barsMode: "ratio", overallRatio: "1.7778", customOverallRatio: 1.7778,
      baseWidth: 1920, canvasWidth: 1920, canvasHeight: 1080, barModeWidth: 1920, barSize: 138, barColor: "#000000",
      subtitle: {
        enabled: true, text: "이 장면을 오래 기억하고 싶어.//그때의 빛까지도.", template: "classic",
        font: "Gulim", customFontLoaded: false, customFontName: "", autoSize: true,
        size: 54, weight: 500, color: "#ffffff", strokeColor: "#000000", strokeWidth: 2,
        italic: false, letterSpacing: 0, lineHeight: 1.35, anchor: "bottom-center", x: 0, y: -8
      }
    },
    viewfinder: { image: makeImageState(), effects: makeEffects(), orientation: "landscape", width: 1920, grid: true, rec: true },
    film120: { image: makeImageState(), effects: makeEffects(), orientation: "portrait", width: 1600, frameColor: "#201416", number: "120" },
    film35: {
      count: 6, breakEvery: 6, selected: 0, effectScope: "all", globalEffects: makeEffects(), cuts: Array.from({ length: 6 }, makeCut),
      rowGap: 120, rowOffset: 0, randomOffset: false, offsetJitter: 160, offsetSeed: uidSeed(),
      textEnabled: true, edgeText: "KODAK 400", fitCanvas: false, canvasPreset: "2048x2048", canvasWidth: 2048, canvasHeight: 2048,
      sizeMode: "auto", frameWidth: 420, fitPadding: 240,
      shadow: { enabled: true, color: "#000000", opacity: 0.45, blur: 36, x: 0, y: 22 },
      background: { type: "solid", color1: "#ece9e3", color2: "#b8c9c4", gradientAngle: 135, pattern: "dots", size: 48, rotation: 0, randomRotation: false, jitter: 30, seed: uidSeed() }
    }
  };

  const modeLabels = { movie: "영화 장면", viewfinder: "뷰파인더", film35: "필름롤 · 소형", film120: "필름롤 · 중형" };
  const filterPresets = [
    { id: "none", name: "필터 없음", desc: "원본 색감을 유지합니다.", bg: "linear-gradient(135deg,#535c5b,#b6a28b)" },
    { id: "cool", name: "차가운 장면", desc: "청록과 푸른 기운", bg: "linear-gradient(135deg,#203f4e,#8eb9c2)" },
    { id: "matte", name: "먹먹한 암부", desc: "암부를 띄우고 대비를 낮춤", bg: "linear-gradient(135deg,#25292b,#77746e)" },
    { id: "warm", name: "따뜻한 필름", desc: "노랑·주황 온도감", bg: "linear-gradient(135deg,#5d3524,#e4b06e)" },
    { id: "sepia", name: "세피아", desc: "갈색 단색 인화", bg: "linear-gradient(135deg,#3c281b,#c69c65)" },
    { id: "cinema", name: "틸 앤 오렌지", desc: "청록 암부와 주황 하이라이트", bg: "linear-gradient(135deg,#173e42,#d78352)" },
    { id: "bw", name: "은염 흑백", desc: "부드러운 흑백 대비", bg: "linear-gradient(135deg,#171717,#d8d8d8)" },
    { id: "fade", name: "빛바랜 기록", desc: "낮은 채도와 크림빛", bg: "linear-gradient(135deg,#55615b,#d4c7aa)" }
  ];

  const subtitleTemplates = {
    classic: { font: "Gulim", size: 54, weight: 500, color: "#ffffff", strokeColor: "#000000", strokeWidth: 2.4, italic: false, letterSpacing: 0, lineHeight: 1.35, anchor: "bottom-center", x: 0, y: -8 },
    festival: { font: "PretendardVariable", size: 48, weight: 650, color: "#f8f6ef", strokeColor: "#000000", strokeWidth: 0, italic: false, letterSpacing: 1.2, lineHeight: 1.4, anchor: "bottom-left", x: 0, y: -5 },
    noir: { font: "Batang", size: 58, weight: 400, color: "#f5f1e6", strokeColor: "#050505", strokeWidth: 1.6, italic: true, letterSpacing: 1.8, lineHeight: 1.3, anchor: "bottom-center", x: 0, y: -7 },
    archive: { font: "ChosunMyeongjo", size: 50, weight: 400, color: "#eee8d8", strokeColor: "#111111", strokeWidth: 0.8, italic: false, letterSpacing: 0.6, lineHeight: 1.48, anchor: "top-left", x: 0, y: 2 },
    soft: { font: "PretendardVariable", size: 52, weight: 420, color: "#f3e5c8", strokeColor: "#3b2c24", strokeWidth: 1.2, italic: false, letterSpacing: 0.2, lineHeight: 1.38, anchor: "bottom-center", x: 0, y: -9 }
  };

  let renderQueued = false;
  let dragState = null;
  let filmInputTarget = 0;

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderPreview();
    });
  }

  function getModeObject() {
    return state[state.mode];
  }

  function getActiveImage() {
    if (state.mode === "film35") return state.film35.cuts[state.film35.selected]?.image || null;
    return getModeObject().image;
  }

  function getActiveEffects() {
    if (state.mode !== "film35") return getModeObject().effects;
    return state.film35.effectScope === "all" ? state.film35.globalEffects : state.film35.cuts[state.film35.selected].effects;
  }

  function ensureCuts() {
    const target = clamp(Math.round(state.film35.count), 1, 36);
    state.film35.count = target;
    while (state.film35.cuts.length < target) state.film35.cuts.push(makeCut());
    if (state.film35.cuts.length > target) state.film35.cuts.length = target;
    state.film35.selected = clamp(state.film35.selected, 0, target - 1);
    state.film35.breakEvery = clamp(Math.round(state.film35.breakEvery), 1, target);
  }

  function resetImageTransform(image) {
    if (!image) return;
    image.zoom = 1; image.x = 0; image.y = 0; image.angle = 0; image.quarter = 0;
  }

  function loadImageFile(file, imageState, done) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imageState.img = img;
      imageState.name = file.name;
      resetImageTransform(imageState);
      URL.revokeObjectURL(url);
      done?.();
      syncTransformUI();
      updateCanvasHint();
      queueRender();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("이미지를 읽지 못했습니다.");
    };
    img.src = url;
  }

  function hexToRgb(hex) {
    const clean = String(hex).replace("#", "");
    const value = clean.length === 3 ? clean.split("").map((v) => v + v).join("") : clean.padEnd(6, "0").slice(0, 6);
    return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function createSizedCanvas(width, height, scale = 1) {
    const result = document.createElement("canvas");
    result.width = Math.max(1, Math.round(width * scale));
    result.height = Math.max(1, Math.round(height * scale));
    return result;
  }

  function drawTransformedImage(targetCtx, imageState, x, y, width, height) {
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(x, y, width, height);
    targetCtx.clip();
    if (!imageState?.img) {
      targetCtx.fillStyle = "#b8bfbc";
      targetCtx.fillRect(x, y, width, height);
      targetCtx.fillStyle = "#727b77";
      targetCtx.textAlign = "center";
      targetCtx.textBaseline = "middle";
      targetCtx.font = `600 ${Math.max(11, width * 0.035)}px PretendardVariable`;
      targetCtx.fillText("클릭하여 사진 추가", x + width / 2, y + height / 2);
      targetCtx.restore();
      return;
    }
    const img = imageState.img;
    const fit = Math.max(width / img.naturalWidth, height / img.naturalHeight) * imageState.zoom;
    const tx = x + width / 2 + imageState.x * width / 200;
    const ty = y + height / 2 + imageState.y * height / 200;
    targetCtx.translate(tx, ty);
    targetCtx.rotate(deg(imageState.angle + imageState.quarter * 90));
    targetCtx.scale(fit, fit);
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.imageSmoothingQuality = "high";
    targetCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    targetCtx.restore();
  }

  function applyFilterToCanvas(layer, filter) {
    if (!filter || filter.id === "none" || filter.strength <= 0) return;
    const layerCtx = layer.getContext("2d", { willReadFrequently: true });
    const imageData = layerCtx.getImageData(0, 0, layer.width, layer.height);
    const data = imageData.data;
    const amount = clamp(filter.strength, 0, 1);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let nr = r, ng = g, nb = b;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      switch (filter.id) {
        case "cool":
          nr = r * 0.92 + g * 0.02; ng = g * 1.02 + 3; nb = b * 1.1 + 7;
          break;
        case "matte": {
          const curve = (v) => {
            const n = v / 255;
            return 255 * (0.075 + 0.86 * (n * n * (3 - 2 * n)));
          };
          nr = curve(r) * 0.98; ng = curve(g); nb = curve(b) * 1.02;
          break;
        }
        case "warm":
          nr = r * 1.09 + 8; ng = g * 1.025 + 2; nb = b * 0.89;
          break;
        case "sepia":
          nr = r * 0.393 + g * 0.769 + b * 0.189;
          ng = r * 0.349 + g * 0.686 + b * 0.168;
          nb = r * 0.272 + g * 0.534 + b * 0.131;
          break;
        case "cinema": {
          const shadow = 1 - lum / 255;
          const highlight = lum / 255;
          nr = r + 25 * highlight - 10 * shadow;
          ng = g + 20 * shadow + 3 * highlight;
          nb = b + 30 * shadow - 15 * highlight;
          break;
        }
        case "bw":
          nr = ng = nb = clamp((lum - 128) * 1.08 + 128, 0, 255);
          break;
        case "fade":
          nr = r * 0.82 + lum * 0.12 + 22;
          ng = g * 0.84 + lum * 0.12 + 18;
          nb = b * 0.78 + lum * 0.12 + 12;
          break;
      }
      data[i] = clamp(r + (nr - r) * amount, 0, 255);
      data[i + 1] = clamp(g + (ng - g) * amount, 0, 255);
      data[i + 2] = clamp(b + (nb - b) * amount, 0, 255);
    }
    layerCtx.putImageData(imageData, 0, 0);
  }

  function drawLightLeak(targetCtx, width, height, effect) {
    if (!effect?.enabled || effect.intensity <= 0) return;
    const random = mulberry32(effect.seed);
    const type = effect.type === "random" ? ["edge-left", "edge-right", "corner-top", "corner-bottom", "full", "streak"][Math.floor(random() * 6)] : effect.type;
    const intensity = effect.intensity;
    const spread = effect.spread;
    const main = effect.color;
    const colors = [main, "#ffbd55", "#f65032", "#f07ac0", "#6fb7ff"];
    targetCtx.save();
    targetCtx.globalCompositeOperation = "screen";
    targetCtx.filter = `blur(${Math.max(2, Math.min(width, height) * 0.018)}px)`;

    const fillGradient = (gradient, alpha = 1) => {
      targetCtx.globalAlpha = intensity * alpha;
      targetCtx.fillStyle = gradient;
      targetCtx.fillRect(-width * 0.08, -height * 0.08, width * 1.16, height * 1.16);
    };

    if (type === "edge-left" || type === "edge-right") {
      const left = type === "edge-left";
      const gradient = targetCtx.createLinearGradient(left ? 0 : width, 0, left ? width * (0.25 + spread * 0.65) : width * (0.75 - spread * 0.65), 0);
      gradient.addColorStop(0, rgba(main, 0.95));
      gradient.addColorStop(0.22, rgba(colors[1], 0.48));
      gradient.addColorStop(0.62, rgba(colors[2], 0.16));
      gradient.addColorStop(1, rgba(main, 0));
      fillGradient(gradient);
    } else if (type === "corner-top" || type === "corner-bottom") {
      const x = random() > 0.5 ? width * 0.08 : width * 0.92;
      const y = type === "corner-top" ? height * 0.02 : height * 0.98;
      const radius = Math.max(width, height) * (0.3 + spread * 0.65);
      const gradient = targetCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, rgba("#fff2c4", 0.78));
      gradient.addColorStop(0.16, rgba(main, 0.75));
      gradient.addColorStop(0.46, rgba(colors[2], 0.28));
      gradient.addColorStop(1, rgba(main, 0));
      fillGradient(gradient);
    } else if (type === "full") {
      for (let i = 0; i < 3; i++) {
        const x = random() * width;
        const y = random() * height;
        const radius = Math.max(width, height) * (0.35 + random() * spread * 0.75);
        const gradient = targetCtx.createRadialGradient(x, y, 0, x, y, radius);
        const color = colors[Math.floor(random() * colors.length)];
        gradient.addColorStop(0, rgba(color, 0.58));
        gradient.addColorStop(0.45, rgba(main, 0.18));
        gradient.addColorStop(1, rgba(main, 0));
        fillGradient(gradient, 0.72);
      }
    } else if (type === "streak") {
      const x = width * (0.12 + random() * 0.76);
      const streakWidth = width * (0.05 + spread * 0.26);
      const gradient = targetCtx.createLinearGradient(x - streakWidth, 0, x + streakWidth, 0);
      gradient.addColorStop(0, rgba(main, 0));
      gradient.addColorStop(0.35, rgba(colors[2], 0.22));
      gradient.addColorStop(0.5, rgba("#fff0be", 0.88));
      gradient.addColorStop(0.65, rgba(main, 0.34));
      gradient.addColorStop(1, rgba(main, 0));
      fillGradient(gradient, 0.9);
    }
    targetCtx.restore();
  }

  function drawProceduralOverlay(overlayCtx, width, height, overlay) {
    const random = mulberry32(overlay.seed);
    const countScale = Math.sqrt(width * height) / 900;
    overlayCtx.clearRect(0, 0, width, height);
    if (overlay.type === "custom" && overlay.customImage) {
      const img = overlay.customImage;
      const fit = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      overlayCtx.drawImage(img, (width - img.naturalWidth * fit) / 2, (height - img.naturalHeight * fit) / 2, img.naturalWidth * fit, img.naturalHeight * fit);
      return;
    }
    if (overlay.type === "dust") {
      overlayCtx.fillStyle = "#f1eee4";
      const count = Math.round(160 * countScale);
      for (let i = 0; i < count; i++) {
        const radius = 0.5 + Math.pow(random(), 2.4) * Math.max(2, width * 0.007);
        overlayCtx.globalAlpha = 0.08 + random() * 0.55;
        overlayCtx.beginPath();
        overlayCtx.arc(random() * width, random() * height, radius, 0, Math.PI * 2);
        overlayCtx.fill();
      }
      overlayCtx.globalAlpha = 1;
    } else if (overlay.type === "scratches") {
      const count = Math.round(22 * countScale);
      for (let i = 0; i < count; i++) {
        const x = random() * width;
        const y = random() * height;
        overlayCtx.strokeStyle = random() > 0.35 ? "rgba(255,248,232,.55)" : "rgba(20,18,17,.55)";
        overlayCtx.lineWidth = 0.4 + random() * 1.6;
        overlayCtx.beginPath();
        overlayCtx.moveTo(x, y);
        overlayCtx.lineTo(x + (random() - 0.5) * width * 0.04, y + height * (0.08 + random() * 0.68));
        overlayCtx.stroke();
      }
    } else if (overlay.type === "paper") {
      overlayCtx.fillStyle = "#a88761";
      overlayCtx.fillRect(0, 0, width, height);
      const count = Math.round(3500 * countScale);
      for (let i = 0; i < count; i++) {
        const v = Math.floor(80 + random() * 170);
        overlayCtx.fillStyle = `rgba(${v},${Math.max(0, v - 18)},${Math.max(0, v - 35)},${0.03 + random() * 0.09})`;
        const size = 0.5 + random() * 2.5;
        overlayCtx.fillRect(random() * width, random() * height, size, size);
      }
    } else if (overlay.type === "burn") {
      overlayCtx.globalCompositeOperation = "screen";
      for (let i = 0; i < 4; i++) {
        const x = random() > 0.5 ? random() * width * 0.15 : width * (0.85 + random() * 0.15);
        const y = random() * height;
        const radius = Math.max(width, height) * (0.18 + random() * 0.55);
        const gradient = overlayCtx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, "rgba(255,245,205,.92)");
        gradient.addColorStop(0.2, "rgba(255,137,55,.7)");
        gradient.addColorStop(0.55, "rgba(205,44,32,.3)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        overlayCtx.fillStyle = gradient;
        overlayCtx.fillRect(0, 0, width, height);
      }
      overlayCtx.globalCompositeOperation = "source-over";
    }
  }

  function applyOverlayToCanvas(baseCanvas, overlay, rectPx = null) {
    if (!overlay?.enabled || overlay.opacity <= 0) return;
    const x = rectPx ? Math.round(rectPx.x) : 0;
    const y = rectPx ? Math.round(rectPx.y) : 0;
    const width = rectPx ? Math.max(1, Math.round(rectPx.w)) : baseCanvas.width;
    const height = rectPx ? Math.max(1, Math.round(rectPx.h)) : baseCanvas.height;
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = width;
    overlayCanvas.height = height;
    const overlayCtx = overlayCanvas.getContext("2d");
    drawProceduralOverlay(overlayCtx, width, height, overlay);
    const baseCtx = baseCanvas.getContext("2d", { willReadFrequently: true });
    if (overlay.blend === "divide") {
      const baseData = baseCtx.getImageData(x, y, width, height);
      const overData = overlayCtx.getImageData(0, 0, width, height);
      const b = baseData.data, o = overData.data, opacity = overlay.opacity;
      for (let i = 0; i < b.length; i += 4) {
        const alpha = (o[i + 3] / 255) * opacity;
        if (alpha <= 0) continue;
        for (let channel = 0; channel < 3; channel++) {
          const divided = clamp((b[i + channel] * 255) / Math.max(8, o[i + channel]), 0, 255);
          b[i + channel] = b[i + channel] + (divided - b[i + channel]) * alpha;
        }
      }
      baseCtx.putImageData(baseData, x, y);
      return;
    }
    baseCtx.save();
    baseCtx.globalAlpha = overlay.opacity;
    baseCtx.globalCompositeOperation = overlay.blend;
    baseCtx.drawImage(overlayCanvas, x, y);
    baseCtx.restore();
  }

  const grainCache = new Map();
  function getGrainTile(grain) {
    const key = [grain.seed, grain.size.toFixed(2), grain.roughness.toFixed(2), grain.color].join("-");
    if (grainCache.has(key)) return grainCache.get(key);
    const tile = document.createElement("canvas");
    tile.width = 192; tile.height = 192;
    const tileCtx = tile.getContext("2d");
    const imageData = tileCtx.createImageData(tile.width, tile.height);
    const data = imageData.data;
    const random = mulberry32(grain.seed);
    const rough = grain.roughness;
    const cell = Math.max(1, Math.round(1 + grain.size * 7));
    for (let y = 0; y < tile.height; y += cell) {
      for (let x = 0; x < tile.width; x += cell) {
        const cluster = (random() - 0.5) * 2;
        const value = clamp(128 + cluster * (28 + rough * 90), 0, 255);
        const r = grain.color ? clamp(value + (random() - 0.5) * 55, 0, 255) : value;
        const g = grain.color ? clamp(value + (random() - 0.5) * 55, 0, 255) : value;
        const b = grain.color ? clamp(value + (random() - 0.5) * 55, 0, 255) : value;
        const alpha = clamp(70 + random() * 150 + rough * 30, 0, 255);
        for (let yy = 0; yy < cell && y + yy < tile.height; yy++) {
          for (let xx = 0; xx < cell && x + xx < tile.width; xx++) {
            const idx = ((y + yy) * tile.width + x + xx) * 4;
            data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = alpha;
          }
        }
      }
    }
    tileCtx.putImageData(imageData, 0, 0);
    grainCache.set(key, tile);
    if (grainCache.size > 24) grainCache.delete(grainCache.keys().next().value);
    return tile;
  }

  function drawGrain(targetCtx, x, y, width, height, grain) {
    if (!grain?.enabled || grain.amount <= 0) return;
    const tile = getGrainTile(grain);
    const scale = 0.45 + grain.size * 1.25;
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(x, y, width, height);
    targetCtx.clip();
    targetCtx.translate(x, y);
    targetCtx.scale(scale, scale);
    targetCtx.globalAlpha = grain.amount * 0.68;
    targetCtx.globalCompositeOperation = "overlay";
    targetCtx.fillStyle = targetCtx.createPattern(tile, "repeat");
    targetCtx.fillRect(0, 0, width / scale, height / scale);
    targetCtx.restore();
  }

  function renderPhotoLayer(imageState, width, height, effects, renderScale) {
    const layer = createSizedCanvas(width, height, renderScale);
    const layerCtx = layer.getContext("2d", { willReadFrequently: true });
    layerCtx.scale(renderScale, renderScale);
    drawTransformedImage(layerCtx, imageState, 0, 0, width, height);
    applyFilterToCanvas(layer, effects.filter);
    layerCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    drawLightLeak(layerCtx, width, height, effects.lightLeak);
    if (effects.overlay.enabled && !effects.overlay.includeFrame) applyOverlayToCanvas(layer, effects.overlay);
    return layer;
  }

  function getMovieAspect() {
    const movie = state.movie;
    if (movie.aspect === "original") return movie.image.img ? movie.image.img.naturalWidth / movie.image.img.naturalHeight : 16 / 9;
    if (movie.aspect === "custom") return clamp(movie.customAspect, 0.2, 6);
    return Number(movie.aspect);
  }

  function getMovieLayout() {
    const movie = state.movie;
    const aspect = getMovieAspect();
    let width, height, photoRect;
    if (!movie.barsEnabled) {
      width = movie.baseWidth;
      height = width / aspect;
      photoRect = { x: 0, y: 0, w: width, h: height };
    } else if (movie.barsMode === "size") {
      width = movie.canvasWidth;
      height = movie.canvasHeight;
      let photoW = width;
      let photoH = photoW / aspect;
      if (photoH > height) { photoH = height; photoW = photoH * aspect; }
      photoRect = { x: (width - photoW) / 2, y: (height - photoH) / 2, w: photoW, h: photoH };
    } else if (movie.barsMode === "bar") {
      width = movie.barModeWidth;
      const photoH = width / aspect;
      height = photoH + movie.barSize * 2;
      photoRect = { x: 0, y: movie.barSize, w: width, h: photoH };
    } else {
      width = movie.baseWidth;
      const ratio = movie.overallRatio === "custom" ? movie.customOverallRatio : Number(movie.overallRatio);
      height = width / clamp(ratio, 0.2, 6);
      let photoW = width;
      let photoH = photoW / aspect;
      if (photoH > height) { photoH = height; photoW = photoH * aspect; }
      photoRect = { x: (width - photoW) / 2, y: (height - photoH) / 2, w: photoW, h: photoH };
    }
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), photoRect };
  }

  function getViewfinderLayout() {
    const v = state.viewfinder;
    const width = v.width;
    const height = v.orientation === "landscape" ? width * 0.625 : width * 1.5;
    return { width: Math.round(width), height: Math.round(height), photoRect: { x: 0, y: 0, w: width, h: height } };
  }

  function getFilm120Layout() {
    const f = state.film120;
    const width = f.width;
    const height = f.orientation === "portrait" ? width * 1.22 : width * 0.82;
    const margin = Math.min(width, height) * 0.065;
    return { width: Math.round(width), height: Math.round(height), photoRect: { x: margin, y: margin, w: width - margin * 2, h: height - margin * 2 } };
  }

  function getFilm35Layout() {
    ensureCuts();
    const f = state.film35;
    const perRow = clamp(f.breakEvery, 1, f.count);
    const rows = Math.ceil(f.count / perRow);
    let canvasWidth = f.canvasWidth;
    let canvasHeight = f.canvasHeight;
    let frameWidth;
    if (f.sizeMode === "auto" && !f.fitCanvas) {
      const usable = Math.max(160, canvasWidth * 0.88);
      frameWidth = clamp((usable + (perRow - 1)) / perRow, 120, 1600);
    } else {
      frameWidth = f.frameWidth;
    }
    const frameHeight = frameWidth * 0.98;
    const rowWidths = [];
    const rowOffsets = [];
    const random = mulberry32(f.offsetSeed);
    for (let row = 0; row < rows; row++) {
      const count = Math.min(perRow, f.count - row * perRow);
      rowWidths[row] = count * frameWidth - Math.max(0, count - 1);
      rowOffsets[row] = f.randomOffset ? (random() - 0.5) * 2 * f.offsetJitter : row * f.rowOffset;
    }
    if (f.fitCanvas) {
      const minX = Math.min(...rowOffsets);
      const maxX = Math.max(...rowOffsets.map((offset, index) => offset + rowWidths[index]));
      const padding = rows > 1 ? f.fitPadding : 0;
      canvasWidth = maxX - minX + padding * 2;
      canvasHeight = rows * frameHeight + Math.max(0, rows - 1) * f.rowGap + padding * 2;
    }
    const totalHeight = rows * frameHeight + Math.max(0, rows - 1) * f.rowGap;
    const startY = f.fitCanvas ? (rows > 1 ? f.fitPadding : 0) : (canvasHeight - totalHeight) / 2;
    let minOffset = Math.min(...rowOffsets);
    const positions = [];
    for (let row = 0; row < rows; row++) {
      const count = Math.min(perRow, f.count - row * perRow);
      let startX;
      if (f.fitCanvas) {
        const padding = rows > 1 ? f.fitPadding : 0;
        startX = padding + rowOffsets[row] - minOffset;
      } else {
        startX = (canvasWidth - rowWidths[row]) / 2 + rowOffsets[row];
      }
      for (let col = 0; col < count; col++) {
        const index = row * perRow + col;
        positions.push({ index, x: startX + col * (frameWidth - 1), y: startY + row * (frameHeight + f.rowGap), w: frameWidth, h: frameHeight, row, col });
      }
    }
    return { width: Math.max(1, Math.round(canvasWidth)), height: Math.max(1, Math.round(canvasHeight)), frameWidth, frameHeight, rows, positions, transparentFit: f.fitCanvas && rows === 1 };
  }

  function getLayout() {
    if (state.mode === "movie") return getMovieLayout();
    if (state.mode === "viewfinder") return getViewfinderLayout();
    if (state.mode === "film120") return getFilm120Layout();
    return getFilm35Layout();
  }

  function drawSubtitle(targetCtx, width, height) {
    const s = state.movie.subtitle;
    if (!s.enabled || !s.text.trim()) return;
    const lines = s.text.split("//").map((line) => line.trim());
    const horizontal = s.anchor.endsWith("left") ? "left" : s.anchor.endsWith("right") ? "right" : "center";
    const vertical = s.anchor.startsWith("top") ? "top" : s.anchor.startsWith("middle") ? "middle" : "bottom";
    let fontSize = s.size;
    const fontName = s.font === "custom" && s.customFontLoaded ? "UserFont" : s.font === "custom" ? "PretendardVariable" : s.font;
    const fontStyle = s.italic ? "italic" : "normal";
    const setFont = () => { targetCtx.font = `${fontStyle} ${s.weight} ${fontSize}px "${fontName}", sans-serif`; };
    setFont();
    if (s.autoSize) {
      const maxWidth = width * 0.86;
      const widest = Math.max(...lines.map((line) => measureSpacedText(targetCtx, line, s.letterSpacing)));
      if (widest > maxWidth) {
        fontSize = Math.max(12, fontSize * maxWidth / widest);
        setFont();
      }
    }
    const lineHeight = fontSize * s.lineHeight;
    const totalHeight = lineHeight * lines.length;
    let x = horizontal === "left" ? width * 0.06 : horizontal === "right" ? width * 0.94 : width * 0.5;
    let y = vertical === "top" ? height * 0.08 : vertical === "middle" ? height * 0.5 - totalHeight / 2 : height * 0.92 - totalHeight;
    x += s.x * width / 200;
    y += s.y * height / 200;
    targetCtx.save();
    targetCtx.textBaseline = "top";
    targetCtx.lineJoin = "round";
    targetCtx.miterLimit = 2;
    targetCtx.fillStyle = s.color;
    targetCtx.strokeStyle = s.strokeColor;
    targetCtx.lineWidth = s.strokeWidth;
    lines.forEach((line, index) => {
      const lineY = y + index * lineHeight;
      if (s.strokeWidth > 0) drawSpacedText(targetCtx, line, x, lineY, s.letterSpacing, horizontal, true);
      drawSpacedText(targetCtx, line, x, lineY, s.letterSpacing, horizontal, false);
    });
    targetCtx.restore();
  }

  function measureSpacedText(targetCtx, text, spacing) {
    if (!text) return 0;
    return [...text].reduce((sum, char, index, arr) => sum + targetCtx.measureText(char).width + (index < arr.length - 1 ? spacing : 0), 0);
  }

  function drawSpacedText(targetCtx, text, x, y, spacing, align, stroke) {
    const chars = [...text];
    const total = measureSpacedText(targetCtx, text, spacing);
    let cursor = align === "left" ? x : align === "right" ? x - total : x - total / 2;
    chars.forEach((char, index) => {
      if (stroke) targetCtx.strokeText(char, cursor, y); else targetCtx.fillText(char, cursor, y);
      cursor += targetCtx.measureText(char).width + (index < chars.length - 1 ? spacing : 0);
    });
  }

  function drawViewfinderFrame(targetCtx, width, height) {
    const v = state.viewfinder;
    const unit = Math.min(width, height);
    const outer = unit * 0.026;
    targetCtx.save();
    targetCtx.strokeStyle = "rgba(24,21,22,.93)";
    targetCtx.lineWidth = outer;
    targetCtx.strokeRect(outer / 2, outer / 2, width - outer, height - outer);
    targetCtx.strokeStyle = "rgba(22,20,21,.9)";
    targetCtx.lineWidth = unit * 0.006;
    const inset = unit * 0.052;
    const corner = unit * 0.15;
    [[inset, inset, 1, 1], [width - inset, inset, -1, 1], [inset, height - inset, 1, -1], [width - inset, height - inset, -1, -1]].forEach(([x, y, sx, sy]) => {
      targetCtx.beginPath();
      targetCtx.moveTo(x, y + sy * corner);
      targetCtx.lineTo(x, y);
      targetCtx.lineTo(x + sx * corner, y);
      targetCtx.stroke();
    });
    if (v.grid) {
      targetCtx.strokeStyle = "rgba(180,190,187,.42)";
      targetCtx.lineWidth = Math.max(1, unit * 0.0015);
      [1 / 3, 2 / 3].forEach((t) => {
        targetCtx.beginPath(); targetCtx.moveTo(width * t, outer); targetCtx.lineTo(width * t, height - outer); targetCtx.stroke();
        targetCtx.beginPath(); targetCtx.moveTo(outer, height * t); targetCtx.lineTo(width - outer, height * t); targetCtx.stroke();
      });
      targetCtx.beginPath(); targetCtx.moveTo(width / 2, outer); targetCtx.lineTo(width / 2, height - outer); targetCtx.stroke();
    }
    if (v.rec) {
      const recY = height * 0.1;
      targetCtx.fillStyle = "#ff2636";
      targetCtx.beginPath(); targetCtx.arc(width * 0.085, recY, unit * 0.015, 0, Math.PI * 2); targetCtx.fill();
      targetCtx.fillStyle = "rgba(255,255,255,.94)";
      roundRect(targetCtx, width * 0.108, recY - unit * 0.021, unit * 0.075, unit * 0.042, unit * 0.006); targetCtx.fill();
      targetCtx.fillStyle = "#131313";
      targetCtx.font = `700 ${unit * 0.027}px PretendardVariable`;
      targetCtx.textAlign = "center"; targetCtx.textBaseline = "middle";
      targetCtx.fillText("REC", width * 0.1455, recY);
      drawBattery(targetCtx, width * 0.84, recY - unit * 0.018, unit * 0.095, unit * 0.036);
      targetCtx.fillStyle = "rgba(25,22,23,.92)";
      roundRect(targetCtx, width * 0.82, height * 0.86, unit * 0.115, unit * 0.045, unit * 0.008); targetCtx.fill();
      targetCtx.fillStyle = "#fff"; targetCtx.font = `700 ${unit * 0.026}px PretendardVariable`; targetCtx.fillText("4K", width * 0.855, height * 0.882);
    }
    targetCtx.restore();
  }

  function drawBattery(targetCtx, x, y, w, h) {
    targetCtx.save();
    targetCtx.strokeStyle = "rgba(24,21,22,.94)";
    targetCtx.lineWidth = Math.max(2, h * 0.12);
    roundRect(targetCtx, x, y, w, h, h * 0.16); targetCtx.stroke();
    targetCtx.fillStyle = "rgba(24,21,22,.94)";
    targetCtx.fillRect(x - h * 0.16, y + h * 0.25, h * 0.14, h * 0.5);
    const gap = w * 0.06;
    for (let i = 0; i < 3; i++) targetCtx.fillRect(x + gap + i * (w - gap * 2) / 3, y + gap, (w - gap * 3) / 3, h - gap * 2);
    targetCtx.restore();
  }

  function roundRect(targetCtx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    targetCtx.beginPath();
    targetCtx.moveTo(x + radius, y);
    targetCtx.arcTo(x + w, y, x + w, y + h, radius);
    targetCtx.arcTo(x + w, y + h, x, y + h, radius);
    targetCtx.arcTo(x, y + h, x, y, radius);
    targetCtx.arcTo(x, y, x + w, y, radius);
    targetCtx.closePath();
  }

  function drawTriangle(targetCtx, x, y, size, direction = 1) {
    targetCtx.beginPath();
    targetCtx.moveTo(x, y - size * 0.34);
    targetCtx.lineTo(x + direction * size, y);
    targetCtx.lineTo(x, y + size * 0.34);
    targetCtx.closePath();
    targetCtx.fill();
  }

  function drawFilm120Frame(targetCtx, width, height, photoRect) {
    const f = state.film120;
    const fc = f.frameColor;
    const u = Math.min(width, height);
    targetCtx.save();
    targetCtx.fillStyle = fc;
    targetCtx.fillRect(0, 0, width, photoRect.y);
    targetCtx.fillRect(0, photoRect.y + photoRect.h, width, height - photoRect.y - photoRect.h);
    targetCtx.fillRect(0, photoRect.y, photoRect.x, photoRect.h);
    targetCtx.fillRect(photoRect.x + photoRect.w, photoRect.y, width - photoRect.x - photoRect.w, photoRect.h);
    targetCtx.strokeStyle = rgba("#fff0df", 0.2);
    targetCtx.lineWidth = Math.max(1, u * 0.002);
    targetCtx.strokeRect(photoRect.x, photoRect.y, photoRect.w, photoRect.h);
    targetCtx.fillStyle = "#ef9e7f";
    targetCtx.font = `700 ${u * 0.018}px PretendardVariable`;
    targetCtx.textAlign = "center";
    targetCtx.textBaseline = "middle";
    const marks = [0.13, 0.5, 0.86];
    marks.forEach((t, i) => {
      const y = height * t;
      drawTriangle(targetCtx, width - u * 0.032, y, u * 0.018, -1);
      targetCtx.save(); targetCtx.translate(width - u * 0.018, y + u * 0.04); targetCtx.rotate(Math.PI / 2); targetCtx.fillText(i === 1 ? f.number : "400", 0, 0); targetCtx.restore();
    });
    [0.26, 0.72].forEach((t) => {
      const y = height * t;
      drawTriangle(targetCtx, u * 0.032, y, u * 0.018, 1);
      targetCtx.save(); targetCtx.translate(u * 0.018, y + u * 0.04); targetCtx.rotate(-Math.PI / 2); targetCtx.fillText(f.number, 0, 0); targetCtx.restore();
    });
    const notch = u * 0.018;
    targetCtx.fillStyle = "rgba(0,0,0,.95)";
    for (let i = 0; i < 3; i++) {
      targetCtx.beginPath(); targetCtx.arc(width * 0.78 + i * notch * 1.3, height, notch * 0.48, Math.PI, 0); targetCtx.fill();
    }
    targetCtx.restore();
  }

  function drawFilm35Cut(cut, effects, index, width, height, renderScale, selected, exportMode) {
    const cutCanvas = createSizedCanvas(width, height, renderScale);
    const cutCtx = cutCanvas.getContext("2d", { willReadFrequently: true });
    cutCtx.scale(renderScale, renderScale);
    const frameColor = "#2b2927";
    const markerColor = "#e9c693";
    cutCtx.fillStyle = frameColor;
    cutCtx.fillRect(0, 0, width, height);
    const photo = { x: width * 0.065, y: height * 0.138, w: width * 0.87, h: height * 0.69 };
    const layer = renderPhotoLayer(cut.image, photo.w, photo.h, effects, renderScale);
    cutCtx.drawImage(layer, photo.x, photo.y, photo.w, photo.h);
    cutCtx.strokeStyle = "rgba(0,0,0,.7)";
    cutCtx.lineWidth = Math.max(1, width * 0.008);
    cutCtx.strokeRect(photo.x, photo.y, photo.w, photo.h);
    cutCtx.fillStyle = "#020303";
    const holes = 10;
    const holeW = width * 0.044;
    const holeH = height * 0.064;
    const gap = (width - holes * holeW) / (holes + 1);
    for (let i = 0; i < holes; i++) {
      const x = gap + i * (holeW + gap);
      roundRect(cutCtx, x, height * 0.035, holeW, holeH, holeW * 0.35); cutCtx.fill();
      roundRect(cutCtx, x, height - height * 0.035 - holeH, holeW, holeH, holeW * 0.35); cutCtx.fill();
    }
    cutCtx.fillStyle = markerColor;
    const tri = width * 0.06;
    drawTriangle(cutCtx, width * 0.014, height * 0.035, tri, 1);
    drawTriangle(cutCtx, width * 0.014, height * 0.955, tri, 1);
    drawTriangle(cutCtx, width * 0.93, height * 0.035, tri, 1);
    drawTriangle(cutCtx, width * 0.93, height * 0.955, tri, 1);
    drawTriangle(cutCtx, width * 0.49, height * 0.035, tri, 1);
    drawTriangle(cutCtx, width * 0.49, height * 0.955, tri, 1);
    cutCtx.font = `700 ${width * 0.025}px PretendardVariable`;
    cutCtx.textAlign = "left";
    cutCtx.textBaseline = "middle";
    cutCtx.fillText(String(index + 1).padStart(2, "0"), width * 0.57, height * 0.035);
    cutCtx.fillText(String(index + 1).padStart(2, "0"), width * 0.57, height * 0.955);
    if (state.film35.textEnabled && index % 2 === 0 && state.film35.edgeText.trim()) {
      cutCtx.font = `650 ${width * 0.016}px PretendardVariable`;
      cutCtx.fillText(state.film35.edgeText.toUpperCase(), width * 0.075, height * 0.035);
      cutCtx.fillText(state.film35.edgeText.toUpperCase(), width * 0.075, height * 0.955);
    }
    if (!exportMode && selected) {
      cutCtx.strokeStyle = "#59d4bd";
      cutCtx.lineWidth = Math.max(2, width * 0.012);
      cutCtx.strokeRect(width * 0.008, height * 0.008, width * 0.984, height * 0.984);
    }
    if (effects.overlay.enabled && effects.overlay.includeFrame) applyOverlayToCanvas(cutCanvas, effects.overlay);
    cutCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    drawGrain(cutCtx, 0, 0, width, height, effects.grain);
    return { canvas: cutCanvas, photoRect: photo };
  }

  function drawBackground(targetCtx, layout) {
    const bg = state.film35.background;
    if (layout.transparentFit || bg.type === "transparent") return;
    if (bg.type === "solid") {
      targetCtx.fillStyle = bg.color1;
      targetCtx.fillRect(0, 0, layout.width, layout.height);
      return;
    }
    if (bg.type === "gradient") {
      const angle = deg(bg.gradientAngle - 90);
      const cx = layout.width / 2, cy = layout.height / 2;
      const length = Math.abs(layout.width * Math.cos(angle)) + Math.abs(layout.height * Math.sin(angle));
      const gradient = targetCtx.createLinearGradient(cx - Math.cos(angle) * length / 2, cy - Math.sin(angle) * length / 2, cx + Math.cos(angle) * length / 2, cy + Math.sin(angle) * length / 2);
      gradient.addColorStop(0, bg.color1); gradient.addColorStop(1, bg.color2);
      targetCtx.fillStyle = gradient; targetCtx.fillRect(0, 0, layout.width, layout.height);
      return;
    }
    targetCtx.fillStyle = bg.color1;
    targetCtx.fillRect(0, 0, layout.width, layout.height);
    drawPattern(targetCtx, layout.width, layout.height, bg);
  }

  function drawPattern(targetCtx, width, height, bg) {
    const random = mulberry32(bg.seed);
    const size = Math.max(8, bg.size);
    const cols = Math.ceil(width / size) + 2;
    const rows = Math.ceil(height / size) + 2;
    targetCtx.save();
    targetCtx.globalAlpha = 0.42;
    targetCtx.strokeStyle = bg.color2;
    targetCtx.fillStyle = bg.color2;
    targetCtx.lineWidth = Math.max(1, size * 0.035);
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * size + (bg.pattern === "diagonal" && row % 2 ? size / 2 : 0);
        const y = row * size;
        const rotation = deg(bg.rotation + (bg.randomRotation ? (random() - 0.5) * 2 * bg.jitter : 0));
        targetCtx.save();
        targetCtx.translate(x + size / 2, y + size / 2);
        targetCtx.rotate(rotation);
        if (bg.pattern === "dots") {
          targetCtx.beginPath(); targetCtx.arc(0, 0, size * 0.09, 0, Math.PI * 2); targetCtx.fill();
        } else if (bg.pattern === "grid") {
          targetCtx.strokeRect(-size / 2, -size / 2, size, size);
        } else if (bg.pattern === "diagonal") {
          targetCtx.beginPath(); targetCtx.moveTo(-size * 0.45, size * 0.28); targetCtx.lineTo(size * 0.45, -size * 0.28); targetCtx.stroke();
        } else {
          const w = size * (0.14 + random() * 0.18), h = size * (0.05 + random() * 0.1);
          roundRect(targetCtx, -w / 2, -h / 2, w, h, h / 2); targetCtx.fill();
        }
        targetCtx.restore();
      }
    }
    targetCtx.restore();
  }

  function drawMovie(targetCanvas, layout, renderScale) {
    const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });
    targetCtx.scale(renderScale, renderScale);
    const m = state.movie;
    if (m.barsEnabled) {
      targetCtx.fillStyle = m.barColor;
      targetCtx.fillRect(0, 0, layout.width, layout.height);
    }
    const layer = renderPhotoLayer(m.image, layout.photoRect.w, layout.photoRect.h, m.effects, renderScale);
    targetCtx.drawImage(layer, layout.photoRect.x, layout.photoRect.y, layout.photoRect.w, layout.photoRect.h);
    drawSubtitle(targetCtx, layout.width, layout.height);
    if (m.effects.overlay.enabled && m.effects.overlay.includeFrame) {
      targetCtx.setTransform(1, 0, 0, 1, 0, 0);
      applyOverlayToCanvas(targetCanvas, m.effects.overlay);
      targetCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    }
    drawGrain(targetCtx, 0, 0, layout.width, layout.height, m.effects.grain);
    return [{ index: 0, rect: layout.photoRect, image: m.image }];
  }

  function drawViewfinder(targetCanvas, layout, renderScale) {
    const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });
    targetCtx.scale(renderScale, renderScale);
    const v = state.viewfinder;
    const layer = renderPhotoLayer(v.image, layout.width, layout.height, v.effects, renderScale);
    targetCtx.drawImage(layer, 0, 0, layout.width, layout.height);
    drawViewfinderFrame(targetCtx, layout.width, layout.height);
    if (v.effects.overlay.enabled && v.effects.overlay.includeFrame) {
      targetCtx.setTransform(1, 0, 0, 1, 0, 0);
      applyOverlayToCanvas(targetCanvas, v.effects.overlay);
      targetCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    }
    drawGrain(targetCtx, 0, 0, layout.width, layout.height, v.effects.grain);
    return [{ index: 0, rect: layout.photoRect, image: v.image }];
  }

  function drawFilm120(targetCanvas, layout, renderScale) {
    const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });
    targetCtx.scale(renderScale, renderScale);
    const f = state.film120;
    targetCtx.fillStyle = f.frameColor;
    targetCtx.fillRect(0, 0, layout.width, layout.height);
    const layer = renderPhotoLayer(f.image, layout.photoRect.w, layout.photoRect.h, f.effects, renderScale);
    targetCtx.drawImage(layer, layout.photoRect.x, layout.photoRect.y, layout.photoRect.w, layout.photoRect.h);
    drawFilm120Frame(targetCtx, layout.width, layout.height, layout.photoRect);
    if (f.effects.overlay.enabled && f.effects.overlay.includeFrame) {
      targetCtx.setTransform(1, 0, 0, 1, 0, 0);
      applyOverlayToCanvas(targetCanvas, f.effects.overlay);
      targetCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    }
    drawGrain(targetCtx, 0, 0, layout.width, layout.height, f.effects.grain);
    return [{ index: 0, rect: layout.photoRect, image: f.image }];
  }

  function drawFilm35(targetCanvas, layout, renderScale, exportMode) {
    const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });
    targetCtx.scale(renderScale, renderScale);
    drawBackground(targetCtx, layout);
    const hitMap = [];
    const f = state.film35;
    layout.positions.forEach((position) => {
      const cut = f.cuts[position.index];
      const effects = f.effectScope === "all" ? f.globalEffects : cut.effects;
      if (f.shadow.enabled && !layout.transparentFit) {
        targetCtx.save();
        targetCtx.shadowColor = rgba(f.shadow.color, f.shadow.opacity);
        targetCtx.shadowBlur = f.shadow.blur;
        targetCtx.shadowOffsetX = f.shadow.x;
        targetCtx.shadowOffsetY = f.shadow.y;
        targetCtx.fillStyle = "rgba(30,28,27,.98)";
        targetCtx.fillRect(position.x, position.y, position.w, position.h);
        targetCtx.restore();
      }
      const rendered = drawFilm35Cut(cut, effects, position.index, position.w, position.h, renderScale, position.index === f.selected, exportMode);
      targetCtx.drawImage(rendered.canvas, position.x, position.y, position.w, position.h);
      hitMap.push({ index: position.index, rect: { x: position.x + rendered.photoRect.x, y: position.y + rendered.photoRect.y, w: rendered.photoRect.w, h: rendered.photoRect.h }, frameRect: position, image: cut.image });
    });
    return hitMap;
  }

  function renderInto(targetCanvas, layout, renderScale, exportMode = false) {
    targetCanvas.width = Math.max(1, Math.round(layout.width * renderScale));
    targetCanvas.height = Math.max(1, Math.round(layout.height * renderScale));
    const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    if (state.mode === "movie") return drawMovie(targetCanvas, layout, renderScale);
    if (state.mode === "viewfinder") return drawViewfinder(targetCanvas, layout, renderScale);
    if (state.mode === "film120") return drawFilm120(targetCanvas, layout, renderScale);
    return drawFilm35(targetCanvas, layout, renderScale, exportMode);
  }

  function renderPreview() {
    if (state.isExporting) return;
    const layout = getLayout();
    const maxW = 1500;
    const maxH = 1100;
    const scale = Math.min(1, maxW / layout.width, maxH / layout.height);
    state.renderScale = scale;
    state.renderLayout = layout;
    state.hitMap = renderInto(canvas, layout, scale, false);
    $("previewSizeLabel").textContent = `${Math.round(layout.width)} × ${Math.round(layout.height)}`;
    updateCanvasHint();
  }

  function updateCanvasHint() {
    let hasImage;
    if (state.mode === "film35") hasImage = state.film35.cuts.some((cut) => cut.image.img);
    else hasImage = Boolean(getModeObject().image.img);
    $("canvasHint").hidden = hasImage;
  }

  function pointInRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function eventToLogical(event) {
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) * canvas.width / rect.width;
    const py = (event.clientY - rect.top) * canvas.height / rect.height;
    return { x: px / state.renderScale, y: py / state.renderScale };
  }

  function findHit(point) {
    if (state.mode === "film35") return state.hitMap.find((hit) => pointInRect(point, hit.frameRect || hit.rect));
    return state.hitMap.find((hit) => pointInRect(point, hit.rect));
  }

  canvas.addEventListener("pointerdown", (event) => {
    const point = eventToLogical(event);
    const hit = findHit(point);
    if (!hit) return;
    if (state.mode === "film35") {
      state.film35.selected = hit.index;
      $("film35SelectedCut").value = hit.index + 1;
      syncTransformUI();
      syncEffectsUI();
      queueRender();
    }
    const image = hit.image;
    if (!image.img) {
      openImageForCurrentMode(hit.index);
      return;
    }
    dragState = { pointerId: event.pointerId, start: point, image, startX: image.x, startY: image.y, rect: hit.rect, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const point = eventToLogical(event);
    const dx = point.x - dragState.start.x;
    const dy = point.y - dragState.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) dragState.moved = true;
    dragState.image.x = clamp(dragState.startX + dx / dragState.rect.w * 200, -100, 100);
    dragState.image.y = clamp(dragState.startY + dy / dragState.rect.h * 200, -100, 100);
    syncTransformUI();
    queueRender();
  });

  function finishDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove("is-dragging");
    dragState = null;
  }
  canvas.addEventListener("pointerup", finishDrag);
  canvas.addEventListener("pointercancel", finishDrag);

  canvas.addEventListener("wheel", (event) => {
    const point = eventToLogical(event);
    const hit = findHit(point);
    if (!hit?.image?.img) return;
    event.preventDefault();
    hit.image.zoom = clamp(hit.image.zoom * (event.deltaY > 0 ? 0.94 : 1.06), 0.5, 4);
    if (state.mode === "film35" && state.film35.selected !== hit.index) {
      state.film35.selected = hit.index;
      syncEffectsUI();
    }
    syncTransformUI();
    queueRender();
  }, { passive: false });

  function openImageForCurrentMode(index = null) {
    if (state.mode === "movie") $("movieImageInput").click();
    else if (state.mode === "viewfinder") $("viewfinderImageInput").click();
    else if (state.mode === "film120") $("film120ImageInput").click();
    else {
      filmInputTarget = index ?? state.film35.selected;
      $("film35CutInput").value = "";
      $("film35CutInput").click();
    }
  }

  function updateRangeVisual(input) {
    if (!input || input.type !== "range") return;
    const min = Number(input.min || 0), max = Number(input.max || 100), value = Number(input.value);
    const ratio = max === min ? 0 : (value - min) / (max - min) * 100;
    input.style.setProperty("--value", `${100 - ratio}%`);
  }

  function setPairValues(rangeId, numberId, value) {
    const range = $(rangeId), number = $(numberId);
    if (range) { range.value = value; updateRangeVisual(range); }
    if (number) number.value = value;
  }

  function bindRangePair(rangeId, numberId, getter, setter, options = {}) {
    const range = $(rangeId), number = $(numberId);
    const apply = (raw) => {
      const value = Number(raw);
      setter(value);
      setPairValues(rangeId, numberId, options.display ? options.display(getter()) : getter());
      options.after?.();
      queueRender();
    };
    range.addEventListener("input", () => apply(range.value));
    number.addEventListener("input", () => apply(number.value));
    updateRangeVisual(range);
  }

  function bindValue(id, getter, setter, eventName = "input", after = null) {
    const element = $(id);
    element.addEventListener(eventName, () => {
      const value = element.type === "checkbox" ? element.checked : element.type === "number" ? Number(element.value) : element.value;
      setter(value);
      after?.();
      queueRender();
    });
  }

  function bindColor(colorId, textId, getter, setter, after = null) {
    const color = $(colorId), text = $(textId);
    const apply = (value) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
      setter(value.toLowerCase());
      color.value = value;
      text.value = value.toLowerCase();
      after?.();
      queueRender();
    };
    color.addEventListener("input", () => apply(color.value));
    text.addEventListener("change", () => apply(text.value));
  }

  function syncTransformUI() {
    const image = getActiveImage();
    const disabled = !image;
    ["imageZoom", "imageZoomNumber", "imageOffsetX", "imageOffsetXNumber", "imageOffsetY", "imageOffsetYNumber", "imageAngle", "imageAngleNumber", "rotateLeftBtn", "rotateRightBtn", "resetTransformBtn"].forEach((id) => $(id).disabled = disabled);
    if (!image) return;
    setPairValues("imageZoom", "imageZoomNumber", Math.round(image.zoom * 100));
    setPairValues("imageOffsetX", "imageOffsetXNumber", Math.round(image.x * 10) / 10);
    setPairValues("imageOffsetY", "imageOffsetYNumber", Math.round(image.y * 10) / 10);
    setPairValues("imageAngle", "imageAngleNumber", Math.round(image.angle * 10) / 10);
  }

  function syncEffectsUI() {
    const e = getActiveEffects();
    $("grainEnabled").checked = e.grain.enabled;
    setPairValues("grainAmount", "grainAmountNumber", Math.round(e.grain.amount * 100));
    setPairValues("grainSize", "grainSizeNumber", Math.round(e.grain.size * 100));
    setPairValues("grainRoughness", "grainRoughnessNumber", Math.round(e.grain.roughness * 100));
    $("grainColor").checked = e.grain.color;
    $("overlayEnabled").checked = e.overlay.enabled;
    $("overlayType").value = e.overlay.type;
    $("overlayBlend").value = e.overlay.blend;
    setPairValues("overlayOpacity", "overlayOpacityNumber", Math.round(e.overlay.opacity * 100));
    $("overlayIncludeFrame").checked = e.overlay.includeFrame;
    $("overlayImageName").textContent = e.overlay.customName || "미등록";
    $("lightLeakEnabled").checked = e.lightLeak.enabled;
    $("lightLeakType").value = e.lightLeak.type;
    $("lightLeakColor").value = e.lightLeak.color;
    $("lightLeakColorText").value = e.lightLeak.color;
    setPairValues("lightLeakIntensity", "lightLeakIntensityNumber", Math.round(e.lightLeak.intensity * 100));
    setPairValues("lightLeakSpread", "lightLeakSpreadNumber", Math.round(e.lightLeak.spread * 100));
    setPairValues("filterStrength", "filterStrengthNumber", Math.round(e.filter.strength * 100));
    updateFilterPicker(e.filter.id);
    updateEffectSummary();
  }

  function updateEffectSummary() {
    const e = getActiveEffects();
    const states = [
      [$("grainSummaryState"), e.grain.enabled, e.grain.enabled ? "ON" : "OFF"],
      [$("overlaySummaryState"), e.overlay.enabled, e.overlay.enabled ? "ON" : "OFF"],
      [$("lightLeakSummaryState"), e.lightLeak.enabled, e.lightLeak.enabled ? "ON" : "OFF"],
      [$("filterSummaryState"), e.filter.id !== "none", e.filter.id === "none" ? "NONE" : "ON"]
    ];
    states.forEach(([element, on, text]) => { element.textContent = text; element.classList.toggle("is-on", on); });
  }

  function updateFilterPicker(id) {
    const preset = filterPresets.find((item) => item.id === id) || filterPresets[0];
    $("filterPickerName").textContent = preset.name;
    $("filterPickerDesc").textContent = preset.desc;
    $$(".filter-card").forEach((card) => card.classList.toggle("is-active", card.dataset.filter === id));
  }

  function syncMovieUI() {
    const m = state.movie, s = m.subtitle;
    $("movieAspect").value = m.aspect;
    $("movieCustomAspect").value = m.customAspect;
    $("movieCustomAspectWrap").hidden = m.aspect !== "custom";
    $("movieBarsEnabled").checked = m.barsEnabled;
    $("movieBarsOptions").hidden = !m.barsEnabled;
    $("movieBarsMode").value = m.barsMode;
    $$('[data-bars-mode]').forEach((block) => block.hidden = block.dataset.barsMode !== m.barsMode);
    $("movieOverallRatio").value = m.overallRatio;
    $("movieCustomOverallRatio").value = m.customOverallRatio;
    $("movieCustomOverallRatioWrap").hidden = m.overallRatio !== "custom";
    setPairValues("movieBaseWidth", "movieBaseWidthNumber", m.baseWidth);
    $("movieCanvasWidth").value = m.canvasWidth;
    $("movieCanvasHeight").value = m.canvasHeight;
    $("movieBarModeWidth").value = m.barModeWidth;
    $("movieBarSize").value = m.barSize;
    $("movieBarColor").value = m.barColor;
    $("movieBarColorText").value = m.barColor;
    $("movieImageName").textContent = m.image.name || "캔버스를 클릭해도 사진을 추가할 수 있습니다.";
    $("subtitleEnabled").checked = s.enabled;
    $("subtitleText").value = s.text;
    $("subtitleTemplate").value = s.template;
    $("subtitleFont").value = s.font;
    $("subtitleAutoSize").checked = s.autoSize;
    setPairValues("subtitleSize", "subtitleSizeNumber", s.size);
    setPairValues("subtitleWeight", "subtitleWeightNumber", s.weight);
    $("subtitleColor").value = s.color; $("subtitleColorText").value = s.color;
    $("subtitleStrokeColor").value = s.strokeColor; $("subtitleStrokeColorText").value = s.strokeColor;
    setPairValues("subtitleStrokeWidth", "subtitleStrokeWidthNumber", s.strokeWidth);
    $("subtitleLetterSpacing").value = s.letterSpacing;
    $("subtitleLineHeight").value = s.lineHeight;
    $("subtitleItalic").checked = s.italic;
    $("subtitleAnchor").value = s.anchor;
    setPairValues("subtitleX", "subtitleXNumber", s.x);
    setPairValues("subtitleY", "subtitleYNumber", s.y);
    $("customFontName").textContent = s.customFontName || "미등록";
  }

  function syncFilm35UI() {
    const f = state.film35;
    $("film35Count").value = f.count;
    $("film35BreakEvery").value = f.breakEvery;
    $("film35SelectedCut").max = f.count;
    $("film35SelectedCut").value = f.selected + 1;
    $("film35EffectScope").value = f.effectScope;
    setPairValues("film35RowGap", "film35RowGapNumber", f.rowGap);
    setPairValues("film35RowOffset", "film35RowOffsetNumber", f.rowOffset);
    $("film35RandomOffset").checked = f.randomOffset;
    setPairValues("film35OffsetJitter", "film35OffsetJitterNumber", f.offsetJitter);
    $("film35TextEnabled").checked = f.textEnabled;
    $("film35EdgeText").value = f.edgeText;
    $("film35FitCanvas").checked = f.fitCanvas;
    $("film35CanvasPreset").value = f.canvasPreset;
    $("film35CanvasPresetWrap").hidden = f.fitCanvas;
    $("film35CustomCanvasWrap").hidden = f.fitCanvas || f.canvasPreset !== "custom";
    $("film35CanvasWidth").value = f.canvasWidth;
    $("film35CanvasHeight").value = f.canvasHeight;
    $("film35SizeMode").value = f.sizeMode;
    $("film35FrameWidthWrap").hidden = f.sizeMode !== "manual";
    setPairValues("film35FrameWidth", "film35FrameWidthNumber", f.frameWidth);
    $("film35FitPaddingWrap").hidden = !f.fitCanvas;
    setPairValues("film35FitPadding", "film35FitPaddingNumber", f.fitPadding);
    $("film35ShadowEnabled").checked = f.shadow.enabled;
    $("film35ShadowColor").value = f.shadow.color; $("film35ShadowColorText").value = f.shadow.color;
    setPairValues("film35ShadowOpacity", "film35ShadowOpacityNumber", Math.round(f.shadow.opacity * 100));
    setPairValues("film35ShadowBlur", "film35ShadowBlurNumber", f.shadow.blur);
    $("film35ShadowX").value = f.shadow.x; $("film35ShadowY").value = f.shadow.y;
    $("film35BackgroundType").value = f.background.type;
    $("film35BgColor1").value = f.background.color1; $("film35BgColor1Text").value = f.background.color1;
    $("film35BgColor2").value = f.background.color2; $("film35BgColor2Text").value = f.background.color2;
    setPairValues("film35GradientAngle", "film35GradientAngleNumber", f.background.gradientAngle);
    $("film35Pattern").value = f.background.pattern;
    setPairValues("film35PatternSize", "film35PatternSizeNumber", f.background.size);
    setPairValues("film35PatternRotation", "film35PatternRotationNumber", f.background.rotation);
    $("film35PatternRandomRotation").checked = f.background.randomRotation;
    setPairValues("film35PatternJitter", "film35PatternJitterNumber", f.background.jitter);
  }

  function syncModeUI() {
    $$(".mode-tab").forEach((button) => button.classList.toggle("is-active", button.dataset.mode === state.mode));
    $$(".mode-panel").forEach((panel) => panel.hidden = panel.dataset.panel !== state.mode);
    $("modeBadge").textContent = modeLabels[state.mode];
    $("previewStatus").textContent = `${modeLabels[state.mode]} · 실시간 미리보기`;
    $("[data-subtitle-panel]");
    document.querySelector("[data-subtitle-panel]").hidden = state.mode !== "movie";
    $$(".segment[data-orientation-target]").forEach((button) => {
      const target = button.dataset.orientationTarget;
      button.classList.toggle("is-active", state[target].orientation === button.dataset.value);
    });
    if (state.mode === "movie") syncMovieUI();
    if (state.mode === "film35") syncFilm35UI();
    $("viewfinderImageName").textContent = state.viewfinder.image.name || "프레임 안쪽을 클릭해도 사진을 추가할 수 있습니다.";
    setPairValues("viewfinderWidth", "viewfinderWidthNumber", state.viewfinder.width);
    $("viewfinderGrid").checked = state.viewfinder.grid;
    $("viewfinderRec").checked = state.viewfinder.rec;
    $("film120ImageName").textContent = state.film120.image.name || "프레임 안쪽을 클릭해도 사진을 추가할 수 있습니다.";
    setPairValues("film120Width", "film120WidthNumber", state.film120.width);
    $("film120FrameColor").value = state.film120.frameColor; $("film120FrameColorText").value = state.film120.frameColor;
    $("film120Number").value = state.film120.number;
    syncTransformUI();
    syncEffectsUI();
    updateCanvasHint();
  }

  function setupFilterMenu() {
    const menu = $("filterMenu");
    filterPresets.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-card";
      button.dataset.filter = preset.id;
      button.style.setProperty("--filter-bg", preset.bg);
      button.innerHTML = `<span>${preset.name}</span><small>${preset.desc}</small>`;
      button.addEventListener("click", () => {
        getActiveEffects().filter.id = preset.id;
        updateFilterPicker(preset.id);
        updateEffectSummary();
        menu.hidden = true;
        queueRender();
      });
      menu.appendChild(button);
    });
  }

  function bindControls() {
    $$(".mode-tab").forEach((button) => button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      syncModeUI();
      queueRender();
    }));

    $$(".segment[data-orientation-target]").forEach((button) => button.addEventListener("click", () => {
      state[button.dataset.orientationTarget].orientation = button.dataset.value;
      syncModeUI(); queueRender();
    }));

    $("movieUploadBtn").addEventListener("click", () => $("movieImageInput").click());
    $("viewfinderUploadBtn").addEventListener("click", () => $("viewfinderImageInput").click());
    $("film120UploadBtn").addEventListener("click", () => $("film120ImageInput").click());
    $("film35UploadCutBtn").addEventListener("click", () => openImageForCurrentMode(state.film35.selected));
    $("movieResetImageBtn").addEventListener("click", () => { resetImageTransform(state.movie.image); syncTransformUI(); queueRender(); });
    $("viewfinderResetImageBtn").addEventListener("click", () => { resetImageTransform(state.viewfinder.image); syncTransformUI(); queueRender(); });
    $("film120ResetImageBtn").addEventListener("click", () => { resetImageTransform(state.film120.image); syncTransformUI(); queueRender(); });

    $("movieImageInput").addEventListener("change", (event) => loadImageFile(event.target.files[0], state.movie.image, () => syncMovieUI()));
    $("viewfinderImageInput").addEventListener("change", (event) => loadImageFile(event.target.files[0], state.viewfinder.image, () => syncModeUI()));
    $("film120ImageInput").addEventListener("change", (event) => loadImageFile(event.target.files[0], state.film120.image, () => syncModeUI()));
    $("film35CutInput").addEventListener("change", (event) => loadImageFile(event.target.files[0], state.film35.cuts[filmInputTarget].image, () => {
      state.film35.selected = filmInputTarget; syncFilm35UI(); syncEffectsUI();
    }));

    bindValue("movieAspect", () => state.movie.aspect, (v) => state.movie.aspect = v, "change", syncMovieUI);
    bindValue("movieCustomAspect", () => state.movie.customAspect, (v) => state.movie.customAspect = clamp(v, .2, 6));
    bindValue("movieBarsEnabled", () => state.movie.barsEnabled, (v) => state.movie.barsEnabled = v, "change", syncMovieUI);
    bindValue("movieBarsMode", () => state.movie.barsMode, (v) => state.movie.barsMode = v, "change", syncMovieUI);
    bindValue("movieOverallRatio", () => state.movie.overallRatio, (v) => state.movie.overallRatio = v, "change", syncMovieUI);
    bindValue("movieCustomOverallRatio", () => state.movie.customOverallRatio, (v) => state.movie.customOverallRatio = clamp(v, .2, 6));
    bindRangePair("movieBaseWidth", "movieBaseWidthNumber", () => state.movie.baseWidth, (v) => state.movie.baseWidth = clamp(v, 640, 4096));
    bindValue("movieCanvasWidth", () => state.movie.canvasWidth, (v) => state.movie.canvasWidth = clamp(v, 320, 8192));
    bindValue("movieCanvasHeight", () => state.movie.canvasHeight, (v) => state.movie.canvasHeight = clamp(v, 320, 8192));
    bindValue("movieBarModeWidth", () => state.movie.barModeWidth, (v) => state.movie.barModeWidth = clamp(v, 320, 8192));
    bindValue("movieBarSize", () => state.movie.barSize, (v) => state.movie.barSize = clamp(v, 0, 2048));
    bindColor("movieBarColor", "movieBarColorText", () => state.movie.barColor, (v) => state.movie.barColor = v);

    bindRangePair("viewfinderWidth", "viewfinderWidthNumber", () => state.viewfinder.width, (v) => state.viewfinder.width = clamp(v, 640, 4096));
    bindValue("viewfinderGrid", () => state.viewfinder.grid, (v) => state.viewfinder.grid = v, "change");
    bindValue("viewfinderRec", () => state.viewfinder.rec, (v) => state.viewfinder.rec = v, "change");
    bindRangePair("film120Width", "film120WidthNumber", () => state.film120.width, (v) => state.film120.width = clamp(v, 640, 4096));
    bindColor("film120FrameColor", "film120FrameColorText", () => state.film120.frameColor, (v) => state.film120.frameColor = v);
    bindValue("film120Number", () => state.film120.number, (v) => state.film120.number = v);

    bindRangePair("imageZoom", "imageZoomNumber", () => getActiveImage()?.zoom * 100 || 100, (v) => { const image = getActiveImage(); if (image) image.zoom = clamp(v / 100, .5, 4); });
    bindRangePair("imageOffsetX", "imageOffsetXNumber", () => getActiveImage()?.x || 0, (v) => { const image = getActiveImage(); if (image) image.x = clamp(v, -100, 100); });
    bindRangePair("imageOffsetY", "imageOffsetYNumber", () => getActiveImage()?.y || 0, (v) => { const image = getActiveImage(); if (image) image.y = clamp(v, -100, 100); });
    bindRangePair("imageAngle", "imageAngleNumber", () => getActiveImage()?.angle || 0, (v) => { const image = getActiveImage(); if (image) image.angle = clamp(v, -45, 45); });
    $("rotateLeftBtn").addEventListener("click", () => { const image = getActiveImage(); if (image) { image.quarter = (image.quarter + 3) % 4; queueRender(); } });
    $("rotateRightBtn").addEventListener("click", () => { const image = getActiveImage(); if (image) { image.quarter = (image.quarter + 1) % 4; queueRender(); } });
    $("resetTransformBtn").addEventListener("click", () => { resetImageTransform(getActiveImage()); syncTransformUI(); queueRender(); });

    bindValue("subtitleEnabled", () => state.movie.subtitle.enabled, (v) => state.movie.subtitle.enabled = v, "change");
    bindValue("subtitleText", () => state.movie.subtitle.text, (v) => state.movie.subtitle.text = v);
    $("subtitleTemplate").addEventListener("change", () => {
      const id = $("subtitleTemplate").value;
      Object.assign(state.movie.subtitle, subtitleTemplates[id], { template: id });
      syncMovieUI(); queueRender();
    });
    bindValue("subtitleFont", () => state.movie.subtitle.font, (v) => state.movie.subtitle.font = v, "change");
    bindValue("subtitleAutoSize", () => state.movie.subtitle.autoSize, (v) => state.movie.subtitle.autoSize = v, "change");
    bindRangePair("subtitleSize", "subtitleSizeNumber", () => state.movie.subtitle.size, (v) => state.movie.subtitle.size = clamp(v, 12, 180));
    bindRangePair("subtitleWeight", "subtitleWeightNumber", () => state.movie.subtitle.weight, (v) => state.movie.subtitle.weight = clamp(v, 100, 900));
    bindColor("subtitleColor", "subtitleColorText", () => state.movie.subtitle.color, (v) => state.movie.subtitle.color = v);
    bindColor("subtitleStrokeColor", "subtitleStrokeColorText", () => state.movie.subtitle.strokeColor, (v) => state.movie.subtitle.strokeColor = v);
    bindRangePair("subtitleStrokeWidth", "subtitleStrokeWidthNumber", () => state.movie.subtitle.strokeWidth, (v) => state.movie.subtitle.strokeWidth = clamp(v, 0, 12));
    bindValue("subtitleLetterSpacing", () => state.movie.subtitle.letterSpacing, (v) => state.movie.subtitle.letterSpacing = clamp(v, -10, 30));
    bindValue("subtitleLineHeight", () => state.movie.subtitle.lineHeight, (v) => state.movie.subtitle.lineHeight = clamp(v, .7, 3));
    bindValue("subtitleItalic", () => state.movie.subtitle.italic, (v) => state.movie.subtitle.italic = v, "change");
    bindValue("subtitleAnchor", () => state.movie.subtitle.anchor, (v) => state.movie.subtitle.anchor = v, "change");
    bindRangePair("subtitleX", "subtitleXNumber", () => state.movie.subtitle.x, (v) => state.movie.subtitle.x = clamp(v, -100, 100));
    bindRangePair("subtitleY", "subtitleYNumber", () => state.movie.subtitle.y, (v) => state.movie.subtitle.y = clamp(v, -100, 100));
    $("customFontBtn").addEventListener("click", () => $("customFontInput").click());
    $("customFontInput").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const face = new FontFace("UserFont", buffer);
        await face.load();
        document.fonts.add(face);
        state.movie.subtitle.customFontLoaded = true;
        state.movie.subtitle.customFontName = file.name;
        state.movie.subtitle.font = "custom";
        syncMovieUI(); queueRender();
      } catch (error) {
        console.error(error); alert("폰트를 불러오지 못했습니다.");
      }
    });

    bindValue("film35Count", () => state.film35.count, (v) => { state.film35.count = clamp(Math.round(v), 1, 36); ensureCuts(); }, "input", () => { syncFilm35UI(); syncTransformUI(); syncEffectsUI(); });
    bindValue("film35BreakEvery", () => state.film35.breakEvery, (v) => state.film35.breakEvery = clamp(Math.round(v), 1, state.film35.count));
    bindValue("film35SelectedCut", () => state.film35.selected + 1, (v) => state.film35.selected = clamp(Math.round(v) - 1, 0, state.film35.count - 1), "input", () => { syncTransformUI(); syncEffectsUI(); });
    bindValue("film35EffectScope", () => state.film35.effectScope, (v) => state.film35.effectScope = v, "change", syncEffectsUI);
    $("film35ApplyEffectsAll").addEventListener("click", () => {
      const source = getActiveEffects();
      state.film35.globalEffects = cloneEffects(source);
      state.film35.cuts.forEach((cut) => cut.effects = cloneEffects(source));
      syncEffectsUI(); queueRender();
    });
    bindRangePair("film35RowGap", "film35RowGapNumber", () => state.film35.rowGap, (v) => state.film35.rowGap = clamp(v, 0, 800));
    bindRangePair("film35RowOffset", "film35RowOffsetNumber", () => state.film35.rowOffset, (v) => state.film35.rowOffset = clamp(v, -800, 800));
    bindValue("film35RandomOffset", () => state.film35.randomOffset, (v) => state.film35.randomOffset = v, "change");
    bindRangePair("film35OffsetJitter", "film35OffsetJitterNumber", () => state.film35.offsetJitter, (v) => state.film35.offsetJitter = clamp(v, 0, 800));
    $("film35ShuffleOffset").addEventListener("click", () => { state.film35.offsetSeed = uidSeed(); queueRender(); });
    bindValue("film35TextEnabled", () => state.film35.textEnabled, (v) => state.film35.textEnabled = v, "change");
    bindValue("film35EdgeText", () => state.film35.edgeText, (v) => state.film35.edgeText = v);
    bindValue("film35FitCanvas", () => state.film35.fitCanvas, (v) => state.film35.fitCanvas = v, "change", syncFilm35UI);
    $("film35CanvasPreset").addEventListener("change", () => {
      const value = $("film35CanvasPreset").value;
      state.film35.canvasPreset = value;
      if (value !== "custom") {
        const [w, h] = value.split("x").map(Number);
        state.film35.canvasWidth = w; state.film35.canvasHeight = h;
      }
      syncFilm35UI(); queueRender();
    });
    bindValue("film35CanvasWidth", () => state.film35.canvasWidth, (v) => state.film35.canvasWidth = clamp(v, 320, 12000));
    bindValue("film35CanvasHeight", () => state.film35.canvasHeight, (v) => state.film35.canvasHeight = clamp(v, 320, 12000));
    bindValue("film35SizeMode", () => state.film35.sizeMode, (v) => state.film35.sizeMode = v, "change", syncFilm35UI);
    bindRangePair("film35FrameWidth", "film35FrameWidthNumber", () => state.film35.frameWidth, (v) => state.film35.frameWidth = clamp(v, 120, 1600));
    bindRangePair("film35FitPadding", "film35FitPaddingNumber", () => state.film35.fitPadding, (v) => state.film35.fitPadding = clamp(v, 0, 1600));
    bindValue("film35ShadowEnabled", () => state.film35.shadow.enabled, (v) => state.film35.shadow.enabled = v, "change");
    bindColor("film35ShadowColor", "film35ShadowColorText", () => state.film35.shadow.color, (v) => state.film35.shadow.color = v);
    bindRangePair("film35ShadowOpacity", "film35ShadowOpacityNumber", () => state.film35.shadow.opacity * 100, (v) => state.film35.shadow.opacity = clamp(v / 100, 0, 1));
    bindRangePair("film35ShadowBlur", "film35ShadowBlurNumber", () => state.film35.shadow.blur, (v) => state.film35.shadow.blur = clamp(v, 0, 160));
    bindValue("film35ShadowX", () => state.film35.shadow.x, (v) => state.film35.shadow.x = clamp(v, -500, 500));
    bindValue("film35ShadowY", () => state.film35.shadow.y, (v) => state.film35.shadow.y = clamp(v, -500, 500));
    bindValue("film35BackgroundType", () => state.film35.background.type, (v) => state.film35.background.type = v, "change");
    bindColor("film35BgColor1", "film35BgColor1Text", () => state.film35.background.color1, (v) => state.film35.background.color1 = v);
    bindColor("film35BgColor2", "film35BgColor2Text", () => state.film35.background.color2, (v) => state.film35.background.color2 = v);
    bindRangePair("film35GradientAngle", "film35GradientAngleNumber", () => state.film35.background.gradientAngle, (v) => state.film35.background.gradientAngle = clamp(v, 0, 360));
    bindValue("film35Pattern", () => state.film35.background.pattern, (v) => state.film35.background.pattern = v, "change");
    bindRangePair("film35PatternSize", "film35PatternSizeNumber", () => state.film35.background.size, (v) => state.film35.background.size = clamp(v, 8, 240));
    bindRangePair("film35PatternRotation", "film35PatternRotationNumber", () => state.film35.background.rotation, (v) => state.film35.background.rotation = clamp(v, 0, 360));
    bindValue("film35PatternRandomRotation", () => state.film35.background.randomRotation, (v) => state.film35.background.randomRotation = v, "change");
    bindRangePair("film35PatternJitter", "film35PatternJitterNumber", () => state.film35.background.jitter, (v) => state.film35.background.jitter = clamp(v, 0, 180));
    $("film35ShufflePattern").addEventListener("click", () => { state.film35.background.seed = uidSeed(); queueRender(); });

    bindValue("grainEnabled", () => getActiveEffects().grain.enabled, (v) => getActiveEffects().grain.enabled = v, "change", updateEffectSummary);
    bindRangePair("grainAmount", "grainAmountNumber", () => getActiveEffects().grain.amount * 100, (v) => getActiveEffects().grain.amount = clamp(v / 100, 0, 1), { after: updateEffectSummary });
    bindRangePair("grainSize", "grainSizeNumber", () => getActiveEffects().grain.size * 100, (v) => getActiveEffects().grain.size = clamp(v / 100, .01, 1));
    bindRangePair("grainRoughness", "grainRoughnessNumber", () => getActiveEffects().grain.roughness * 100, (v) => getActiveEffects().grain.roughness = clamp(v / 100, 0, 1));
    bindValue("grainColor", () => getActiveEffects().grain.color, (v) => getActiveEffects().grain.color = v, "change");
    $("grainReseed").addEventListener("click", () => { getActiveEffects().grain.seed = uidSeed(); grainCache.clear(); queueRender(); });

    bindValue("overlayEnabled", () => getActiveEffects().overlay.enabled, (v) => getActiveEffects().overlay.enabled = v, "change", updateEffectSummary);
    bindValue("overlayType", () => getActiveEffects().overlay.type, (v) => getActiveEffects().overlay.type = v, "change");
    bindValue("overlayBlend", () => getActiveEffects().overlay.blend, (v) => getActiveEffects().overlay.blend = v, "change");
    bindRangePair("overlayOpacity", "overlayOpacityNumber", () => getActiveEffects().overlay.opacity * 100, (v) => getActiveEffects().overlay.opacity = clamp(v / 100, 0, 1));
    bindValue("overlayIncludeFrame", () => getActiveEffects().overlay.includeFrame, (v) => getActiveEffects().overlay.includeFrame = v, "change");
    $("overlayReseed").addEventListener("click", () => { getActiveEffects().overlay.seed = uidSeed(); queueRender(); });
    $("overlayUploadBtn").addEventListener("click", () => $("overlayImageInput").click());
    $("overlayImageInput").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const overlay = getActiveEffects().overlay;
      const holder = { img: null };
      loadImageFile(file, holder, () => {
        overlay.customImage = holder.img;
        overlay.customName = file.name;
        overlay.type = "custom";
        overlay.enabled = true;
        syncEffectsUI(); queueRender();
      });
    });

    bindValue("lightLeakEnabled", () => getActiveEffects().lightLeak.enabled, (v) => getActiveEffects().lightLeak.enabled = v, "change", updateEffectSummary);
    bindValue("lightLeakType", () => getActiveEffects().lightLeak.type, (v) => getActiveEffects().lightLeak.type = v, "change");
    bindColor("lightLeakColor", "lightLeakColorText", () => getActiveEffects().lightLeak.color, (v) => getActiveEffects().lightLeak.color = v);
    bindRangePair("lightLeakIntensity", "lightLeakIntensityNumber", () => getActiveEffects().lightLeak.intensity * 100, (v) => getActiveEffects().lightLeak.intensity = clamp(v / 100, 0, 1));
    bindRangePair("lightLeakSpread", "lightLeakSpreadNumber", () => getActiveEffects().lightLeak.spread * 100, (v) => getActiveEffects().lightLeak.spread = clamp(v / 100, .05, 1));
    $("lightLeakRandomize").addEventListener("click", () => {
      const leak = getActiveEffects().lightLeak;
      const random = mulberry32(uidSeed());
      leak.seed = uidSeed(); leak.type = "random"; leak.enabled = true;
      leak.intensity = 0.28 + random() * 0.62; leak.spread = 0.25 + random() * 0.72;
      const palette = ["#ff8a38", "#ffb040", "#f04d3d", "#f080aa", "#68a9ff"];
      leak.color = palette[Math.floor(random() * palette.length)];
      syncEffectsUI(); queueRender();
    });

    bindRangePair("filterStrength", "filterStrengthNumber", () => getActiveEffects().filter.strength * 100, (v) => getActiveEffects().filter.strength = clamp(v / 100, 0, 1));
    $("filterPickerButton").addEventListener("click", () => $("filterMenu").hidden = !$("filterMenu").hidden);

    $("previewFitBtn").addEventListener("click", () => canvas.scrollIntoView({ behavior: "smooth", block: "center" }));
    $("exportFormat").addEventListener("change", () => $("exportPngBackground").disabled = $("exportFormat").value !== "png");
    $("exportButton").addEventListener("click", exportImage);
  }

  function cloneEffects(source) {
    const result = makeEffects();
    result.filter = { ...source.filter };
    result.lightLeak = { ...source.lightLeak };
    result.overlay = { ...source.overlay, customImage: source.overlay.customImage };
    result.grain = { ...source.grain };
    return result;
  }

  async function exportImage() {
    if (state.isExporting) return;
    state.isExporting = true;
    const button = $("exportButton");
    const note = $("exportNote");
    button.disabled = true;
    button.textContent = "렌더링 중…";
    note.textContent = "고해상도 이미지를 만들고 있습니다.";
    try {
      await document.fonts.ready;
      const layout = getLayout();
      let scale = Number($("exportScale").value || 1);
      const maxDimension = 16384;
      if (Math.max(layout.width * scale, layout.height * scale) > maxDimension) {
        scale = maxDimension / Math.max(layout.width, layout.height);
        note.textContent = `브라우저 한계에 맞춰 ${Math.round(scale * 100)}%로 조정했습니다.`;
      }
      const output = document.createElement("canvas");
      renderInto(output, layout, scale, true);
      const format = $("exportFormat").value;
      let finalCanvas = output;
      if (format === "jpg" || $("exportPngBackground").value === "white") {
        finalCanvas = document.createElement("canvas");
        finalCanvas.width = output.width; finalCanvas.height = output.height;
        const finalCtx = finalCanvas.getContext("2d");
        finalCtx.fillStyle = "#ffffff"; finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        finalCtx.drawImage(output, 0, 0);
      }
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const quality = format === "jpg" ? 0.94 : undefined;
      const blob = await new Promise((resolve) => finalCanvas.toBlob(resolve, mime, quality));
      if (!blob) throw new Error("toBlob failed");
      const rawName = $("exportFilename").value.trim();
      const fallback = `film-frame-${state.mode}-${new Date().toISOString().slice(0, 10)}`;
      const safeName = (rawName || fallback).replace(/[\\/:*?"<>|]+/g, "-").replace(/\.(png|jpe?g)$/i, "");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${safeName}.${format}`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      note.textContent = `${finalCanvas.width} × ${finalCanvas.height}px 저장을 시작했습니다.`;
    } catch (error) {
      console.error(error);
      note.textContent = "저장 중 오류가 발생했습니다. 출력 크기를 낮춰 다시 시도해 주세요.";
    } finally {
      state.isExporting = false;
      button.disabled = false;
      button.textContent = "이미지 저장";
      queueRender();
    }
  }

  setupFilterMenu();
  bindControls();
  $$("input[type=range]").forEach(updateRangeVisual);
  syncModeUI();
  document.fonts.ready.then(queueRender);
  queueRender();
})();
