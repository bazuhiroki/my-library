// 本屋さんでバーコードを読む。Android の Chrome は標準の BarcodeDetector、iPhone などは ZXing で読む
const ok13 = (d) => { let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * (i % 2 ? 3 : 1); return (10 - (s % 10)) % 10 === +d[12]; };
export const isIsbn = (c) => /^97[89]\d{10}$/.test(c) && ok13(c);
export const isPriceCode = (c) => /^19[12]\d{10}$/.test(c);

export function createScanner({ video, onCode, onStatus }) {
  let stream = null, running = false, zxingControls = null, detector = null, raf = 0;
  let last = '', lastAt = 0;

  function emit(code) {
    const now = performance.now();
    if (code === last && now - lastAt < 3000) return;
    last = code; lastAt = now;
    if (isIsbn(code)) { try { navigator.vibrate && navigator.vibrate(60); } catch (_) {} onCode(code); }
    else if (isPriceCode(code)) onStatus('それは値段のバーコード。上の段（978から始まる方）を映してね');
  }

  async function start() {
    if (running) return; running = true;
    onStatus('カメラを起動しています…');
    try {
      if ('BarcodeDetector' in window) {
        const fmts = await window.BarcodeDetector.getSupportedFormats();
        if (fmts.includes('ean_13')) detector = new window.BarcodeDetector({ formats: ['ean_13'] });
      }
      if (detector) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        video.srcObject = stream; video.setAttribute('playsinline', ''); await video.play();
        onStatus('本の裏のバーコード（978〜）を枠に合わせてね');
        const tick = async () => {
          if (!running) return;
          if (video.readyState >= 2) { try { const found = await detector.detect(video); found.forEach((b) => emit(b.rawValue)); } catch (_) {} }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } else {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
        const hints = new Map(); hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]); hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        zxingControls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, video, (result) => { if (result) emit(result.getText()); });
        onStatus('本の裏のバーコード（978〜）を枠に合わせてね');
      }
    } catch (e) {
      running = false;
      onStatus(e && e.name === 'NotAllowedError' ? 'カメラの使用が許可されていません。ブラウザの設定で許可するか、下の欄にISBNを入力してね' : 'カメラを起動できませんでした。下の欄にISBNを入力してね');
    }
  }
  function stop() {
    running = false; cancelAnimationFrame(raf);
    if (zxingControls) { try { zxingControls.stop(); } catch (_) {} zxingControls = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    video.srcObject = null;
  }
  return { start, stop, get running() { return running; } };
}
