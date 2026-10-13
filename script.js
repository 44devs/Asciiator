const fileInput = document.getElementById('file');
const dropArea = document.getElementById('drop');
const mediaPane = document.getElementById('mediaPane');
const textPane = document.getElementById('textPane');
const tabs = document.querySelectorAll('.tab');
const textInput = document.getElementById('textInput');
const fontInput = document.getElementById('fontInput');
const colsInput = document.getElementById('cols');
const colsVal = document.getElementById('colsVal');
const rowsInput = document.getElementById('rows');
const rowsVal = document.getElementById('rowsVal');
const charsetSelect = document.getElementById('charset');
const customWrap = document.getElementById('customWrap');
const charsCustom = document.getElementById('charsCustom');
const brightInput = document.getElementById('bright');
const contrastInput = document.getElementById('contrast');
const fpsInput = document.getElementById('fps');
const fpsVal = document.getElementById('fpsVal');
const durInput = document.getElementById('dur');
const durVal = document.getElementById('durVal');
const invertCheck = document.getElementById('invert');
const colorCheck = document.getElementById('color');
const animateCheck = document.getElementById('animate');
const outPre = document.getElementById('out');
const copyBtn = document.getElementById('copyBtn');
const txtBtn = document.getElementById('txtBtn');
const htmlBtn = document.getElementById('htmlBtn');
const pngBtn = document.getElementById('pngBtn');
const gifBtn = document.getElementById('gifBtn');
const webmBtn = document.getElementById('webmBtn');
const statusSpan = document.getElementById('status');

let currentMedia = null;
let mediaType = null;
let animationId = null;
let gifInterval = null;
let isPlaying = false;
let currentAscii = '';
let currentHtml = '';
let exporting = false;
let gifWorkerUrl = null;

const samplingCanvas = document.createElement('canvas');
const samplingCtx = samplingCanvas.getContext('2d', { willReadFrequently: true });

const charsets = {
  classic: ' .:-=+*#%@',
  soft: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
  dots: ' ⠁⠃⠇⡇⣇⣧⣷⣿',
  binary: ' 01',
  minimal: ' .-+*#@'
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function getCharset() {
  const val = charsetSelect.value;
  if (val === 'custom') return charsCustom.value || ' .:-=+*#%@';
  return charsets[val] || charsets.classic;
}

function computeRows(cols) {
  const r = parseInt(rowsInput.value);
  if (r > 0) return r;
  let aspect = 1;
  if (currentMedia) {
    if (currentMedia.videoWidth) aspect = currentMedia.videoHeight / currentMedia.videoWidth;
    else if (currentMedia.naturalWidth) aspect = currentMedia.naturalHeight / currentMedia.naturalWidth;
    else if (currentMedia.width) aspect = currentMedia.height / currentMedia.width;
  }
  return Math.max(1, Math.round(cols * aspect * 0.5));
}

function updateLabels() {
  colsVal.textContent = colsInput.value;
  const rv = rowsInput.value;
  rowsVal.textContent = rv === '0' ? 'auto' : rv;
  fpsVal.textContent = fpsInput.value;
  durVal.textContent = durInput.value;
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (gifInterval) {
    clearInterval(gifInterval);
    gifInterval = null;
  }
  isPlaying = false;
}

function startAnimation() {
  stopAnimation();
  if (!currentMedia || !animateCheck.checked) return;
  const fps = parseInt(fpsInput.value) || 15;
  const interval = 1000 / fps;
  isPlaying = true;

  if (mediaType === 'video') {
    let last = 0;
    function loop(now) {
      if (!isPlaying) return;
      if (now - last >= interval) {
        last = now;
        sampleAndConvert();
      }
      animationId = requestAnimationFrame(loop);
    }
    animationId = requestAnimationFrame(loop);
  } else if (mediaType === 'gif') {
    gifInterval = setInterval(sampleAndConvert, interval);
  }
}

function drawMediaToSampling(cols, rows) {
  samplingCanvas.width = cols;
  samplingCanvas.height = rows;
  samplingCtx.drawImage(currentMedia, 0, 0, cols, rows);
}

function sampleAndConvert() {
  if (!currentMedia && textPane.hidden === false) {
    buildTextCanvas();
  }
  if (!currentMedia) return;

  const cols = parseInt(colsInput.value) || 100;
  const rows = computeRows(cols);

  drawMediaToSampling(cols, rows);

  const data = samplingCtx.getImageData(0, 0, cols, rows).data;
  const charset = getCharset();
  const invert = invertCheck.checked;
  const useColor = colorCheck.checked;
  const brightness = parseInt(brightInput.value) || 0;
  const contrast = parseFloat(contrastInput.value) || 1;

  let ascii = '';
  let html = '';

  for (let y = 0; y < rows; y++) {
    let rowA = '';
    let rowH = '';
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum = (lum - 128) * contrast + 128 + brightness;
      lum = Math.max(0, Math.min(255, lum));
      let ci = Math.floor((lum / 255) * (charset.length - 1));
      if (invert) ci = charset.length - 1 - ci;
      const ch = charset[ci] || ' ';
      rowA += ch;
      if (useColor) {
        rowH += `<span style="color:rgb(${r},${g},${b})">${ch === ' ' ? '&nbsp;' : ch}</span>`;
      } else {
        rowH += ch === ' ' ? '&nbsp;' : ch;
      }
    }
    ascii += rowA + '\n';
    html += rowH + '<br>';
  }

  currentAscii = ascii;
  currentHtml = html;

  if (useColor) outPre.innerHTML = html;
  else outPre.textContent = ascii;
}

function buildTextCanvas() {
  const text = textInput.value || ' ';
  const font = fontInput.value || 'bold 110px sans-serif';
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const m = measure.measureText(text);
  const w = Math.max(40, Math.ceil(m.width) + 40);
  const h = 200;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, h / 2);
  currentMedia = c;
  mediaType = 'text';
}

function buildAsciiCanvas() {
  const cols = parseInt(colsInput.value) || 100;
  const rows = computeRows(cols);
  const fontSize = 14;
  const font = `${fontSize}px monospace`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const charW = measure.measureText('M').width;
  const charH = fontSize;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(cols * charW));
  canvas.height = Math.max(1, Math.ceil(rows * charH));
  return { canvas, cols, rows, font, charW, charH };
}

function drawAsciiFrame(canvas, cols, rows, font, charW, charH) {
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawMediaToSampling(cols, rows);
  const data = samplingCtx.getImageData(0, 0, cols, rows).data;

  const charset = getCharset();
  const invert = invertCheck.checked;
  const useColor = colorCheck.checked;
  const brightness = parseInt(brightInput.value) || 0;
  const contrast = parseFloat(contrastInput.value) || 1;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum = (lum - 128) * contrast + 128 + brightness;
      lum = Math.max(0, Math.min(255, lum));
      let ci = Math.floor((lum / 255) * (charset.length - 1));
      if (invert) ci = charset.length - 1 - ci;
      const ch = charset[ci] || ' ';
      ctx.fillStyle = useColor ? `rgb(${r},${g},${b})` : '#eee';
      ctx.fillText(ch, x * charW, y * charH);
    }
  }
}

async function ensureGifLib() {
  if (typeof GIF === 'undefined') {
    statusSpan.textContent = 'Loading gif.js...';
    await loadScript('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js');
  }
  if (!gifWorkerUrl) {
    const res = await fetch('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');
    const blob = await res.blob();
    gifWorkerUrl = URL.createObjectURL(blob);
  }
}

function pickVideoMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4'
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

async function exportGif() {
  if (exporting) return;
  if (!currentMedia) { statusSpan.textContent = 'Nothing to export'; return; }
  exporting = true;
  gifBtn.disabled = true;
  const wasPlaying = isPlaying;
  stopAnimation();
  try {
    await ensureGifLib();
    const { canvas, cols, rows, font, charW, charH } = buildAsciiCanvas();
    const fps = parseInt(fpsInput.value) || 15;
    const duration = parseFloat(durInput.value) || 2;
    const delay = Math.round(1000 / fps);
    const totalFrames = Math.max(1, Math.round(fps * duration));

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: canvas.width,
      height: canvas.height,
      workerScript: gifWorkerUrl,
      background: '#0a0a0a'
    });

    if (mediaType === 'video' && currentMedia.play) currentMedia.play();

    for (let f = 0; f < totalFrames; f++) {
      drawAsciiFrame(canvas, cols, rows, font, charW, charH);
      const frame = document.createElement('canvas');
      frame.width = canvas.width;
      frame.height = canvas.height;
      frame.getContext('2d').drawImage(canvas, 0, 0);
      gif.addFrame(frame, { delay, copy: true });
      statusSpan.textContent = `GIF frame ${f + 1}/${totalFrames}`;
      await sleep(delay);
    }

    statusSpan.textContent = 'Encoding GIF...';
    await new Promise(resolve => {
      gif.on('finished', blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'asciiator.gif';
        a.click();
        URL.revokeObjectURL(url);
        statusSpan.textContent = 'GIF saved';
        resolve();
      });
      gif.render();
    });
  } catch (err) {
    statusSpan.textContent = 'GIF export failed';
  } finally {
    exporting = false;
    gifBtn.disabled = false;
    if (wasPlaying && animateCheck.checked && mediaType !== 'text') startAnimation();
  }
}

async function exportVideo() {
  if (exporting) return;
  if (!currentMedia) { statusSpan.textContent = 'Nothing to export'; return; }
  const mime = pickVideoMime();
  if (!mime) { statusSpan.textContent = 'MediaRecorder not supported'; return; }
  exporting = true;
  webmBtn.disabled = true;
  const wasPlaying = isPlaying;
  stopAnimation();
  try {
    const { canvas, cols, rows, font, charW, charH } = buildAsciiCanvas();
    const fps = parseInt(fpsInput.value) || 15;
    const duration = parseFloat(durInput.value) || 2;

    if (mediaType === 'video' && currentMedia.play) currentMedia.play();

    const stream = canvas.captureStream(fps);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { recorder.onstop = res; });

    recorder.start();
    const delay = 1000 / fps;
    const totalFrames = Math.max(1, Math.round(fps * duration));

    for (let f = 0; f < totalFrames; f++) {
      drawAsciiFrame(canvas, cols, rows, font, charW, charH);
      statusSpan.textContent = `Recording ${f + 1}/${totalFrames}`;
      await sleep(delay);
    }

    recorder.stop();
    await stopped;

    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asciiator.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    statusSpan.textContent = `Saved ${ext}`;
  } catch (err) {
    statusSpan.textContent = 'Video export failed';
  } finally {
    exporting = false;
    webmBtn.disabled = false;
    if (wasPlaying && animateCheck.checked && mediaType !== 'text') startAnimation();
  }
}

function handleFile(file) {
  stopAnimation();
  if (!file) return;
  const url = URL.createObjectURL(file);
  const type = file.type;

  if (type.startsWith('video/')) {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.onloadeddata = () => {
      video.play();
      currentMedia = video;
      mediaType = 'video';
      sampleAndConvert();
      startAnimation();
    };
    video.onerror = () => { statusSpan.textContent = 'Error loading video'; };
  } else if (type.startsWith('image/')) {
    const img = new Image();
    img.src = url;
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      currentMedia = img;
      mediaType = type === 'image/gif' ? 'gif' : 'image';
      sampleAndConvert();
      startAnimation();
    };
    img.onerror = () => { statusSpan.textContent = 'Error loading image'; };
  } else {
    statusSpan.textContent = 'Unsupported file';
  }
}

function setMode(mode) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  if (mode === 'media') {
    mediaPane.hidden = false;
    textPane.hidden = true;
    if (currentMedia && mediaType !== 'text') {
      sampleAndConvert();
      startAnimation();
    }
  } else {
    mediaPane.hidden = true;
    textPane.hidden = false;
    stopAnimation();
    if (textInput.value.trim()) {
      currentMedia = null;
      buildTextCanvas();
      sampleAndConvert();
    }
  }
}

function updateFromControls() {
  updateLabels();
  if (currentMedia || textPane.hidden === false) {
    if (textPane.hidden === false) buildTextCanvas();
    sampleAndConvert();
    if (animateCheck.checked && mediaType !== 'text' && currentMedia) startAnimation();
    else stopAnimation();
  }
}

function copyOutput() {
  navigator.clipboard.writeText(currentAscii).then(() => {
    statusSpan.textContent = 'Copied';
    setTimeout(() => statusSpan.textContent = '', 1200);
  }).catch(() => { statusSpan.textContent = 'Copy failed'; });
}

function downloadTxt() {
  const blob = new Blob([currentAscii], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'asciiator.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadHtml() {
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Asciiator</title><style>body{background:#111;color:#eee;font-family:monospace;white-space:pre;padding:1rem;}</style></head><body>${currentHtml}</body></html>`;
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'asciiator.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadPng() {
  if (!currentMedia) return;
  const { canvas, cols, rows, font, charW, charH } = buildAsciiCanvas();
  drawAsciiFrame(canvas, cols, rows, font, charW, charH);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'asciiator.png';
  a.click();
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

fileInput.addEventListener('change', e => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

dropArea.addEventListener('dragover', e => {
  e.preventDefault();
  dropArea.classList.add('hover');
});

dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('hover');
});

dropArea.addEventListener('drop', e => {
  e.preventDefault();
  dropArea.classList.remove('hover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

colsInput.addEventListener('input', updateFromControls);
rowsInput.addEventListener('input', updateFromControls);
charsetSelect.addEventListener('change', () => {
  customWrap.hidden = charsetSelect.value !== 'custom';
  updateFromControls();
});
charsCustom.addEventListener('input', updateFromControls);
brightInput.addEventListener('input', updateFromControls);
contrastInput.addEventListener('input', updateFromControls);
fpsInput.addEventListener('input', () => {
  updateLabels();
  if (isPlaying) startAnimation();
});
durInput.addEventListener('input', updateLabels);
invertCheck.addEventListener('change', updateFromControls);
colorCheck.addEventListener('change', updateFromControls);
animateCheck.addEventListener('change', () => {
  if (animateCheck.checked && mediaType !== 'text' && currentMedia) startAnimation();
  else stopAnimation();
});
textInput.addEventListener('input', () => {
  if (textPane.hidden === false) {
    buildTextCanvas();
    sampleAndConvert();
  }
});
fontInput.addEventListener('input', () => {
  if (textPane.hidden === false) {
    buildTextCanvas();
    sampleAndConvert();
  }
});

copyBtn.addEventListener('click', copyOutput);
txtBtn.addEventListener('click', downloadTxt);
htmlBtn.addEventListener('click', downloadHtml);
pngBtn.addEventListener('click', downloadPng);
gifBtn.addEventListener('click', exportGif);
webmBtn.addEventListener('click', exportVideo);

updateLabels();
outPre.textContent = 'ready';
