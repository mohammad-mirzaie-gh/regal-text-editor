interface ContentToken {
  name: string;
  quantifier: "one" | "star" | "plus" | "optional";
}

export function parseContentExpression(expression: string): ContentToken[] {
  return expression
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const last = raw[raw.length - 1];
      if (last === "*") return { name: raw.slice(0, -1), quantifier: "star" as const };
      if (last === "+") return { name: raw.slice(0, -1), quantifier: "plus" as const };
      if (last === "?") return { name: raw.slice(0, -1), quantifier: "optional" as const };
      return { name: raw, quantifier: "one" as const };
    });
}

/**
 * Greedy, sequential matcher for the simplified content grammar. `matches`
 * is called for each candidate child against a token's `name` (a node type
 * or a group like "block"/"inline") to decide whether it satisfies that slot.
 */
export function matchesContentExpression(
  expression: string,
  childTypes: string[],
  matches: (tokenName: string, childType: string) => boolean
): boolean {
  const tokens = parseContentExpression(expression);
  let childIndex = 0;

  for (const token of tokens) {
    let consumedOnce = false;

    const consume = (): boolean => {
      const childType = childTypes[childIndex];
      if (childType === undefined) return false;
      if (!matches(token.name, childType)) return false;
      childIndex += 1;
      consumedOnce = true;
      return true;
    };

    switch (token.quantifier) {
      case "one": {
        if (!consume()) return false;
        break;
      }
      case "optional": {
        consume();
        break;
      }
      case "plus": {
        if (!consume()) return false;
        while (consume()) {
          /* keep consuming */
        }
        break;
      }
      case "star": {
        while (consume()) {
          /* keep consuming */
        }
        void consumedOnce;
        break;
      }
    }
  }

  return childIndex === childTypes.length;
}
