/**
 * Stable node identifiers. IDs are assigned once at node creation and
 * preserved across transactions/normalization so features that reference
 * a node externally (comments, bookmarks, collaboration, revisions) keep
 * working even after the node moves within the tree.
 */

let counter = 0;

export function generateId(prefix = "node"): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
}
