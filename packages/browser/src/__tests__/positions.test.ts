import { describe, expect, it } from "vitest";
import { Editor, createBaseSchema, createDocument, createElement, createText } from "@regal-text-editor/core";
import { collectDomTextNodes, domPointToModel, modelPointToDom } from "../dom/positions";

/** @regal-text-editor/browser is framework/plugin-agnostic, so its own tests build
 * documents and a minimal paragraph HTML serializer directly through
 * @regal-text-editor/core's registries rather than pulling in @regal-text-editor/plugin-basic-blocks. */
function makeEditor(paragraphs: string[]): Editor {
  const editor = new Editor({ schema: createBaseSchema(), plugins: [] });
  editor.htmlRegistry.registerNode("paragraph", (_node, children) => `<p>${children.join("") || "<br>"}</p>`);
  const doc = createDocument(paragraphs.map((text) => createElement("paragraph", {}, [createText(text)])));
  editor.setContent(doc);
  return editor;
}

/** Mirrors what EditorView.render() does, without needing a full view. */
function renderContainer(editor: Editor): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = editor.getHTML();
  document.body.appendChild(container);
  return container;
}

describe("dom/positions", () => {
  describe("collectDomTextNodes", () => {
    it("returns every text node under root in document order", () => {
      const container = document.createElement("div");
      container.innerHTML = "<p>a<strong>b</strong>c</p><p>d</p>";
      expect(collectDomTextNodes(container).map((n) => n.data)).toEqual(["a", "b", "c", "d"]);
    });

    it("returns an empty array when there is no text", () => {
      const container = document.createElement("div");
      container.innerHTML = "<p><br></p>";
      expect(collectDomTextNodes(container)).toEqual([]);
    });
  });

  describe("modelPointToDom", () => {
    it("maps a point on a non-empty leaf to its DOM text node, clamping the offset", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const result = modelPointToDom(editor, container, { path: [0, 0], offset: 3 });
      expect(result?.node.nodeType).toBe(Node.TEXT_NODE);
      expect((result?.node as Text).data).toBe("hello");
      expect(result?.offset).toBe(3);

      const clamped = modelPointToDom(editor, container, { path: [0, 0], offset: 999 });
      expect(clamped?.offset).toBe(5);
    });

    it("falls back to the containing block element for an empty leaf", () => {
      const editor = makeEditor(["hello", ""]);
      const container = renderContainer(editor);
      const result = modelPointToDom(editor, container, { path: [1, 0], offset: 0 });
      expect(result?.node.nodeType).toBe(Node.ELEMENT_NODE);
      expect((result?.node as Element).tagName).toBe("P");
      expect(result?.offset).toBe(0);
    });

    it("returns null when the fallback block element cannot be found either", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const result = modelPointToDom(editor, container, { path: [5, 0], offset: 0 });
      expect(result).toBeNull();
    });
  });

  describe("domPointToModel", () => {
    it("maps a text node directly back to its model point", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const textNode = container.querySelector("p")!.firstChild as Text;
      expect(domPointToModel(editor, container, textNode, 2)).toEqual({ path: [0, 0], offset: 2 });
    });

    it("resolves an element + in-range child index down to that child's text node", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const p = container.querySelector("p")!;
      expect(domPointToModel(editor, container, p, 0)).toEqual({ path: [0, 0], offset: 0 });
    });

    it("resolves an element + out-of-range offset to the end of its last text child", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const p = container.querySelector("p")!;
      expect(domPointToModel(editor, container, p, 5)).toEqual({ path: [0, 0], offset: 5 });
    });

    it("treats a <br> filler as its parent block, never as an addressable node", () => {
      const editor = makeEditor(["hello", ""]);
      const container = renderContainer(editor);
      const secondP = container.querySelectorAll("p")[1]!;
      const br = secondP.querySelector("br")!;
      expect(domPointToModel(editor, container, br, 0)).toEqual({ path: [1, 0], offset: 0 });
      // Also when the *parent* is reported with an offset landing past the <br>.
      expect(domPointToModel(editor, container, secondP, 1)).toEqual({ path: [1, 0], offset: 0 });
    });

    it("resolves an empty element with no children to itself, then to its block's empty leaf", () => {
      const editor = makeEditor(["hello", ""]);
      const container = renderContainer(editor);
      const secondP = container.querySelectorAll("p")[1]!;
      // Simulate a browser reporting the caret on an element with literally
      // no children at all (jsdom's <br> filler is always present in
      // practice, so this exercises the "no children" branch directly).
      secondP.innerHTML = "";
      expect(domPointToModel(editor, container, secondP, 0)).toEqual({ path: [1, 0], offset: 0 });
    });

    it("returns null for a node that is neither a text nor an element node", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const comment = document.createComment("x");
      expect(domPointToModel(editor, container, comment, 0)).toBeNull();
    });

    it("returns null when a text node isn't part of the rendered container at all", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const stray = document.createTextNode("stray");
      expect(domPointToModel(editor, container, stray, 0)).toBeNull();
    });

    it("returns null when a text node is in the DOM but has no corresponding model leaf", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const strayText = document.createTextNode("extra");
      container.appendChild(strayText);
      // Found by collectDomTextNodes (index 1), but nonEmptyModelLeaves only
      // has one entry — the index lookup into the model side comes up empty.
      expect(domPointToModel(editor, container, strayText, 0)).toBeNull();
    });

    it("returns null when the element maps to a block path the model doesn't have", () => {
      const editor = makeEditor(["hello"]);
      const container = renderContainer(editor);
      const strayP = document.createElement("p");
      container.appendChild(strayP);
      expect(domPointToModel(editor, container, strayP, 0)).toBeNull();
    });
  });
});
