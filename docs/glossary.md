# Glossary

SignalTree has three vocabularies. You only need the first one to build an
application. The others exist so that precision is available when you want it,
not so that you have to learn them first.

The rule this project follows: **behaviour first, name second.** If you meet a
term here before you have met the behaviour it describes, that is a
documentation bug — please report it.

## 1. Everyday vocabulary

This is enough to build a serious application.

| Term                | What it means                                                                |
| ------------------- | ---------------------------------------------------------------------------- |
| **state**           | The object you pass to `signalTree()`.                                        |
| **field**           | One readable, writable value in that object, at a typed path.                 |
| **entity**          | One record in a collection created with `entityMap()`.                        |
| **entity ID**       | The key that identifies a record within its collection.                       |
| **write**           | Your application changing a value.                                            |
| **external update** | A value arriving from outside — a server response, another client, storage.   |
| **transaction**     | A group of changes applied together, which can be rolled back.                |
| **rollback**        | Undoing a transaction that has not been confirmed.                            |
| **undo / redo**     | Reversing or reapplying an operation you marked with `undoable()`.            |
| **linked state**    | Part of the tree bound to a source outside it with `link()`.                  |

## 2. Advanced vocabulary

These appear when the documentation explains *why* SignalTree behaves
differently from plain framework state. Each one is introduced by its behaviour
first.

| Behaviour                                                                                | Term                  |
| ---------------------------------------------------------------------------------------- | --------------------- |
| Remove a record and add another with the same ID; a reference you held does not follow it. | **entity lifetime**   |
| Your application changed this value.                                                       | **authored write**    |
| Something outside the application established this value.                                  | **realized update**   |
| These changes happened together and are undone together.                                   | **causal turn**       |
| Bringing back an earlier value so that it revives the same record rather than a lookalike. | **restoration**       |
| What the tree keeps so an earlier state can be restored.                                   | **retained history**  |

## 3. Architecture and adapter vocabulary

You will not meet these in application code. They belong to the kernel, the
adapter SDK and the architecture records. They are listed here so that if you
do encounter one — in an architecture document, an error message, or a
contribution — you can translate it back into something familiar.

| Everyday idea                       | Internal term                       |
| ----------------------------------- | ----------------------------------- |
| One existence of an entity          | `SubjectId` / subject lifetime      |
| Where a value sits in the tree      | `PositionId`                        |
| Which tree owns this               | `ownerId`                           |
| The current value of an entity      | `EntityValueStore`                  |
| The shape of a collection           | `StructuralStore`                   |
| How a framework is told to re-read  | `EpochHandle`, `ObservationToken`   |
| How a value becomes framework-native | realization carrier                |
| Marking a write as undoable          | restoration designation             |

### A note on the word *subject*

Internally, **subject** means one existence of an entity — the thing that stops
a held reference from silently following a different record that happens to
reuse the same ID.

That is accurate, but RxJS has already claimed the word for Angular developers,
and a `Subject` in an Angular codebase means something else entirely. So public
documentation says **entity lifetime**. `SubjectId` remains the internal name
and appears in architecture material.

## Related

- [Why SignalTree?](why-signaltree.md) — whether this is a fit at all
- [Support policy](support-policy.md) — versioning, framework maturity, supported lines
- [Architecture guide](architecture/signaltree-architecture-guide.md) — where the third vocabulary is the working language
