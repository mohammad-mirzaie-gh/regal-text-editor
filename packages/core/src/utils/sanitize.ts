const SAFE_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:", ""]);

/** Rejects `javascript:`, `data:`, `vbscript:` and any other scheme not on
 * the allowlist. Relative URLs (no scheme) are always allowed. This is the
 * single choke point every link/image/embed attribute value must pass
 * through, whether it came from typing, paste, source-mode, or import. */
export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) === false) return true; // relative URL, no scheme
  try {
    const url = new URL(trimmed, "https://example.invalid/");
    return SAFE_URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function sanitizeUrl(value: string): string {
  return isSafeUrl(value) ? value : "";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlAttr(text: string): string {
  return escapeHtml(text);
}

const DANGEROUS_TAGS = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "base", "form"]);

export function isDangerousTag(tagName: string): boolean {
  return DANGEROUS_TAGS.has(tagName.toLowerCase());
}

export function isEventHandlerAttribute(name: string): boolean {
  return /^on/i.test(name);
}
