// Parse the Yahoo matchup page (extension export) into a structured matchup
// object. Parsing only — no scoring, streaming, or AI logic.
//
// Inputs come from two places in the export:
//   - matchupHeader  -> week + both teams' name/manager/record/games
//   - roster[] table -> score row + category header row + two team value rows

const PITCHING_DIVIDER = "IP*"; // first pitching column; also marks the hitting/pitching split
const LOWER_IS_BETTER = new Set(["ERA", "WHIP"]);

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const toNum = (value) => {
  const s = clean(value).replace(/%/g, "");
  if (s === "" || s === "-" || s === "-/-") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

const cells = (row) => (Array.isArray(row?.cells) ? row.cells : []);
const cellText = (row, i) => clean(cells(row)[i]?.text);

// Team summary rows link to /b1/<league>/<teamId>; player rows link to /mlb/players/.
const teamIdOf = (row) => {
  const link = (row.links || []).find((l) => /\/b1\/\d+\/\d+$/.test(l.href || ""));
  const m = link && link.href.match(/\/(\d+)$/);
  return m ? m[1] : "";
};

const parseScore = (rows) => {
  const row = rows.find((r) => /^\s*\d+\s*vs\s*\d+\s*$/i.test(clean(r.name)));
  const nums = row ? clean(row.name).match(/\d+/g) || [] : [];
  return {
    mine: nums[0] != null ? Number(nums[0]) : null,
    opponent: nums[1] != null ? Number(nums[1]) : null
  };
};

const leaderOf = (mine, opponent, lowerIsBetter) => {
  if (mine == null || opponent == null) return "none";
  if (mine === opponent) return "tied";
  const mineBetter = lowerIsBetter ? mine < opponent : mine > opponent;
  return mineBetter ? "mine" : "opponent";
};

const parseCategories = (rows, header) => {
  const headerRow = rows.find((r) => cellText(r, 0) === "Team");
  const teamRows = rows.filter((r) => teamIdOf(r));
  if (!headerRow || teamRows.length < 2) return [];

  const myRow = teamRows.find((r) => teamIdOf(r) === header?.teams?.mine?.id) || teamRows[0];
  const oppRow = teamRows.find((r) => teamIdOf(r) === header?.teams?.opponent?.id) || teamRows[1];

  const categories = [];
  let type = "hitting";

  cells(headerRow).forEach((cell, i) => {
    if (i === 0) return; // "Team" label column
    const name = clean(cell.text);
    if (!name) return; // trailing spacer
    if (name.endsWith("*")) {
      if (name === PITCHING_DIVIDER) type = "pitching"; // non-scoring column; also the split point
      return;
    }

    const mine = toNum(cellText(myRow, i));
    const opponent = toNum(cellText(oppRow, i));
    const lowerIsBetter = LOWER_IS_BETTER.has(name);

    const category = { name, type, mine, opponent };
    if (lowerIsBetter) category.lowerIsBetter = true;
    category.leader = leaderOf(mine, opponent, lowerIsBetter);
    categories.push(category);
  });

  return categories;
};

const team = (t) => ({
  name: t?.name || "",
  manager: t?.manager || "",
  record: t?.record || "",
  gamesPlayed: t?.gamesPlayed ?? null,
  remainingGames: t?.remainingGames ?? null
});

const parseMatchup = (json) => {
  const rows = Array.isArray(json?.roster) ? json.roster : [];
  const header = json?.matchupHeader || null;

  return {
    week: header?.week || "",
    score: parseScore(rows),
    teams: {
      mine: team(header?.teams?.mine),
      opponent: team(header?.teams?.opponent)
    },
    categories: parseCategories(rows, header)
  };
};

module.exports = { parseMatchup, parseCategories, parseScore };
