# Original measured-corruption fixtures

These two `.ts.txt` files are byte-for-byte copies of the source fixtures at
`7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`. They record the original R6 authority
loss and R8 clobber/resurrection observations. Their assertions intentionally
expected those defects; they are historical evidence, not desired conformance.

The first main transaction-suite run after the conservative safety port had
seven failures and 224 passes. Five failures were R6 assertions expecting lost
authority/false-success retry, and two were R8 assertions expecting successful
corrupting rollback. Log: `/private/tmp/main-transactions-integrated.log`.

The corresponding live specs now enforce safety: failed compensation preserves
pending authority; unsafe older overlap refuses without changing either writer;
a later settlement can make retry safe. They also destroy every owned tree.
The preregistered surgical R8 expectations and the frozen semantic research
contract are unchanged. Atomic refusal is containment, not proof that the
architecture can remove every overlapping contribution independently.
