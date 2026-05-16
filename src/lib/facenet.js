// Face comparison using face-api.js for detection + cropped face comparison
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

  // Detect and crop face from captured image (removes background)
  let croppedFace = null;
  try {
    croppedFace = await getCroppedFace(imageBlob);
    console.log('Captured face cropped successfully');
  } catch (err) {
    console.warn('Could not crop captured face:', err.message);
    // Fall through - will use full image as fallback
  }

  // Try to compare against each portrait; skip ones that fail to load
  let bestScore = -1;
  const threshold = 0.65;
  let triedCount = 0;

  for (const portraitName of portraits) {
    const url = `assets/images/${portraitName}`;
    try {
      const score = await compareImageWithPortrait(croppedFace, url);
      triedCount++;
      console.log(`Portrait ${portraitName}: score=${score.toFixed(3)}`);
      if (score > bestScore) bestScore = score;
    } catch (err) {
      console.warn(`Failed to compare portrait ${portraitName}:`, err.message);
      // Store error for debugging
      window.__facenetError = window.__facenetError || [];
      window.__facenetError.push({ portrait: portraitName, error: err.message });
    }
  }

  console.log(`compareFaces: tried=${triedCount}, bestScore=${bestScore.toFixed(3)}, threshold=${threshold}`);

  if (triedCount === 0) {
    console.error('compareFaces: NO portraits could be loaded at all');
    const resultEl = document.getElementById('result');
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.textContent = `Face not recognized. Reject. [DEBUG: triedCount=0, portraits=${portraits.join(',')}]. Check debug-log div for details.`;
    }
    return false;
  }

  const match = bestScore >= threshold;
  console.log(`compareFaces result: ${match ? 'MATCH' : 'NO MATCH'} (${bestScore.toFixed(3)} vs ${threshold})`);
  return match;
}

// Detect face and crop to face region only (removes background)
async function getCroppedFace(imageBlob){
  if (typeof faceapi === 'undefined') {
    throw new Error('face-api.js not loaded');
  }
  const img = await loadImageFromBlob(imageBlob);
  const detection = await faceapi.detectSingleFace(img).withFaceLandmarks();
  if (!detection) {
    throw new Error('No face detected in captured image');
  }

  const box = detection.box;
  // Add padding around face (20% margin)
  const padX = Math.floor(box.width * 0.2);
  const padY = Math.floor(box.height * 0.2);
  const x = Math.max(0, box.x - padX);
  const y = Math.max(0, box.y - padY);
  const w = Math.min(img.naturalWidth - x, box.width + padX * 2);
  const h = Math.min(img.naturalHeight - y, box.height + padY * 2);

  // Draw cropped face region to canvas and return as blob
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
  });
}

async function compareImageWithPortrait(croppedFaceBlob, portraitUrl){
  // Load the cropped face (or full image if cropping failed)
  const img1 = await loadImageFromBlob(croppedFaceBlob);

  // Load and crop portrait face region too
  let img2;
  if (typeof faceapi !== 'undefined' && modelsLoaded) {
    img2 = await loadAndCropPortrait(portraitUrl);
  } else {
    img2 = await loadExternalImage(portraitUrl);
  }

  console.log(`[compare] loaded: img1=${img1?.naturalWidth}x${img1?.naturalHeight}, img2=${img2?.naturalWidth}x${img2?.naturalHeight}`);

  if (!img1 || !img1.naturalWidth || !img1.naturalHeight) {
    throw new Error('Captured image is invalid (w=' + (img1?.naturalWidth||0) + ' h=' + (img1?.naturalHeight||0) + ')');
  }
  if (!img2 || !img2.naturalWidth || !img2.naturalHeight) {
    throw new Error('Portrait image is invalid (w=' + (img2?.naturalWidth||0) + ' h=' + (img2?.naturalHeight||0) + ')');
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
