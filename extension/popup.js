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
const spinnerEl = document.getElementById("ascii-spinner");

const successCourseTitle = document.getElementById("success-course-title");
const successCourseInstructor = document.getElementById("success-course-instructor");
const statDuration = document.getElementById("stat-duration");
const statSections = document.getElementById("stat-sections");
const statLectures = document.getElementById("stat-lectures");

const tabBtnMarkdown = document.getElementById("tab-btn-markdown");
const tabBtnJson = document.getElementById("tab-btn-json");
const tabBtnAi = document.getElementById("tab-btn-ai");
const outputView = document.getElementById("output-view");
const btnCopy = document.getElementById("btn-copy");
const copyText = document.getElementById("copy-text");

// State
let activeTabId = null;
let currentCourseData = null;
let activeFormat = "markdown"; // or "json"
let spinnerInterval = null;

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  
  activeTabId = tab.id;
  
  if (isUdemyUrl(tab.url)) {
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
          files: ["content.js"]
        });
        // Try pinging again
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
    if (response && response.title) {
      readyCourseTitle.textContent = response.title;
    } else {
      readyCourseTitle.textContent = "Udemy Course Page";
    }
  });
}

async function startExtraction() {
  showPanel("loading");
  startSpinner();
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
    stopSpinner();
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
  
  tabBtnMarkdown.classList.toggle("active", format === "markdown");
  tabBtnJson.classList.toggle("active", format === "json");
  tabBtnAi.classList.toggle("active", format === "ai");
  
  if (format === "markdown") {
    outputView.textContent = generateMarkdown(currentCourseData);
  } else if (format === "json") {
    outputView.textContent = generateJSON(currentCourseData);
  } else if (format === "ai") {
    outputView.textContent = generateAIContext(currentCourseData);
  }
}

function generateMarkdown(data) {
  if (!data) return "";
  
  let md = `# ${data.title}\n\n`;
  if (data.instructor) md += `Instructor: ${data.instructor}\n`;
  if (data.duration) md += `Duration: ${data.duration}\n`;
  
  if (data.progress) {
    const p = data.progress;
    md += `Progress: ${p.percentComplete}% complete (${p.completedLecturesCount}/${p.totalLecturesCount} lectures, ${p.completedSectionsCount}/${p.totalSectionsCount} sections completed)\n`;
  }
  
  if (data.currentLecture) {
    const cur = data.currentLecture;
    md += `Current Position: Section ${cur.sectionIndex + 1} - "${cur.sectionName}" > Lecture "${cur.title}"\n`;
  }
  md += `\n`;
  
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
    const secStatus = sec.completed ? ' [COMPLETED]' : '';
    md += `### Section ${idx + 1} - ${sec.name}${secStatus}\n\n`;
    sec.lectures.forEach((lec) => {
      const durStr = lec.duration ? ` (${lec.duration})` : '';
      const check = lec.completed ? '[x]' : '[ ]';
      const currentMarker = lec.isCurrent ? ' <-- CURRENT POSITION' : '';
      md += `* ${check} ${lec.title}${durStr}${currentMarker}\n`;
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
    progress: data.progress,
    currentLecture: data.currentLecture,
    sections: data.sections
  }, null, 2);
}

function generateAIContext(data) {
  if (!data) return "";
  
  let ai = `Use this information as the learner's current course progress and learning context.\n\n`;
  ai += `# Learning Context: Udemy Course Progress\n`;
  ai += `* **Course:** ${data.title}\n`;
  if (data.instructor) ai += `* **Instructor:** ${data.instructor}\n`;
  
  if (data.progress) {
    const p = data.progress;
    ai += `* **Current Progress:** ${p.percentComplete}% Complete (${p.completedLecturesCount}/${p.totalLecturesCount} lectures completed, ${p.completedSectionsCount}/${p.totalSectionsCount} sections completed)\n`;
  }
  
  if (data.currentLecture) {
    const cur = data.currentLecture;
    ai += `* **Current Position:** Section ${cur.sectionIndex + 1} - "${cur.sectionName}" > Lecture "${cur.title}"\n`;
  }
  ai += `\n`;
  
  ai += `## Completed Topics\n`;
  let hasCompleted = false;
  data.sections.forEach((sec, idx) => {
    const completedLectures = sec.lectures.filter(l => l.completed);
    if (completedLectures.length === sec.lectures.length && sec.lectures.length > 0) {
      ai += `* **Section ${idx + 1}: ${sec.name}** - [All ${sec.lectures.length} lectures completed]\n`;
      hasCompleted = true;
    } else if (completedLectures.length > 0) {
      ai += `* **Section ${idx + 1}: ${sec.name}**\n`;
      completedLectures.forEach(l => {
        ai += `  - [x] ${l.title}\n`;
      });
      hasCompleted = true;
    }
  });
  if (!hasCompleted) {
    ai += `* No topics completed yet.\n`;
  }
  ai += `\n`;
  
  ai += `## Remaining Topics to Study\n`;
  let hasRemaining = false;
  data.sections.forEach((sec, idx) => {
    const remainingLectures = sec.lectures.filter(l => !l.completed);
    if (remainingLectures.length === sec.lectures.length && sec.lectures.length > 0) {
      ai += `* **Section ${idx + 1}: ${sec.name}** - [All ${sec.lectures.length} lectures remaining]\n`;
      hasRemaining = true;
    } else if (remainingLectures.length > 0) {
      ai += `* **Section ${idx + 1}: ${sec.name}**\n`;
      remainingLectures.forEach(l => {
        const currentMarker = l.isCurrent ? ' <-- CURRENT POSITION (Start here)' : '';
        ai += `  - [ ] ${l.title}${currentMarker}\n`;
      });
      hasRemaining = true;
    }
  });
  if (!hasRemaining) {
    ai += `* All topics completed!\n`;
  }
  
  return ai.trim();
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
