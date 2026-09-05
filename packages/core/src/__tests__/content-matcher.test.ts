import { describe, expect, it } from "vitest";
import { matchesContentExpression, parseContentExpression } from "../schema/content-matcher";

function exact(tokenName: string, childType: string): boolean {
  return tokenName === childType;
}

describe("schema/content-matcher", () => {
  describe("parseContentExpression", () => {
    it("parses a bare name as quantifier 'one'", () => {
      expect(parseContentExpression("paragraph")).toEqual([{ name: "paragraph", quantifier: "one" }]);
    });

    it("parses *, +, and ? suffixes", () => {
      expect(parseContentExpression("inline*")).toEqual([{ name: "inline", quantifier: "star" }]);
      expect(parseContentExpression("block+")).toEqual([{ name: "block", quantifier: "plus" }]);
      expect(parseContentExpression("caption?")).toEqual([{ name: "caption", quantifier: "optional" }]);
    });

    it("parses multiple whitespace-separated tokens, tolerating extra spaces", () => {
      expect(parseContentExpression("  heading  paragraph*  ")).toEqual([
        { name: "heading", quantifier: "one" },
        { name: "paragraph", quantifier: "star" }
      ]);
    });
  });

  describe("matchesContentExpression", () => {
    it("matches a single required token against exactly one child", () => {
      expect(matchesContentExpression("paragraph", ["paragraph"], exact)).toBe(true);
      expect(matchesContentExpression("paragraph", [], exact)).toBe(false);
      expect(matchesContentExpression("paragraph", ["paragraph", "paragraph"], exact)).toBe(false);
    });

    it("'*' accepts zero children", () => {
      expect(matchesContentExpression("inline*", [], exact)).toBe(true);
    });

    it("'*' accepts any number of matching children", () => {
      expect(matchesContentExpression("inline*", ["inline", "inline", "inline"], exact)).toBe(true);
    });

    it("'+' requires at least one matching child", () => {
      expect(matchesContentExpression("block+", [], exact)).toBe(false);
      expect(matchesContentExpression("block+", ["block"], exact)).toBe(true);
      expect(matchesContentExpression("block+", ["block", "block"], exact)).toBe(true);
    });

    it("'?' accepts zero or exactly one matching child", () => {
      expect(matchesContentExpression("caption?", [], exact)).toBe(true);
      expect(matchesContentExpression("caption?", ["caption"], exact)).toBe(true);
      expect(matchesContentExpression("caption?", ["caption", "caption"], exact)).toBe(false);
    });

    it("matches a sequence of tokens in order", () => {
      expect(matchesContentExpression("heading paragraph*", ["heading", "paragraph", "paragraph"], exact)).toBe(true);
      expect(matchesContentExpression("heading paragraph*", ["paragraph", "heading"], exact)).toBe(false);
    });

    it("rejects when a child type doesn't satisfy the current token", () => {
      expect(matchesContentExpression("paragraph", ["image"], exact)).toBe(false);
    });

    it("rejects trailing children left over after all tokens are consumed", () => {
      expect(matchesContentExpression("heading", ["heading", "paragraph"], exact)).toBe(false);
    });

    it("delegates group matching (e.g. 'inline'/'block') entirely to the matches callback", () => {
      const groupMatch = (tokenName: string, childType: string): boolean =>
        tokenName === "inline" ? childType === "text" || childType === "image" : tokenName === childType;
      expect(matchesContentExpression("inline*", ["text", "image", "text"], groupMatch)).toBe(true);
      expect(matchesContentExpression("inline*", ["text", "paragraph"], groupMatch)).toBe(false);
    });
  });
});
