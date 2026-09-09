export { handleStudioRequest } from './handle-request';
export {
  installStudioBridge,
  studioBridgeInstalled,
  uninstallStudioBridge,
  type InstalledStudioBridge,
  type StudioBridgeHost,
} from './install';
export {
  isStudioBridgeRequest,
  STUDIO_CONNECT,
  STUDIO_PROTOCOL_VERSION,
  STUDIO_SCHEMA_VERSION,
  type StudioBridgeRequest,
  type StudioBridgeResponse,
  type StudioHello,
} from './protocol';
