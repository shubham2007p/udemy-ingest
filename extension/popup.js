// DOM elements
const panels = {
  unsupported: document.getElementById("panel-unsupported"),
  ready: document.getElementById("panel-ready"),
  loading: document.getElementById("panel-loading"),
  success: document.getElementById("panel-success"),
  settings: document.getElementById("panel-settings")
};

const readyCourseTitle = document.getElementById("ready-course-title");
const readyStatusTitle = document.getElementById("ready-status-title");
const btnExtract = document.getElementById("btn-extract");
const loadingStatus = document.getElementById("loading-status");
const extractionProgress = document.getElementById("extraction-progress");
const spinnerEl = document.getElementById("ascii-spinner");

const successCourseTitle = document.getElementById("success-course-title");
const successCourseInstructor = document.getElementById("success-course-instructor");
const statDuration = document.getElementById("stat-duration");
const statSections = document.getElementById("stat-sections");
const statLectures = document.getElementById("stat-lectures");

const labelSections = document.getElementById("label-sections");
const labelLectures = document.getElementById("label-lectures");

const tabBtnMarkdown = document.getElementById("tab-btn-markdown");
const tabBtnJson = document.getElementById("tab-btn-json");
const tabBtnAi = document.getElementById("tab-btn-ai");
const outputView = document.getElementById("output-view");
const btnCopy = document.getElementById("btn-copy");
const copyText = document.getElementById("copy-text");

// Settings DOM elements
const btnSettingsToggle = document.getElementById("btn-settings-toggle");
const inputApiKey = document.getElementById("input-api-key");
const btnSaveSettings = document.getElementById("btn-save-settings");
const btnCancelSettings = document.getElementById("btn-cancel-settings");

// Universal Ingestion DOM elements
const labelDuration = document.getElementById("label-duration");
const inputUniversalUrl = document.getElementById("input-universal-url");
const btnIngestActive = document.getElementById("btn-ingest-active");
const btnIngestUrl = document.getElementById("btn-ingest-url");
const unsupportedDetectedPage = document.getElementById("unsupported-detected-page");
const activeTabIngestContainer = document.getElementById("active-tab-ingest-container");

// State
let activeTabId = null;
let currentCourseData = null;
let activeFormat = "markdown";
let spinnerInterval = null;
let previousPanel = "unsupported";

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (btnIngestActive) {
    btnIngestActive.addEventListener("click", () => {
      if (tab && isSupportedUrl(tab.url)) {
        startExtraction();
      }
    });
  }
  if (btnIngestUrl) {
    btnIngestUrl.addEventListener("click", runManualUrlIngestion);
  }

  // Initial load of settings key
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("youtubeApiKey", (res) => {
      inputApiKey.value = res.youtubeApiKey || "";
    });
  }

  if (!tab) {
    showPanel("unsupported");
    if (unsupportedDetectedPage) unsupportedDetectedPage.textContent = "No active window/tab";
    if (activeTabIngestContainer) activeTabIngestContainer.classList.add("hidden");
    return;
  }
  
  activeTabId = tab.id;

  if (isSupportedUrl(tab.url)) {
    showPanel("loading");
    startSpinner();
    updateProgress("Checking page state...", 20);
    
    // Check if content script is loaded
    try {
      const response = await pingContentScript(tab.id);
      if (response && response.status === "ready") {
        updateProgress("Content script connected.", 60);
        stopSpinner();
        showReadyState(tab.id);
      } else {
        throw new Error("Content script not responding");
      }
    } catch (err) {
      // Content script is not loaded yet, inject it manually
      updateProgress("Injecting content script...", 50);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            "schemas/learningSchema.js",
            "extractors/udemy.js",
            "youtubeApi.js",
            "playlistService.js",
            "videoService.js",
            "pageStateExtractor.js",
            "extractors/youtube.js",
            "extractors/universal.js",
            "content.js"
          ]
        });
        await new Promise(r => setTimeout(r, 200));
        const response = await pingContentScript(tab.id);
        if (response && response.status === "ready") {
          stopSpinner();
          showReadyState(tab.id);
        } else {
          stopSpinner();
          showPanel("unsupported");
          setupUnsupportedPanelForTab(tab);
        }
      } catch (injectErr) {
        console.error("Failed to inject content script:", injectErr);
        stopSpinner();
        showPanel("unsupported");
        setupUnsupportedPanelForTab(tab);
      }
    }
  } else {
    showPanel("unsupported");
    setupUnsupportedPanelForTab(tab);
  }
});

// Event Listeners
btnExtract.addEventListener("click", startExtraction);
tabBtnMarkdown.addEventListener("click", () => switchTab("markdown"));
tabBtnJson.addEventListener("click", () => switchTab("json"));
tabBtnAi.addEventListener("click", () => switchTab("ai"));
btnCopy.addEventListener("click", copyToClipboard);

btnSettingsToggle.addEventListener("click", () => {
  const currentActivePanel = Object.keys(panels).find(key => !panels[key].classList.contains("hidden") && key !== "settings");
  if (currentActivePanel) {
    previousPanel = currentActivePanel;
  }
  
  if (!panels.settings.classList.contains("hidden")) {
    showPanel(previousPanel);
  } else {
    showPanel("settings");
  }
});

btnSaveSettings.addEventListener("click", () => {
  const key = inputApiKey.value.trim();
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ youtubeApiKey: key }, () => {
      showPanel(previousPanel);
    });
  } else {
    showPanel(previousPanel);
  }
});

btnCancelSettings.addEventListener("click", () => {
  showPanel(previousPanel);
});

// Helpers
function isUdemyUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const path = urlObj.pathname;
    return host.includes("udemy.com") && (path.includes("/course/") || path.includes("/learn/"));
  } catch (e) {
    return false;
  }
}

function isYouTubeUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    const path = urlObj.pathname;
    const params = urlObj.searchParams;
    return host.includes("youtube.com") && 
           (path.includes("/playlist") || 
            (path.includes("/watch") && (params.has("list") || params.has("v"))));
  } catch (e) {
    return false;
  }
}

function isSupportedUrl(url) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

function setupUnsupportedPanelForTab(tab) {
  if (!unsupportedDetectedPage) return;
  if (tab) {
    let displayTitle = tab.title || "Untitled Page";
    let displayHost = "local";
    try {
      displayHost = new URL(tab.url).hostname;
    } catch(e) {}
    unsupportedDetectedPage.textContent = `${displayTitle} (${displayHost})`;
    
    const isSystem = !tab.url.startsWith("http://") && !tab.url.startsWith("https://");
    if (isSystem) {
      unsupportedDetectedPage.textContent += " [SYSTEM PAGE - NOT INGESTIBLE]";
      if (btnIngestActive) btnIngestActive.disabled = true;
    } else {
      if (btnIngestActive) btnIngestActive.disabled = false;
    }
  } else {
    unsupportedDetectedPage.textContent = "No active page detected";
    if (btnIngestActive) btnIngestActive.disabled = true;
  }
}

async function runManualUrlIngestion() {
  const url = inputUniversalUrl.value.trim();
  if (!url) {
    alert("Please enter a valid URL.");
    return;
  }
  
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    alert("URL must start with http:// or https://");
    return;
  }

  showPanel("loading");
  startSpinner();
  updateProgress("Downloading webpage HTML...", 20);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    
    updateProgress("Parsing DOM...", 50);
    const htmlText = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    
    updateProgress("Extracting content...", 85);
    
    // Execute extractor directly in popup sandbox
    const data = UniversalExtractor.extract(doc, url);
    
    updateProgress("Formatting output...", 95);
    setTimeout(() => {
      stopSpinner();
      displaySuccess(data);
    }, 300);
  } catch (err) {
    stopSpinner();
    alert(`Ingestion failed: ${err.message}`);
    showPanel("unsupported");
  }
}

function showPanel(panelName) {
  Object.keys(panels).forEach(name => {
    if (name === panelName) {
      panels[name].classList.remove("hidden");
    } else {
      panels[name].classList.add("hidden");
    }
  });
}

function updateProgress(status, pct) {
  loadingStatus.textContent = status;
  extractionProgress.style.width = pct + "%";
}

// ASCII Spinner Animation
function startSpinner() {
  if (spinnerInterval) clearInterval(spinnerInterval);
  const chars = ["/", "-", "\\", "|"];
  let idx = 0;
  spinnerInterval = setInterval(() => {
    if (spinnerEl) {
      spinnerEl.textContent = chars[idx];
      idx = (idx + 1) % chars.length;
    }
  }, 120);
}

function stopSpinner() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
}

async function pingContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

async function showReadyState(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "getCourseInfo" }, (response) => {
    showPanel("ready");
    if (response && response.isSupported) {
      readyCourseTitle.textContent = response.title;
      if (response.platform === "youtube") {
        if (response.type === "video") {
          readyStatusTitle.textContent = "YOUTUBE VIDEO DETECTED";
        } else {
          readyStatusTitle.textContent = "YOUTUBE PLAYLIST DETECTED";
        }
      } else if (response.platform === "udemy") {
        readyStatusTitle.textContent = "UDEMY COURSE DETECTED";
      } else {
        readyStatusTitle.textContent = "WEBPAGE DETECTED";
      }
    } else {
      readyCourseTitle.textContent = "Course Page";
      readyStatusTitle.textContent = "LEARNING PAGE DETECTED";
    }
  });
}

async function startExtraction() {
  showPanel("loading");
  startSpinner();
  updateProgress("Extracting details...", 30);
  
  const statusInterval = setInterval(() => {
    const statuses = [
      { text: "Connecting to API...", pct: 50 },
      { text: "Fetching resource details...", pct: 75 },
      { text: "Consolidating page state...", pct: 90 }
    ];
    const currentPct = parseInt(extractionProgress.style.width, 10);
    const nextStatus = statuses.find(s => s.pct > currentPct);
    if (nextStatus) {
      updateProgress(nextStatus.text, nextStatus.pct);
    }
  }, 800);

  chrome.tabs.sendMessage(activeTabId, { action: "extractCourseData" }, (response) => {
    clearInterval(statusInterval);
    stopSpinner();
    if (chrome.runtime.lastError || !response || !response.success) {
      const errMsg = (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "Failed to extract";
      
      if (errMsg === "YOUTUBE_API_KEY_MISSING" || errMsg === "YOUTUBE_API_KEY_INVALID") {
        alert(errMsg === "YOUTUBE_API_KEY_MISSING" ? "YouTube API Key is missing. Opening settings..." : "YouTube API Key is invalid. Opening settings...");
        previousPanel = "ready";
        showPanel("settings");
      } else {
        alert("Extraction Error: " + errMsg);
        showReadyState(activeTabId);
      }
      return;
    }
    
    updateProgress("Formatting data...", 95);
    setTimeout(() => {
      displaySuccess(response.data);
    }, 300);
  });
}

function displaySuccess(data) {
  currentCourseData = data;
  
  // Set metadata
  successCourseTitle.textContent = data.title;
  
  if (data.platform === "universal") {
    successCourseInstructor.textContent = `from ${data.domain || data.url}`;
    if (labelDuration) labelDuration.textContent = "[ WORDS ]";
    statDuration.textContent = data.stats.wordCount;
    labelSections.textContent = "[ SECTIONS ]";
    statSections.textContent = data.stats.sectionCount;
    labelLectures.textContent = "[ LINKS ]";
    statLectures.textContent = data.stats.linkCount;
  } else {
    successCourseInstructor.textContent = `by ${data.instructor}`;
    if (labelDuration) labelDuration.textContent = "[ DURATION ]";
    statDuration.textContent = data.duration;
    
    // Update UI Labels depending on platform and type
    if (data.platform === "youtube") {
      if (data.type === "video") {
        labelSections.textContent = "[ CHAPTERS ]";
        labelLectures.textContent = "[ VIDEOS ]";
      } else {
        labelSections.textContent = "[ SECTIONS ]";
        labelLectures.textContent = "[ VIDEOS ]";
      }
    } else {
      labelSections.textContent = "[ SECTIONS ]";
      labelLectures.textContent = "[ LECTURES ]";
    }
    statSections.textContent = data.sectionsCount;
    statLectures.textContent = data.lecturesCount;
  }
  
  // Set output
  switchTab("markdown");
  showPanel("success");
}

function switchTab(format) {
  activeFormat = format;
  
  tabBtnMarkdown.classList.toggle("active", format === "markdown");
  tabBtnJson.classList.toggle("active", format === "json");
  tabBtnAi.classList.toggle("active", format === "ai");
  
  if (!currentCourseData) return;
  
  if (format === "markdown") {
    outputView.textContent = MarkdownGenerator.generate(currentCourseData);
  } else if (format === "json") {
    outputView.textContent = JsonGenerator.generate(currentCourseData);
  } else if (format === "ai") {
    outputView.textContent = AiContextGenerator.generate(currentCourseData);
  }
}

function copyToClipboard() {
  const text = outputView.textContent;
  if (!text) return;
  
  navigator.clipboard.writeText(text).then(() => {
    btnCopy.classList.add("success");
    copyText.textContent = "[ COPIED! ]";
    
    setTimeout(() => {
      btnCopy.classList.remove("success");
      copyText.textContent = "[ COPY TO CLIPBOARD ]";
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy text: ", err);
    alert("Could not copy. Please select text manually.");
  });
}
