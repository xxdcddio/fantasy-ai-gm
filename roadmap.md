# Roadmap

This roadmap organizes future work without adding AI features in the current project structure pass.

## Phase 1: Project Foundation

- Keep the existing Yahoo Fantasy MLB Chrome Extension working.
- Document the project purpose and architecture.
- Reserve module folders for analyzer, server, prompts, and docs.
- Keep extractor output as JSON.

## Phase 2: MLB Data Normalization

- Define a stable JSON schema for roster, matchup, and free-agent data.
- Add sample extracted JSON fixtures.
- Build deterministic parsers and validators in `analyzer`.
- Add tests around Yahoo page extraction outputs.

## Phase 3: MLB Analysis Layer

- Add category and roster analysis.
- Add player comparison utilities.
- Add matchup context calculations.
- Keep analysis deterministic and testable before introducing AI.

## Phase 4: Server/API Layer

- Create a local API for receiving extractor JSON.
- Add snapshot storage for teams, matchups, and free-agent lists.
- Expose analyzer results through simple endpoints.

## Phase 5: NBA Expansion

- Add NBA-specific extraction research.
- Define NBA roster, matchup, and player schemas.
- Reuse shared analyzer/server patterns where possible.
- Keep sport-specific logic isolated.

## Phase 6: Future AI GM Features

- Introduce prompt templates only after data schemas and deterministic analysis are stable.
- Add AI-assisted explanations and recommendations behind clear module boundaries.
- Preserve auditable raw data and deterministic calculations alongside any AI output.
