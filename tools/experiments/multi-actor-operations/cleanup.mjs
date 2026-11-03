// Test harness utility, not application cancellation or forced owner retirement.
export async function withCleanup(body, cleanups, report = errors => console.error('Secondary cleanup failures:', errors)) {
  let failed = false;
  let primary;
  let result;
  try { result = await body(); }
  catch (error) { failed = true; primary = error; }
  const errors = [];
  for (const cleanup of cleanups) {
    try { await cleanup(); } catch (error) { errors.push(error); }
  }
  if (failed) {
    if (errors.length) {
      try { report(errors); } catch { /* Reporting cannot replace the first failure. */ }
    }
    throw primary;
  }
  if (errors.length) throw new AggregateError(errors, 'Cleanup failed');
  return result;
}
