# Architecture

Fantasy AI GM is organized as a modular workspace so browser extraction, analysis logic, backend services, prompts, and documentation can evolve independently.

No AI functionality is implemented in this architecture pass.

## Modules

```text
Yahoo Fantasy pages
        |
        v
chrome-extension
        |
        v
JSON output
        |
        v
future analyzer / server modules
```

## `chrome-extension`

The Chrome Extension is the only active runtime module today.

Responsibilities:

- Run as a Manifest V3 Chrome Extension
- Read Yahoo Fantasy MLB page DOM
- Extract roster, matchup, and free-agent data
- Display JSON in the popup
- Allow JSON copy/download from the browser

The extractor should remain focused on page reading and JSON output. It should not contain scoring, recommendation, or AI decision logic.

## `analyzer`

Future module for deterministic fantasy sports analysis.

Potential responsibilities:

- Normalize extracted JSON
- Compare players and teams
- Calculate category impact
- Support MLB and NBA-specific analysis pipelines
- Provide testable data transformations

## `server`

Future module for an API or service layer.

Potential responsibilities:

- Receive JSON from the extension
- Persist league/team snapshots
- Serve analyzer results to a frontend or extension
- Provide integration boundaries for future MLB and NBA workflows

## `prompts`

Future module for prompt assets.

Potential responsibilities:

- Store prompt templates
- Document prompt inputs and outputs
- Separate sport-specific prompt variants

Prompt files should be added only when AI functionality is intentionally introduced.

## `docs`

Supporting project documentation.

Potential responsibilities:

- Product notes
- Integration notes
- Data model notes
- League settings references
- Manual QA notes

## Design Principles

- Keep extraction separate from analysis.
- Keep AI prompts separate from deterministic code.
- Support MLB first without blocking future NBA expansion.
- Preserve raw extracted JSON so future analyzers can be tested against real browser output.
- Prefer small modules with clear input/output contracts.
