# Downstream agent setup

Point the application's instructions to the installed SignalTree framework
package README/types and [the consumer reference](LLM.md). Add only application
facts: package version, store ownership, supported workflows and local commands.

Do not copy a versioned tutorial into every application's system instructions;
it drifts independently of the installed package. [llms.txt](../../llms.txt)
contains the maintained examples. App-specific architecture remains the app's
responsibility; a SignalTree recipe does not establish its server guarantees.
