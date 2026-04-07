/**
 * external-links.ts
 *
 * Opens an external URL in a new tab reliably on ALL devices (desktop, mobile, tablet).
 *
 * window.open() gets blocked by iOS/Android popup blockers when called inside
 * async handlers or after any delay. The only guaranteed method on mobile is a
 * real <a target="_blank"> click dispatched synchronously in a user-gesture context.
 */

export const openExternalUrlInNewTab = (url: string): boolean => {
  try {
    // Primary method: create a real anchor and click it — works on iOS Safari,
    // Android Chrome, and every desktop browser without popup-blocker issues.
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    // Must be in DOM to work on Firefox
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    // Absolute fallback
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    } catch {
      return false;
    }
  }
};
