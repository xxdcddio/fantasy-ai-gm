const statusEl = document.querySelector("#status");
const outputEl = document.querySelector("#output");
const refreshButton = document.querySelector("#refresh");
const copyButton = document.querySelector("#copy");
const downloadButton = document.querySelector("#download");

let latestJson = "";
let latestKind = "";

// Download filename per page kind; the user moves it into data/samples/.
const DOWNLOAD_NAMES = {
  team: "team.json",
  free_agents: "free-agents.json",
  matchup: "matchup.json"
};

const downloadName = () => DOWNLOAD_NAMES[latestKind] || "yahoo-export.json";

const setStatus = (message) => {
  statusEl.textContent = message;
};

const setOutput = (data) => {
  latestJson = JSON.stringify(data, null, 2);
  latestKind = data?.page?.kind || "";
  outputEl.textContent = latestJson;
  copyButton.disabled = !latestJson;
  downloadButton.disabled = !latestJson;
};

const currentTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const injectContentScript = async (tabId) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
};

const extract = async () => {
  setStatus("Extracting Yahoo Fantasy MLB data...");

  try {
    const tab = await currentTab();

    if (!tab?.id || !tab.url?.includes("fantasysports.yahoo.com")) {
      throw new Error("This tab is not a Yahoo Fantasy page.");
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "FANTASY_MLB_AI_EXTRACT" });
    } catch {
      await injectContentScript(tab.id);
      response = await chrome.tabs.sendMessage(tab.id, { type: "FANTASY_MLB_AI_EXTRACT" });
    }

    if (!response?.ok) throw new Error(response?.error || "Could not extract this page.");

    setOutput(response.data);
    setStatus(
      `Extracted ${response.data.roster.length} roster rows and ${response.data.freeAgents.length} FA rows. ` +
        `Download saves as ${downloadName()}.`
    );
  } catch (error) {
    latestJson = "";
    latestKind = "";
    outputEl.textContent = "";
    copyButton.disabled = true;
    downloadButton.disabled = true;
    setStatus(error instanceof Error ? error.message : String(error));
  }
};

const copyJson = async () => {
  await navigator.clipboard.writeText(latestJson);
  setStatus("JSON copied.");
};

const downloadJson = () => {
  const blob = new Blob([latestJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName();
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${downloadName()} — move it into data/samples/.`);
};

refreshButton.addEventListener("click", extract);
copyButton.addEventListener("click", copyJson);
downloadButton.addEventListener("click", downloadJson);

extract();
