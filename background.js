// Keeps the toolbar badge honest. The overlay is injected per-tab by the popup;
// a page reload/navigation wipes it, so clear that tab's badge when it reloads.
// (The popup sets the badge when it activates the overlay on a tab.)

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#2b6ef2" });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#2b6ef2" });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.action.setBadgeText({ tabId, text: "" });
  }
});
