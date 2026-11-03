Added after the first seven examples, before execution, following independent
contract review: an outbox entry copied from a pending live value but declared
with zero owners should publish. This is a deliberately invalid declaration,
not a positive safety pass. It establishes the prototype trusts its caller and
cannot automatically detect misclassified publication. Preserve first-run.log.
