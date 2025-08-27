import { registerBatchingFactory } from '../batching/src/lib/registry';
import { withBatching } from '../batching/src/lib/batching';

// Register the heavy implementation as the runtime factory
registerBatchingFactory((config) => withBatching(config));
