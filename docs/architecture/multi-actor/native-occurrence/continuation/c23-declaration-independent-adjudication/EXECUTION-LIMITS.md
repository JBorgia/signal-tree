Preparation record:
- Initial source copy interrupted via its own exec session, exit130, before completion or test launch. Partial candidate not used.
- A recursive original-run evidence copy was also interrupted before test launch; only original-raw/{react,kernel}/{COMMAND.json,RESULT.json,first.log} is the curated original evidence. Do not archive incomplete copied caches as qualification.
- Full manifest check eventually completed successfully:3067 files, changed[]. FULL-VERIFICATION-COMPLETED.json retained. The subsequent230-input check is separately recorded, not a substitute mislabeled as full verification.
- First supervisor preflight raised TypeError: OwnedProcesses.scan() missing1 required positional argument:self. It ran before Popen, so no test was launched. Corrected invocation uses OwnedProcesses.scan(None), since scan uses no instance state. Preserve runs/react-preflight-failure/COMMAND.json.
- Exactly one actual React run followed, exit1 with3 failed/3 passed; no deadline and no observed descendants remain.
- Original fixture assertions were never changed. Prepared scratch neutral and row-receipt companion were not run, at Main's instruction. No further tests/builds executed.
