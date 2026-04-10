---
name: bonfire:render
description: "Manually trigger a full render of all bundle markdown from current JSON state. Use when markdown is out of sync."
argument-hint: "[--note <note-id>] [--run <run-id>]"
---

<objective>
Re-render all bundle markdown files from the current JSON sources. Use this when markdown output is stale or after manual JSON edits.
</objective>

<process>

1. If `--note` is specified:
   ```
   bonfire-tools.cjs render --note <note-id>
   ```

2. If `--run` and `--note` are specified:
   ```
   bonfire-tools.cjs render --run <run-id> --note <note-id>
   ```

3. If no arguments (full render):
   ```
   bonfire-tools.cjs render --all
   ```

4. Check for stale output:
   ```
   bonfire-tools.cjs render-check
   ```

5. Report results to user: which notes were rendered, any that failed.

</process>