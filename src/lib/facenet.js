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

  console.log(`compareFaces: employeeId=${employeeId}, portraits=${portraits.join(',')}`);

  // Try to compare against each portrait; skip ones that fail to load
  let bestScore = -1;
  const threshold = 0.85;
  let triedCount = 0;

  for (const portraitName of portraits) {
    const url = `assets/images/${portraitName}`;
    try {
      const score = await compareImageWithPortrait(imageBlob, url);
      triedCount++;
      console.log(`Portrait ${portraitName}: score=${score.toFixed(3)}`);
      if (score > bestScore) bestScore = score;
    } catch (err) {
      console.warn(`Failed to compare portrait ${portraitName}:`, err.message);
    }
  }

  console.log(`compareFaces: tried=${triedCount}, bestScore=${bestScore.toFixed(3)}, threshold=${threshold}`);

  if (triedCount === 0) {
    console.error('compareFaces: NO portraits could be loaded at all');
    return false;
  }

  const match = bestScore >= threshold;
  console.log(`compareFaces result: ${match ? 'MATCH' : 'NO MATCH'} (${bestScore.toFixed(3)} vs ${threshold})`);
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
  const n = size * size;

  // Grayscale both images
  const m1 = new Float32Array(n);
  const m2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    m1[i] = (d1[i*4] + d1[i*4+1] + d1[i*4+2]) / 3;
    m2[i] = (d2[i*4] + d2[i*4+1] + d2[i*4+2]) / 3;
  }

  // Metric 1: Centered NCC
  const mean1 = m1.reduce((a, v) => a + v, 0) / n;
  const mean2 = m2.reduce((a, v) => a + v, 0) / n;
  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const a = m1[i] - mean1, b = m2[i] - mean2;
    num += a * b; den1 += a * a; den2 += b * b;
  }
  const ncc = (den1 > 0 && den2 > 0) ? num / (Math.sqrt(den1) * Math.sqrt(den2)) : 0;
  const corr = Math.max(0, (ncc + 1) / 2);

  // Metric 2: Gradient structural match
  function gradientMag(gray) {
    const g = new Float32Array(n);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const gx = ((x < size-1) ? gray[idx+1] : gray[idx]) - ((x > 0) ? gray[idx-1] : gray[idx]);
        const gy = ((y < size-1) ? gray[(y+1)*size+x] : gray[idx]) - ((y > 0) ? gray[(y-1)*size+x] : gray[idx]);
        g[idx] = Math.sqrt(gx*gx + gy*gy);
      }
    }
    return g;
  }

  const grad1 = gradientMag(m1);
  const grad2 = gradientMag(m2);
  let gNum = 0, gDen1 = 0, gDen2 = 0;
  for (let i = 0; i < n; i++) {
    gNum += grad1[i]*grad2[i]; gDen1 += grad1[i]*grad1[i]; gDen2 += grad2[i]*grad2[i];
  }
  const gDen = Math.sqrt(gDen1) * Math.sqrt(gDen2);
  const gradientMatch = (gDen > 0) ? gNum / gDen : 0;

  // Metric 3: MSE-based score
  let mse = 0;
  for (let i = 0; i < n; i++) { const d = m1[i]-m2[i]; mse += d*d; }
  mse /= n;
  const mseScore = 1 - Math.min(mse / 10000, 1);

  const combined = corr * 0.5 + gradientMatch * 0.3 + mseScore * 0.2;
  const finalScore = Math.max(0, Math.min(1, combined));

  console.log(`[compare] corr=${corr.toFixed(3)} grad=${gradientMatch.toFixed(3)} mse=${mseScore.toFixed(3)} -> ${finalScore.toFixed(3)}`);
  return finalScore;
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
