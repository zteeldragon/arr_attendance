export async function initCamera(){
  const video = document.getElementById('cam-video');
  if (!video) { console.warn('cam-video element not found'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    video.play();
  } catch (e) { console.error('Error accessing camera for face capture:', e); }
}

export async function captureImage(){
  const video = document.getElementById('cam-video');
  if (!video) {
    console.warn('cam-video element not found'); return null;
  }
  // create canvas to grab frame
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob)=>{ resolve(blob); }, 'image/jpeg', 0.92);
  });
}
