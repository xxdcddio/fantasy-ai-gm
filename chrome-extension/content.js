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

    // URL is the reliable signal; check matchup/players before the team
    // heuristic, since every page's body contains "my team" / "roster" nav text.
    if (url.includes("/matchup")) return "matchup";
    if (url.includes("/players")) return "free_agents";
    if (url.includes("/team") || body.includes("my team") || body.includes("roster")) return "team";
    if (body.includes("matchup")) return "matchup";
    if (body.includes("free agents")) return "free_agents";
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

  // Matchup header / sidebar data (week, both teams' name/manager/record,
  // games played & remaining). This lives OUTSIDE the stat table, so it is
  // scraped by text/URL patterns with null/"" fallbacks — never faked.
  // Heuristics are order-based (first team block = mine, second = opponent);
  // verify against a real export and tighten selectors if Yahoo's DOM differs.
  // Nav/button labels that link to a team URL but aren't the team's name.
  const GENERIC_TEAM_LABELS = new Set([
    "", "my team", "watch list", "matchup", "matchups", "view profile", "profile",
    "compare managers", "compare my team", "scoreboard", "standings", "edit",
    "research", "research assistant", "trade hub", "players", "start active players",
    "add player", "drop player"
  ]);
  const isGeneric = (s) => GENERIC_TEAM_LABELS.has(String(s).trim().toLowerCase());

  const extractMatchupHeader = () => {
    const bodyText = text(document.body);
    const leagueId = (window.location.href.match(/\/b1\/(\d+)\//) || [])[1] || "";

    const week = (bodyText.match(/\bWeek\s+\d+\b/) || [""])[0];

    // Team links /b1/<league>/<teamId>. Many links share an id (nav aliases
    // like "My Team" / "Watch List", an empty logo link, the real name). The
    // real team name recurs across header + standings, so pick the most frequent
    // non-generic label per id.
    const counts = new Map();
    const order = [];
    Array.from(document.querySelectorAll("a[href]")).forEach((a) => {
      const m = absoluteUrl(attr(a, "href")).match(/\/b1\/\d+\/(\d+)(?:[/?#]|$)/);
      if (!m) return;
      const id = m[1];
      if (!counts.has(id)) { counts.set(id, new Map()); order.push(id); }
      const name = text(a);
      if (name && !isGeneric(name)) {
        const c = counts.get(id);
        c.set(name, (c.get(name) || 0) + 1);
      }
    });
    const pickName = (id) => {
      const c = counts.get(id);
      if (!c || !c.size) return "";
      return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };
    const teams = order.map((id) => ({ id, name: pickName(id) }));

    // Manager: prefer profile links (text is the manager name), else fall back
    // to the "<name> View Profile" label shown in the compare panel. May be ""
    // when neither is present in the DOM (compare panel not expanded).
    const profileManagers = Array.from(
      document.querySelectorAll("a[href*='profiles.sports.yahoo.com/user'], a[href*='/users/']")
    ).map(text).filter((n) => n && !isGeneric(n));
    const viaLabel = (bodyText.match(/(\S+)\s+View Profile/g) || [])
      .map((s) => s.replace(/\s+View Profile$/, "").trim())
      .filter((n) => n && !isGeneric(n));
    const managers = profileManagers.length >= 2 ? profileManagers : viaLabel;

    // Records like "101-89-6"; drop date-like groups (e.g. 2026-06-29).
    const records = (bodyText.match(/\b\d{1,3}-\d{1,3}-\d{1,3}\b/g) || []).filter((r) =>
      r.split("-").every((n) => n.length <= 3)
    );

    // "0/113" => played / total. Require total >= 50 so dates ("6/29") and
    // category scores don't get mistaken for game counts.
    const games = (bodyText.match(/(\d+)\s*\/\s*(\d+)/g) || [])
      .map((g) => g.split("/").map((n) => parseInt(n.trim(), 10)))
      .filter(([, total]) => total >= 50)
      .map(([played, total]) => ({ played, total, remaining: total - played }));

    const teamAt = (i) => ({
      id: teams[i]?.id || "",
      name: teams[i]?.name || "",
      manager: managers[i] || "",
      record: records[i] || "",
      gamesPlayed: games[i] ? games[i].played : null,
      remainingGames: games[i] ? games[i].remaining : null
    });

    return {
      leagueId,
      week,
      teams: { mine: teamAt(0), opponent: teamAt(1) }
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
      matchupHeader: null,
      freeAgents: []
    };

    // Matchup pages keep the raw stat rows in `roster` (the Sprint 7 parser
    // reads them) AND gain `matchupHeader` for the off-table meta.
    if (kind === "team" || kind === "matchup" || kind === "unknown") output.roster = extractRoster();
    if (kind === "matchup" || kind === "unknown") output.matchup = extractMatchup();
    if (kind === "matchup") output.matchupHeader = extractMatchupHeader();
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
