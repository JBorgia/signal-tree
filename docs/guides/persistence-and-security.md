# Persistence And Security

The previous security guide described the removed `stored()` marker. That marker is not part of the current release-candidate public API, so its hardening guidance has been withdrawn from the live docs.

Until a new persistence contract earns the RC surface, keep browser persistence in application services. Treat browser storage as untrusted, avoid secrets and PII, clear user-scoped values on logout, and validate anything read from storage before writing it into SignalTree state.
