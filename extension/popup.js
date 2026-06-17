// DOM elements
const panels = {
  unsupported: document.getElementById("panel-unsupported"),
  ready: document.getElementById("panel-ready"),
  loading: document.getElementById("panel-loading"),
  success: document.getElementById("panel-success")
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

// State
let activeTabId = null;
let currentCourseData = null;
let activeFormat = "markdown";
let spinnerInterval = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  
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
            "extractors/youtube.js",
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
        }
      } catch (injectErr) {
        console.error("Failed to inject content script:", injectErr);
        stopSpinner();
        showPanel("unsupported");
      }
    }
  } else {
    showPanel("unsupported");
  }
});

// Event Listeners
btnExtract.addEventListener("click", startExtraction);
tabBtnMarkdown.addEventListener("click", () => switchTab("markdown"));
tabBtnJson.addEventListener("click", () => switchTab("json"));
tabBtnAi.addEventListener("click", () => switchTab("ai"));
btnCopy.addEventListener("click", copyToClipboard);

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
  return isUdemyUrl(url) || isYouTubeUrl(url);
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
        readyStatusTitle.textContent = "YOUTUBE PLAYLIST DETECTED";
      } else {
        readyStatusTitle.textContent = "UDEMY COURSE DETECTED";
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
      { text: "Scanning elements...", pct: 50 },
      { text: "Reading playlist/curriculum...", pct: 75 },
      { text: "Analyzing progress state...", pct: 90 }
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
      alert("Extraction Error: " + errMsg);
      showReadyState(activeTabId);
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
  successCourseInstructor.textContent = `by ${data.instructor}`;
  statDuration.textContent = data.duration;
  statSections.textContent = data.sectionsCount;
  statLectures.textContent = data.lecturesCount;
  
  // Update UI Labels depending on platform
  if (data.platform === "youtube") {
    labelSections.textContent = "[ SECTIONS ]";
    labelLectures.textContent = "[ VIDEOS ]";
  } else {
    labelSections.textContent = "[ SECTIONS ]";
    labelLectures.textContent = "[ LECTURES ]";
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
