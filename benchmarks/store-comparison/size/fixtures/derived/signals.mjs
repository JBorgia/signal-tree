import { signal, computed } from '@angular/core';

const prices = signal([3, 4]);
const qty = signal(2);
const total = computed(() => prices().reduce((a, b) => a + b, 0) * qty());
const expensive = computed(() => total() > 10);
qty.set(3);

globalThis.__result = { total: total(), expensive: expensive() };
