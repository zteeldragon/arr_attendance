export async function initCamera(){
  const video = document.getElementById('cam-video');
  if (!video) { console.warn('cam-video element not found'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width:320, height:240 },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
  } catch (e) {
    console.error('Error accessing camera for face capture:', e);
    throw new Error(`Camera failed: ${e.message || 'unknown error'}`);
  }
}

export async function captureImage(){
  const video = document.getElementById('cam-video');
  if (!video || !video.srcObject) {
    console.warn('Camera not initialized or element not found'); return null;
  }
  // Wait until video has valid dimensions (stream may take a moment to start)
  while (video.videoWidth === 0 || video.videoHeight === 0) {
    await new Promise(r => setTimeout(r, 100));
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
}
