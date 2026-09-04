// Model
export * from "./model/types";
export * from "./model/node";

// Schema
export * from "./schema/types";
export { Schema, type SchemaConfig } from "./schema/schema";
export { createBaseSchema } from "./schema/defaults";
export { parseContentExpression, matchesContentExpression } from "./schema/content-matcher";

// Position / selection
export * from "./position/point";
export * from "./selection/types";
export * from "./selection/selection";

// Transactions / operations
export * from "./transaction/operations";
export { Transaction, type TransactionResult } from "./transaction/transaction";
export { applyOperation, applyOperations } from "./transforms/apply";

// Transforms
export { findTextBlockPath } from "./transforms/text-block";
export { deleteRange } from "./transforms/delete";
export { insertTextAtSelection } from "./transforms/insert-text";
export { splitBlock, type SplitBlockResult } from "./transforms/split-block";
export { insertBlocksAtSelection } from "./transforms/insert-blocks";
export { sliceDocument } from "./transforms/slice";
export { mergeBlockBackward } from "./transforms/merge-block";
export { applyMarkToRange, removeMarkFromRange, isMarkActiveAcrossRange } from "./transforms/marks";
export { setBlockType, wrapBlocks, unwrapBlocks } from "./transforms/block-type";
export { indentListItem, outdentListItem } from "./transforms/list-indent";

// Normalization
export { normalizeDocument } from "./normalization/normalize";

// Search
export { findMatches, replaceMatch, replaceAllMatches, type SearchMatch, type SearchOptions } from "./search/search";

// History
export { HistoryManager, defaultHistoryConfig, type HistoryConfig, type HistoryStep } from "./history/history";

// Commands
export type { Command } from "./commands/types";
export { CommandRegistry } from "./commands/registry";

// Plugins
export type { Plugin, PluginSchemaExtension } from "./plugins/types";

// Serialization
export { SerializerRegistry, type NodeSerializer, type MarkSerializer, type NodeSerializers, type MarkSerializers } from "./serialization/registry";
export { toHTML } from "./serialization/html";
export { toMarkdown } from "./serialization/markdown";
export { toJSON, fromJSON } from "./serialization/json";
export { toPlainText } from "./serialization/text";

// Parsing
export { parseHTML, HtmlParserRegistry, safeAttr, type BlockHtmlParser, type MarkHtmlParser, type HtmlParseContext } from "./parsing/html";

// Utils
export { generateId } from "./utils/id";
export { isSafeUrl, sanitizeUrl, escapeHtml } from "./utils/sanitize";

// Editor
export { Editor, type EditorConfig, type EditorEventMap } from "./editor";
