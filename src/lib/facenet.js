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
  // Placeholder logic: always return true after simulating a delay
  await new Promise(r=>setTimeout(r,200));
  // In real implementation, you would:
  // 1. Load the employee portrait images.
  // 2. Detect face descriptors for both captured image and stored portraits.
  // 3. Compute Euclidean distance and compare to a threshold.
  return Math.random() > 0.5;
}
