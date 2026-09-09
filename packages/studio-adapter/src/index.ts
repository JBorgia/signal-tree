export { captureConfirmedTurns, type CaptureResult } from './attach';
export {
  attachStudio,
  type AttachStudioOptions,
  type StudioAttachment,
  type StudioTreeProbe,
} from './attach-studio';
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
  peekRegistry,
  type ConfirmedTurnsResponse,
  type StudioBridgeTree,
  type StudioRegistry,
} from './registry';
export {
  createTreeIdentityRegistry,
  type TreeIdentityRegistry,
} from './tree-identity';
