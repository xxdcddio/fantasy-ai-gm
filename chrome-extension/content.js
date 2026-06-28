(() => {
  const EXTENSION_SOURCE = "fantasy-mlb-ai-yahoo-extractor";

  const text = (node) => (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();

  const attr = (node, name) => node?.getAttribute?.(name) || "";

  const normalizeKey = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const absoluteUrl = (href) => {
    if (!href) return "";
    try {
      return new URL(href, window.location.href).toString();
    } catch {
      return href;
    }
  };

  const visibleRows = (root = document) =>
    Array.from(root.querySelectorAll("table tbody tr, table tr")).filter((row) => {
      const rowText = text(row);
      return rowText && row.offsetParent !== null;
    });

  const extractTable = (table) => {
    const headers = Array.from(table.querySelectorAll("thead th, tr:first-child th, tr:first-child td")).map(text);
    const rows = Array.from(table.querySelectorAll("tbody tr, tr"))
      .filter((row) => text(row) && row.querySelectorAll("td, th").length > 1)
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td, th")).map(text);
        const record = {};

        cells.forEach((cell, index) => {
          const header = headers[index] || `column_${index + 1}`;
          const key = normalizeKey(header) || `column_${index + 1}`;
          record[key] = cell;
        });

        return record;
      });

    return rows.filter((row) => Object.values(row).some(Boolean));
  };

  const playerNameFromRow = (row) => {
    const candidate =
      row.querySelector("[data-player-name]") ||
      row.querySelector("a[href*='/player/']") ||
      row.querySelector("a[href*='players?']") ||
      row.querySelector(".ysf-player-name") ||
      row.querySelector(".Nowrap a");

    const candidateText = text(candidate);
    if (candidateText) return candidateText;

    const rowText = text(row);
    const pieces = rowText.split(/\s{2,}| - |, /).filter(Boolean);
    return pieces[0] || rowText;
  };

  const parsePlayerRow = (row) => {
    const cells = Array.from(row.querySelectorAll("td, th")).map((cell) => ({
      text: text(cell),
      className: attr(cell, "class")
    }));

    const links = Array.from(row.querySelectorAll("a[href]")).map((link) => ({
      text: text(link),
      href: absoluteUrl(attr(link, "href"))
    }));

    const positionCell =
      row.querySelector("[data-position]") ||
      row.querySelector(".pos") ||
      row.querySelector("td:nth-child(1)");

    const teamCell =
      row.querySelector("[data-team]") ||
      row.querySelector(".team") ||
      row.querySelector("td:nth-child(3)");

    return {
      name: playerNameFromRow(row),
      position: attr(positionCell, "data-position") || text(positionCell),
      team: attr(teamCell, "data-team") || text(teamCell),
      raw: text(row),
      cells,
      links
    };
  };

  const pageKind = () => {
    const url = window.location.href.toLowerCase();
    const body = text(document.body).toLowerCase();

    if (url.includes("/team") || body.includes("my team") || body.includes("roster")) return "team";
    if (url.includes("/matchup") || body.includes("matchup")) return "matchup";
    if (url.includes("/players") || body.includes("players") || body.includes("free agents")) return "free_agents";
    return "unknown";
  };

  const extractRoster = () => {
    const rosterRoots = Array.from(
      document.querySelectorAll(
        "#statTable0, #statTable1, table.Table, table, [data-test='roster-table'], [id*='roster'], [class*='roster']"
      )
    );

    const rows = rosterRoots.flatMap((root) => visibleRows(root));
    const uniqueRows = Array.from(new Set(rows));

    return uniqueRows
      .map(parsePlayerRow)
      .filter((player) => player.name && !/^pos\b|^player\b|^batters\b|^pitchers\b/i.test(player.name));
  };

  const extractMatchup = () => {
    const scoreboardTables = Array.from(
      document.querySelectorAll("table, [id*='matchup'], [class*='matchup'], [class*='scoreboard']")
    );

    const tables = scoreboardTables
      .filter((node) => text(node).match(/RBI|HR|ERA|WHIP|AVG|R|SB|W|SV|K|IP|Matchup|Total/i))
      .map((table) => ({
        label: attr(table, "aria-label") || attr(table, "id") || attr(table, "class") || table.tagName.toLowerCase(),
        rows: table.tagName?.toLowerCase() === "table" ? extractTable(table) : visibleRows(table).map(parsePlayerRow)
      }))
      .filter((table) => table.rows.length);

    const teams = Array.from(document.querySelectorAll("a[href*='/team/'], [class*='team-name'], [data-team-name]"))
      .map((node) => text(node) || attr(node, "data-team-name"))
      .filter(Boolean);

    return {
      teams: Array.from(new Set(teams)),
      tables
    };
  };

  const extractFreeAgents = () => {
    const rows = visibleRows(document)
      .filter((row) => {
        const rowText = text(row);
        return rowText && !/^player\s+team\s+pos/i.test(rowText);
      })
      .map(parsePlayerRow)
      .filter((player) => player.name && player.raw.match(/\b(FA|Waivers|Add|\+|Player Note|Pre-Season|Today|Tomorrow)\b/i));

    return rows;
  };

  const extractYahooFantasyJson = () => {
    const kind = pageKind();
    const output = {
      source: EXTENSION_SOURCE,
      extractedAt: new Date().toISOString(),
      page: {
        kind,
        title: document.title,
        url: window.location.href
      },
      roster: [],
      matchup: null,
      freeAgents: []
    };

    if (kind === "team" || kind === "unknown") output.roster = extractRoster();
    if (kind === "matchup" || kind === "unknown") output.matchup = extractMatchup();
    if (kind === "free_agents" || kind === "unknown") output.freeAgents = extractFreeAgents();

    return output;
  };

  window.fantasyMlbAiExtract = extractYahooFantasyJson;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "FANTASY_MLB_AI_EXTRACT") return false;

    try {
      sendResponse({ ok: true, data: extractYahooFantasyJson() });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return true;
  });
})();
