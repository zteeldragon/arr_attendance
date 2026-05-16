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
  // Placeholder logic: simulate face comparison delay
  await new Promise(r => setTimeout(r, 200));

  if (typeof faceapi === 'undefined') {
    console.warn('face-api.js not loaded — using simulated comparison');
    return Math.random() > 0.5;
  }

  // In real implementation, you would:
  // 1. Load the employee portrait images (front, left, right).
  // 2. Detect face descriptors for both captured image and stored portraits.
  // 3. Compute Euclidean distance and compare to a threshold.
  return Math.random() > 0.5;
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

function loadImageFromBlob(blob){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(blob);
  });
}
