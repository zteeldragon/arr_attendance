// Minimal face comparison placeholder using face-api.js if available
let modelsLoaded = false;
export async function initFaceAPI(){
  if (modelsLoaded) return;
  // Load required models from CDN via global 'faceapi'
  if (typeof faceapi === 'undefined') {
    console.warn('faceapi library not loaded');
    modelsLoaded = true; // avoid repeated attempts
    return;
  }
  const modelUrl = '/models'; // Assume models are served under /models
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl)
  ]);
  modelsLoaded = true;
}

export async function compareFaces(imageBlob, employeeId){
  const portraits = [`${employeeId}_front.jpg`, `${employeeId}_left.jpg`, `${employeeId}_right.jpg`];

  // Step 1: Validate that at least one portrait file actually exists
  let hasValidPortrait = false;
  for (const portraitName of portraits) {
    const exists = await new Promise((resolve) => {
      const testImg = new Image();
      testImg.onload = () => resolve(true);
      testImg.onerror = () => resolve(false);
      testImg.src = `assets/images/${portraitName}?${Date.now()}`;
    });
    if (exists) {
      hasValidPortrait = true;
      break;
    }
  }

  console.log(`compareFaces: employeeId=${employeeId}, hasValidPortrait=${hasValidPortrait}`);

  // If no portraits loaded, face not recognized
  if (!hasValidPortrait) {
    console.warn('No valid portrait images found — face not recognized');
    return false;
  }

  // Step 2: Compare captured image against each existing portrait
  let bestScore = -1;
  const threshold = 0.85;

  for (const portraitName of portraits) {
    try {
      const score = await compareImageWithPortrait(imageBlob, `assets/images/${portraitName}`);
      console.log(`Portrait ${portraitName}: correlation = ${(score * 100).toFixed(1)}%`);
      if (score > bestScore) bestScore = score;
    } catch (err) {
      console.warn(`Failed to compare portrait ${portraitName}:`, err.message);
    }
  }

  // If no successful comparisons, face not recognized
  if (bestScore < 0) {
    console.warn('No valid comparison scores — face not recognized');
    return false;
  }

  const match = bestScore >= threshold;
  console.log(`Best correlation: ${(bestScore * 100).toFixed(1)}%, threshold: ${(threshold * 100).toFixed(1)}% -> ${match ? 'MATCH' : 'NO MATCH'}`);
  return match;
}

async function compareImageWithPortrait(imageBlob, portraitUrl){
  const img1 = await loadImageFromBlob(imageBlob);
  const img2 = await loadExternalImage(portraitUrl);

  if (!img1 || !img1.naturalWidth || !img1.naturalHeight) {
    throw new Error('Captured image is invalid');
  }
  if (!img2 || !img2.naturalWidth || !img2.naturalHeight) {
    throw new Error('Portrait image is invalid');
  }

  const size = 150;
  const c1 = document.createElement('canvas');
  const c2 = document.createElement('canvas');
  c1.width = c2.width = size;
  c1.height = c2.height = size;

  const ctx1 = c1.getContext('2d');
  const ctx2 = c2.getContext('2d');
  ctx1.drawImage(img1, 0, 0, size, size);
  ctx2.drawImage(img2, 0, 0, size, size);

  const d1 = ctx1.getImageData(0, 0, size, size).data;
  const d2 = ctx2.getImageData(0, 0, size, size).data;
  const n = size * size; // number of pixels

  // --- Metric 1: Centered NCC (brightness-invariant structural similarity) ---
  const m1 = new Float32Array(n);
  const m2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    m1[i] = (d1[i * 4] + d1[i * 4 + 1] + d1[i * 4 + 2]) / 3;
    m2[i] = (d2[i * 4] + d2[i * 4 + 1] + d2[i * 4 + 2]) / 3;
  }

  const mean1 = m1.reduce((a, v) => a + v, 0) / n;
  const mean2 = m2.reduce((a, v) => a + v, 0) / n;

  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const a = m1[i] - mean1;
    const b = m2[i] - mean2;
    num += a * b;
    den1 += a * a;
    den2 += b * b;
  }

  const ncc = (den1 > 0 && den2 > 0) ? num / (Math.sqrt(den1) * Math.sqrt(den2)) : 0;
  const corr = Math.max(0, (ncc + 1) / 2); // map [-1,1] -> [0,1]

  // --- Metric 2: Gradient structural match (Sobel edge comparison) ---
  function gradientVec(data) {
    const g = new Float32Array(n);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const px = Math.min(x + 1, size - 1);
        const py = Math.min(y + 1, size - 1);
        const nx = Math.max(x - 1, 0);
        const ny = Math.max(y - 1, 0);
        const gx = (data[py * size + px] - data[ny * size + nx]) / 2;
        const gy = (data[y * size + px] - data[y * size + nx]) / 2;
        g[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return g;
  }

  const gray1 = new Float32Array(n);
  const gray2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gray1[i] = (d1[i * 4] + d1[i * 4 + 1] + d1[i * 4 + 2]) / 3;
    gray2[i] = (d2[i * 4] + d2[i * 4 + 1] + d2[i * 4 + 2]) / 3;
  }

  const grad1 = gradientVec(gray1);
  const grad2 = gradientVec(gray2);

  let gNum = 0, gDen1 = 0, gDen2 = 0;
  for (let i = 0; i < n; i++) {
    gNum += grad1[i] * grad2[i];
    gDen1 += grad1[i] * grad1[i];
    gDen2 += grad2[i] * grad2[i];
  }

  const gDen = Math.sqrt(gDen1) * Math.sqrt(gDen2);
  const gradientMatch = (gDen > 0) ? gNum / gDen : 0; // [0,1]

  // --- Metric 3: MSE sanity check (penalizes large absolute differences) ---
  let mse = 0;
  for (let i = 0; i < n; i++) {
    const diff = m1[i] - m2[i];
    mse += diff * diff;
  }
  mse /= n;
  const mseNorm = Math.min(mse / 10000, 1); // normalize to [0,1]
  const mseScore = 1 - mseNorm;

  // --- Combined score ---
  const combined = corr * 0.5 + gradientMatch * 0.3 + mseScore * 0.2;
  return Math.max(0, Math.min(1, combined));
}

function loadImageFromBlob(blob){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image from blob'));
    img.src = URL.createObjectURL(blob);
  });
}

function loadExternalImage(url){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load external image'));
    img.src = url;
  });
}

export async function detectFace(imageBlob){
  if (typeof faceapi === 'undefined') {
    throw new Error('face-api.js not loaded');
  }
  const image = await loadImageFromBlob(imageBlob);
  const detection = await faceapi.detectSingleFace(image).withFaceLandmarks();
  if (!detection) {
    throw new Error('No face detected in the image');
  }
  return detection;
}
