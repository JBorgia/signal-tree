import { it } from 'vitest';
import * as api from '../index';
import { receiptCases, runReceiptCase } from '../../tests/entity-registration/receipt-cases';
for (const test of receiptCases) it(test.name, () => runReceiptCase(api, test));
