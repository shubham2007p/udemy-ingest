// DOM elements
const panels = {
  unsupported: document.getElementById("panel-unsupported"),
  ready: document.getElementById("panel-ready"),
  loading: document.getElementById("panel-loading"),
  success: document.getElementById("panel-success")
};

const readyCourseTitle = document.getElementById("ready-course-title");
const btnExtract = document.getElementById("btn-extract");
const loadingStatus = document.getElementById("loading-status");
const extractionProgress = document.getElementById("extraction-progress");

const successCourseTitle = document.getElementById("success-course-title");
const successCourseInstructor = document.getElementById("success-course-instructor");
const statDuration = document.getElementById("stat-duration");
const statSections = document.getElementById("stat-sections");
const statLectures = document.getElementById("stat-lectures");

const tabBtnMarkdown = document.getElementById("tab-btn-markdown");
const tabBtnJson = document.getElementById("tab-btn-json");
const outputView = document.getElementById("output-view");
const btnCopy = document.getElementById("btn-copy");
const copyText = document.getElementById("copy-text");

// State
let activeTabId = null;
let currentCourseData = null;
let activeFormat = "markdown"; // or "json"

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  
  activeTabId = tab.id;
  
  if (isUdemyUrl(tab.url)) {
    showPanel("loading");
    updateProgress("Checking page state...", 20);
    
    // Check if content script is loaded
    try {
      const response = await pingContentScript(tab.id);
      if (response && response.status === "ready") {
        updateProgress("Content script connected.", 60);
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
          files: ["content.js"]
        });
        // Try pinging again
        await new Promise(r => setTimeout(r, 200));
        const response = await pingContentScript(tab.id);
        if (response && response.status === "ready") {
          showReadyState(tab.id);
        } else {
          showPanel("unsupported");
        }
      } catch (injectErr) {
        console.error("Failed to inject content script:", injectErr);
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
    if (response && response.title) {
      readyCourseTitle.textContent = response.title;
    } else {
      readyCourseTitle.textContent = "Udemy Course Page";
    }
  });
}

async function startExtraction() {
  showPanel("loading");
  updateProgress("Extracting course details...", 30);
  
  // Dynamic status text simulations
  const statusInterval = setInterval(() => {
    const statuses = [
      { text: "Scanning syllabus structure...", pct: 50 },
      { text: "Querying Udemy curriculum API...", pct: 70 },
      { text: "Resolving lecture details...", pct: 85 }
    ];
    const currentPct = parseInt(extractionProgress.style.width, 10);
    const nextStatus = statuses.find(s => s.pct > currentPct);
    if (nextStatus) {
      updateProgress(nextStatus.text, nextStatus.pct);
    }
  }, 1000);

  chrome.tabs.sendMessage(activeTabId, { action: "extractCourseData" }, (response) => {
    clearInterval(statusInterval);
    if (chrome.runtime.lastError || !response || !response.success) {
      const errMsg = (response && response.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "Failed to extract";
      alert("Extraction Error: " + errMsg);
      showReadyState(activeTabId);
      return;
    }
    
    updateProgress("Formatting course dump...", 95);
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
  
  // Set output
  switchTab("markdown");
  showPanel("success");
}

function switchTab(format) {
  activeFormat = format;
  
  if (format === "markdown") {
    tabBtnMarkdown.classList.add("active");
    tabBtnJson.classList.remove("active");
    outputView.textContent = generateMarkdown(currentCourseData);
  } else {
    tabBtnMarkdown.classList.remove("active");
    tabBtnJson.classList.add("active");
    outputView.textContent = generateJSON(currentCourseData);
  }
}

function generateMarkdown(data) {
  if (!data) return "";
  
  let md = `# ${data.title}\n\n`;
  if (data.instructor) md += `Instructor: ${data.instructor}\n`;
  if (data.duration) md += `Duration: ${data.duration}\n\n`;
  
  if (data.learningObjectives && data.learningObjectives.length > 0) {
    md += `## Learning Objectives\n`;
    data.learningObjectives.forEach(obj => {
      md += `* ${obj}\n`;
    });
    md += `\n`;
  }
  
  if (data.prerequisites && data.prerequisites.length > 0) {
    md += `## Prerequisites\n`;
    data.prerequisites.forEach(req => {
      md += `* ${req}\n`;
    });
    md += `\n`;
  }

  if (data.description) {
    md += `## Description\n${data.description}\n\n`;
  }
  
  md += `## Curriculum\n\n`;
  data.sections.forEach((sec, idx) => {
    md += `### Section ${idx + 1} - ${sec.name}\n\n`;
    sec.lectures.forEach((lec, lIdx) => {
      const durStr = lec.duration ? ` (${lec.duration})` : '';
      md += `* ${lec.title}${durStr}\n`;
    });
    md += `\n`;
  });
  
  return md.trim();
}

function generateJSON(data) {
  if (!data) return "";
  return JSON.stringify({
    title: data.title,
    instructor: data.instructor,
    duration: data.duration,
    description: data.description,
    learningObjectives: data.learningObjectives,
    prerequisites: data.prerequisites,
    sections: data.sections
  }, null, 2);
}

function copyToClipboard() {
  const text = outputView.textContent;
  if (!text) return;
  
  navigator.clipboard.writeText(text).then(() => {
    // Show visual feedback
    btnCopy.classList.add("success");
    copyText.textContent = "Copied!";
    
    // Add micro-animation bounce
    btnCopy.style.transform = "scale(0.95)";
    setTimeout(() => {
      btnCopy.style.transform = "";
    }, 150);

    // Revert after 2 seconds
    setTimeout(() => {
      btnCopy.classList.remove("success");
      copyText.textContent = "Copy to Clipboard";
    }, 2000);
  }).catch(err => {
    console.error("Failed to copy text: ", err);
    alert("Could not copy. Please select text manually.");
  });
}
