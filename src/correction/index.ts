// Public surface of the shared bridge-rate correction package (#24 §3).
// Source of truth lives in `bounce-data`; REST + the WS DO import this at one
// pinned ref. Keep this barrel dependency-free.
export {
  correct,
  DEFAULT_K,
  type CorrectionResult,
  type CorrectionStatus,
  type CorrectOptions,
  type Marker,
} from "./correct";
