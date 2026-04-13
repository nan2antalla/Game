export function isMobileDevice() {
  const ua = navigator.userAgent || "";
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) <= 900;
  return mobileUA || (coarsePointer && smallScreen);
}

export function isPortraitOrientation() {
  return window.innerHeight > window.innerWidth;
}
