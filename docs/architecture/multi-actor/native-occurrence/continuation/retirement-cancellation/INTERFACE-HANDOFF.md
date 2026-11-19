# Cancellation interface

onOwnerCellTransition retains its existing signature and queued notification semantics. Each release handle owns one observer and its original set only; repeated release is inert. Clearing the callback also neutralizes already queued work. Registration/settlement semantics and callback-error handling are unchanged. This is independent of readiness-phase changes and introduces no owner terminality decision or proof mutation.
