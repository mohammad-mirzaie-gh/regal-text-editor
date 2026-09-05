import { describe, expect, it } from "vitest";
import { escapeHtml, escapeHtmlAttr, isDangerousTag, isEventHandlerAttribute, isSafeUrl, sanitizeUrl } from "../utils/sanitize";

describe("isSafeUrl / sanitizeUrl", () => {
  it("allows an empty value and pure whitespace", () => {
    expect(isSafeUrl("")).toBe(true);
    expect(isSafeUrl("   ")).toBe(true);
  });

  it("allows relative URLs (no scheme)", () => {
    expect(isSafeUrl("/path/to/page")).toBe(true);
    expect(isSafeUrl("page.html")).toBe(true);
    expect(isSafeUrl("#anchor")).toBe(true);
  });

  it("allows the whitelisted schemes", () => {
    expect(isSafeUrl("http://example.com")).toBe(true);
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("mailto:someone@example.com")).toBe(true);
    expect(isSafeUrl("tel:+15551234567")).toBe(true);
  });

  it("rejects dangerous schemes", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects a value that looks scheme-prefixed but fails to parse as a URL", () => {
    expect(isSafeUrl("http://[::1")).toBe(false);
  });

  it("tolerates leading/trailing whitespace around the value", () => {
    expect(isSafeUrl("  https://example.com  ")).toBe(true);
    expect(isSafeUrl("  javascript:alert(1)  ")).toBe(false);
  });

  it("sanitizeUrl passes through a safe value and blanks an unsafe one", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });
});

describe("escapeHtml / escapeHtmlAttr", () => {
  it("escapes all five special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("just plain text")).toBe("just plain text");
  });

  it("escapeHtmlAttr behaves the same as escapeHtml", () => {
    expect(escapeHtmlAttr(`"quoted"`)).toBe(escapeHtml(`"quoted"`));
  });
});

describe("isDangerousTag", () => {
  it("flags every tag on the dangerous list, case-insensitively", () => {
    for (const tag of ["script", "STYLE", "Iframe", "object", "embed", "link", "meta", "base", "form"]) {
      expect(isDangerousTag(tag)).toBe(true);
    }
  });

  it("does not flag an ordinary tag", () => {
    expect(isDangerousTag("p")).toBe(false);
    expect(isDangerousTag("div")).toBe(false);
  });
});

describe("isEventHandlerAttribute", () => {
  it("flags any attribute name starting with 'on', case-insensitively", () => {
    expect(isEventHandlerAttribute("onclick")).toBe(true);
    expect(isEventHandlerAttribute("OnClick")).toBe(true);
    expect(isEventHandlerAttribute("onmouseover")).toBe(true);
  });

  it("does not flag an unrelated attribute", () => {
    expect(isEventHandlerAttribute("href")).toBe(false);
    expect(isEventHandlerAttribute("data-one")).toBe(false);
  });
});
