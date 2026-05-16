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

  // Load captured image and each portrait, then compare pixel similarity
  let bestScore = -1;
  const threshold = 0.85; // 85% similarity to match

  for (const portraitName of portraits) {
    try {
      const score = await compareImageWithPortrait(imageBlob, `assets/images/${portraitName}`);
      if (score > bestScore) bestScore = score;
    } catch (err) {
      console.warn(`Failed to load portrait ${portraitName}:`, err.message);
    }
  }

  // If no portraits loaded successfully, face not recognized
  if (bestScore < 0) return false;

  // Return true only if similarity exceeds threshold
  return bestScore >= threshold;
}

async function compareImageWithPortrait(imageBlob, portraitUrl){
  const img1 = await loadImageFromBlob(imageBlob);
  const img2 = await loadExternalImage(portraitUrl);

  // Resize both images to the same dimensions for comparison
  const size = 150;
  const c1 = document.createElement('canvas');
  const c2 = document.createElement('canvas');
  c1.width = c2.width = size;
  c1.height = c2.height = size;

  const ctx1 = c1.getContext('2d');
  const ctx2 = c2.getContext('2d');
  ctx1.drawImage(img1, 0, 0, size, size);
  ctx2.drawImage(img2, 0, 0, size, size);

  const data1 = ctx1.getImageData(0, 0, size, size).data;
  const data2 = ctx2.getImageData(0, 0, size, size).data;

  // Compute normalized correlation between pixel arrays
  let sum = 0, sum1 = 0, sum2 = 0;
  const len = data1.length;
  for (let i = 0; i < len; i += 4) {
    const p1 = data1[i]; // red channel
    const p2 = data2[i];
    sum += p1 * p2;
    sum1 += p1 * p1;
    sum2 += p2 * p2;
  }

  const denominator = Math.sqrt(sum1 * sum2);
  if (denominator === 0) return 0;
  return sum / denominator;
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
