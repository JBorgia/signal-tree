export { captureConfirmedTurns, type CaptureResult } from './attach';
export { attachStudio } from './attach-studio';
export {
  attachStudioProbe,
  type AttachStudioOptions,
  type StudioAttachment,
  type StudioTreeProbe,
} from './attach-studio-probe';
export {
  probeSignalTree,
  type StudioAttachableTree,
} from './probe-signal-tree';
export { S1_CAPABILITIES, type StudioCapability } from './capabilities';
export {
  StudioRequirementError,
  type StudioBridgeError,
  type StudioResult,
} from './errors';
export {
  type ConfirmedTurnReader,
  type KernelConfirmedTurn,
  type KernelConfirmedTurnSnapshot,
  type KernelRetention,
  type KernelTurnEffect,
} from './kernel-contract';
export { toStudioTurn } from './normalize';
export {
  createRealizationCapture,
  type ObservedFrame,
  type RealizationCapture,
  type RealizationCaptureOptions,
} from './realization/capture';
export { liveCaptureTarget, type LiveTree } from './realization/live-target';
export { realizationSupport, type TreeStructure } from './realization/support';
export {
  isCaptureActive,
  startRealizationCapture,
  StudioCaptureError,
  type CaptureTarget,
  type RealizationLease,
  type StartCaptureOptions,
} from './realization/lease';
export {
  type CapturedValue,
  type RealizationCaptureSnapshot,
  type RealizationCoverage,
  type RealizationEffect,
  type RealizationRetention,
  type RealizationSupport,
  type ScopeIntegrity,
} from './realization/types';
export {
  peekRegistry,
  type ConfirmedTurnsResponse,
  type StudioBridgeTree,
  type StudioRegistry,
} from './registry';
export {
  createTreeIdentityRegistry,
  type TreeIdentityRegistry,
} from './tree-identity';
