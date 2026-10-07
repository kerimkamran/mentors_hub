export * from "./types";
export { runMatching } from "./engine";
export { DEFAULT_MATCHING_SETTINGS, defaultMatchingSettings, validateMatchingSettings, assertValidSettings, ENGINE_VERSION } from "./settings";
export { renderExplanation, renderReason, renderNotAvailable, pluralCategory } from "./render";
export { diffMatchingResults, type MatchingDiff } from "./diff";
