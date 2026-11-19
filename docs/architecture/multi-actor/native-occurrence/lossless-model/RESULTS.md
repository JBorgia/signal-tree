# Lossless-address model successor — review supplement

Predecessor untouched: /private/tmp/st-native-netzero-discriminators/model. Its 18-case oracle is preserved. This separate successor changes representation only; no production patch, native disposition or rollback expectation changed.

## Concrete predecessor defects

predecessor-counterexamples.json records actual execution against the preserved model: occurrence `a` + dimension `f:x/f:y` and occurrence `a/f:x` + dimension `f:y` flatten to the same address. One overwrites the other and render fails the expected selection check. Similarly rebind slot `a/b` + field `c` aliases slot `a` + field `b/c`. The old fixture labels happened not to contain these delimiters; no public or frozen-source contract forbids them. The old representation therefore supported only those fixture labels, not a general lossless identity claim.

Assigning the own field __proto__ with an object value changes the old output object's prototype instead of emitting an own data property. The recorded old output has prototypeChanged=true and ownProto=false.

## Successor representation

Render source, retained, exclusions and output support are Map<occurrence, Map<dimension, selection>>. Map identity keeps opaque occurrence objects distinct even if they stringify identically, and distinguishes number1 from string1. Dimension labels are tagged fixture strings (`f:` followed by the complete field name, or membership/placement tags); prefix removal is injective for field strings. They are never concatenated with occurrence. This model covers enumerable string fields matching its Object.keys domain, not a newly promised symbol-field API.

Rebind receives a request-local fieldSlot allocator using nested Map<exact native slot, Map<field string, opaque token>>. Repeated exact tuple returns the same token; a different tuple never aliases. This is a model identity adapter, not permission to add a production authority index. Production must retain its existing typed/lossless slot identity. The allocator's map is owned by the request; no global history. Actual normalized effects/held consumers may retain the returned tokens under the existing lifecycle contract.

Output rows retain the ordinary Object prototype, but own fields are installed with Object.defineProperty(data descriptor, enumerable/writable/configurable true), so no inherited setter runs. Rebind reads a prior/next field only when it is an own property, avoiding inherited getters for absent fields. Source-owned capture still must establish safe completed payloads; this does not authorize reading live accessors during delivery.

## Validation

`node --test /private/tmp/st-native-lossless-model/model.test.mjs`: 23 pass (18 preserved cases with address representation migrated; 5 new controls). Controls cover delimiter collisions in render and rebind, opaque-token and numeric/string identities, canonical field identity, __proto__ output, and absent inherited getter. No desired proof or native settlement oracle changed. Source/native regressions were not rerun because runtime is unchanged.

Review handoff: this supersedes only the address/output-construction portion of the model already sent to Faraday. Prior SOURCE-MAPPING and native outcomes remain applicable. Runtime remains gated pending independent algorithm review and Main authorization.
