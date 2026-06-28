# Fantasy AI GM

Fantasy AI GM is a project workspace for building fantasy sports general-manager tools.

The current working module is a Yahoo Fantasy MLB Extractor Chrome Extension. It reads Yahoo Fantasy MLB pages in the browser and outputs structured JSON for roster, matchup, and free-agent page data.

This refactor only organizes the project for future expansion. It does not add AI features and does not change the existing extractor behavior.

## Current Capabilities

- Chrome Extension using Manifest V3
- Reads Yahoo Fantasy MLB pages
- Extracts roster data
- Extracts matchup data
- Extracts free-agent list data
- Outputs JSON from the extension popup

## Project Structure

```text
fantasy-mlb-ai
├── analyzer
├── chrome-extension
├── docs
├── prompts
├── server
├── architecture.md
├── roadmap.md
└── README.md
```

## Directory Purpose

### `chrome-extension`

Browser extension code for reading Yahoo Fantasy pages and exporting JSON. This folder currently contains the Yahoo Fantasy MLB Extractor.

### `analyzer`

Reserved for future data analysis logic. Later this can hold parsing, scoring, ranking, simulation, or recommendation modules for MLB and NBA fantasy data.

### `server`

Reserved for a future local or hosted API layer. Later this can connect the extension, analyzer, storage, and any user-facing applications.

### `prompts`

Reserved for future prompt templates and prompt documentation. No AI prompts are implemented yet.

### `docs`

Reserved for supporting project documentation, research notes, product specs, and integration notes.

## Documentation

- [Architecture](./architecture.md)
- [Roadmap](./roadmap.md)

## Local Chrome Extension Install

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select `chrome-extension`.
6. Open a Yahoo Fantasy MLB page and click the Fantasy AI GM extension.

## Scope Notes

This repository is structured to support both MLB and NBA Fantasy AI GM features in the future, but the current implementation remains limited to the existing Yahoo Fantasy MLB Extractor.
