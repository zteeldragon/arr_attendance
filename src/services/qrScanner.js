import { BrowserMultiFormatReader } from 'https://cdn.skypack.dev/@zxing/library';

/**
 * Starts the QR code scanner using the device camera.
 * Once a QR code is detected, it calls `window.onQRResult` with the decoded text.
 */
export async function startQRScanner(){
  const video = document.getElementById('qr-video');
  if (!video) {
    console.warn('qr-video element not found');
    return;
  }

  try {
    // Request camera access (any camera)
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.play();

    const codeReader = new BrowserMultiFormatReader();
    // Start decoding from the video element. The callback receives result or error.
    await codeReader.decodeFromVideoElement(video, (result, err) => {
      if (err && !(err instanceof ZXing.NotFoundException)) {
        console.error('QR decode error', err);
        return;
      }
      if (result) {
        const text = result.text;
        console.log('QR detected:', text);
        // Stop the scanner after a successful read
        codeReader.reset();
        stream.getTracks().forEach(t => t.stop());
        window.onQRResult && window.onQRResult(text);
      }
    });
  } catch (e) {
    console.error('Error accessing camera for QR scan:', e);
  }
}
