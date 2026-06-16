// Helper to check if page is a Udemy course page
function isUdemyPage() {
  const host = window.location.hostname;
  const path = window.location.pathname;
  return host.includes("udemy.com") && (path.includes("/course/") || path.includes("/learn/"));
}

// Find Course ID from DOM or script tags
function findCourseId() {
  // 1. Check body dataset attributes
  if (document.body.dataset.clpCourseId) return document.body.dataset.clpCourseId;
  if (document.body.dataset.courseId) return document.body.dataset.courseId;
  
  const clpAttr = document.body.getAttribute('data-clp-course-id') || document.body.getAttribute('data-course-id');
  if (clpAttr) return clpAttr;
  
  // 2. Check elements with data-purpose="course-header"
  const headerEl = document.querySelector('[data-purpose="course-header"]');
  if (headerEl && headerEl.dataset.courseId) return headerEl.dataset.courseId;

  // 3. Search inside data-module-args attribute values
  const moduleEls = document.querySelectorAll("[data-module-args]");
  for (let el of moduleEls) {
    try {
      const args = JSON.parse(el.dataset.moduleArgs);
      if (args && args.courseId) return args.courseId;
      if (args && args.id) return args.id;
    } catch (e) {}
  }
  
  // 4. Search elements with data-course-id attributes
  const anyCourseIdEl = document.querySelector('[data-course-id], [course-id]');
  if (anyCourseIdEl) {
    const cid = anyCourseIdEl.getAttribute('data-course-id') || anyCourseIdEl.getAttribute('course-id');
    if (cid) return cid;
  }
  
  // 5. Scan scripts for initial state parameters or courseId keys
  const scripts = document.querySelectorAll('script');
  for (let script of scripts) {
    const text = script.textContent || '';
    const courseIdMatch = text.match(/"courseId"\s*:\s*(\d+)/) || 
                          text.match(/"course_id"\s*:\s*(\d+)/) || 
                          text.match(/courseId\s*=\s*(\d+)/) ||
                          text.match(/course_id\s*=\s*(\d+)/);
    if (courseIdMatch && courseIdMatch[1]) {
      return courseIdMatch[1];
    }
  }
  
  return null;
}

// Format duration from seconds to a readable string (e.g. 5 min)
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 1) {
    return seconds + " sec";
  }
  return mins + " min";
}

// Parse flat curriculum JSON to a hierarchical array of sections and lectures
function parseApiCurriculum(results) {
  const sections = [];
  let currentSection = null;
  
  for (let item of results) {
    if (item._class === "chapter") {
      currentSection = {
        id: item.id,
        name: item.title,
        lectures: []
      };
      sections.push(currentSection);
    } else if (item._class === "lecture" || item._class === "quiz" || item._class === "practice") {
      let duration = "";
      if (item.asset && item.asset.time_estimation) {
        duration = formatDuration(item.asset.time_estimation);
      }
      
      const lectureObj = {
        id: item.id,
        title: item.title,
        duration: duration,
        type: item._class
      };
      
      if (!currentSection) {
        currentSection = {
          id: null,
          name: "Introduction",
          lectures: []
        };
        sections.push(currentSection);
      }
      currentSection.lectures.push(lectureObj);
    }
  }
  return sections;
}

// Compute backup total course duration by summing lecture durations
function calculateTotalDuration(sections) {
  let totalMinutes = 0;
  let hasDurations = false;
  
  for (let sec of sections) {
    for (let lec of sec.lectures) {
      if (lec.duration) {
        hasDurations = true;
        const matchMin = lec.duration.match(/(\d+)\s*min/);
        const matchColon = lec.duration.match(/(\d+):(\d+)/);
        if (matchMin) {
          totalMinutes += parseInt(matchMin[1], 10);
        } else if (matchColon) {
          totalMinutes += parseInt(matchColon[1], 10);
        }
      }
    }
  }
  
  if (!hasDurations) return null;
  
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

// Scrape page elements for course metadata
function scrapeDOMMetadata() {
  // 1. Title
  let title = "";
  const titleEl = document.querySelector('h1[data-purpose="lead-title"], h1.cl-header__title, h1[class*="course-title"]');
  if (titleEl) {
    title = titleEl.innerText.trim();
  } else {
    // Player fallback: strip course name from player title
    title = document.title.split('|')[1]?.trim() || document.title.split('-')[1]?.trim() || document.title.trim();
  }
  
  // 2. Instructor
  let instructor = "";
  const instructorEl = document.querySelector('[data-purpose="instructor-name"], [class*="instructor-links"] a, .instructor--name--');
  if (instructorEl) {
    instructor = instructorEl.innerText.trim().replace(/^by\s+/i, '');
  } else {
    // Scan links
    const instLink = document.querySelector('a[href*="/user/"]');
    if (instLink && instLink.innerText.trim().length > 2) {
      instructor = instLink.innerText.trim();
    }
  }
  
  // 3. Duration
  let duration = "";
  const durationEl = document.querySelector('[data-purpose="video-content-length"], [class*="curriculum-header"] [class*="content-length"]');
  if (durationEl) {
    duration = durationEl.innerText.trim().replace(/•/g, '').trim();
  }
  
  // 4. Description
  let description = "";
  const descEl = document.querySelector('[data-purpose="description"], [class*="description--description"]');
  if (descEl) {
    description = descEl.innerText.trim();
  }
  
  // 5. Learning Objectives
  const learningObjectives = [];
  const objectiveEls = document.querySelectorAll('[data-purpose="what-you-will-learn"] li, [class*="what-you-will-learn"] li, [class*="objectives-summary"] li');
  objectiveEls.forEach(el => {
    const text = el.innerText.trim();
    if (text) learningObjectives.push(text);
  });
  
  // 6. Prerequisites
  const prerequisites = [];
  const prereqEls = document.querySelectorAll('[data-purpose="requirements"] li, [class*="requirements--requirements"] li');
  prereqEls.forEach(el => {
    const text = el.innerText.trim();
    if (text) prerequisites.push(text);
  });
  
  return { title, instructor, duration, description, learningObjectives, prerequisites };
}

// Scrape curriculum directly from DOM as a tier 3 fallback
async function scrapeDOMCurriculum() {
  const sections = [];
  
  // Try to find sections
  const sectionEls = document.querySelectorAll('[class*="section--section-panel--"], [data-purpose="section-panel"], [class*="section--section--"], [class*="curriculum--section-container--"]');
  
  if (sectionEls.length === 0) {
    // Flat structures, search by headers
    const headerEls = document.querySelectorAll('[data-purpose="section-header"], [class*="section--section-header--"], [class*="section-header-container"]');
    for (let header of headerEls) {
      const sectionName = header.innerText.trim();
      const contentPanel = header.nextElementSibling || header.parentElement?.nextElementSibling;
      const lectures = [];
      if (contentPanel) {
        const lectureEls = contentPanel.querySelectorAll('[data-purpose="lecture-title"], [class*="lecture-title"], [class*="item-title"], [class*="curriculum-item--title"]');
        for (let lec of lectureEls) {
          const parentRow = lec.closest('[class*="row"], [class*="item"], li, div');
          let duration = "";
          if (parentRow) {
            const durationEl = parentRow.querySelector('[class*="duration"], [class*="time"], [class*="content-summary"], [data-purpose="lecture-duration"]');
            if (durationEl) {
              duration = durationEl.innerText.trim();
            } else {
              const timeMatch = parentRow.innerText.match(/\d+:\d+|\d+\s*min/);
              if (timeMatch) duration = timeMatch[0];
            }
          }
          lectures.push({ title: lec.innerText.trim(), duration });
        }
      }
      sections.push({ name: sectionName, lectures });
    }
  } else {
    for (let el of sectionEls) {
      const headerEl = el.querySelector('[class*="section-title"], [class*="section-header"], [data-purpose="section-title"], h3, h4');
      if (!headerEl) continue;
      const sectionName = headerEl.innerText.trim();
      
      const lectures = [];
      const lectureEls = el.querySelectorAll('[class*="lecture-title"], [class*="item-title"], [class*="curriculum-item--title"], [data-purpose="lecture-title"]');
      for (let lec of lectureEls) {
        const parentRow = lec.closest('[class*="row"], [class*="item"], li, div');
        let duration = "";
        if (parentRow) {
          const durationEl = parentRow.querySelector('[class*="duration"], [class*="time"], [class*="content-summary"], [data-purpose="lecture-duration"]');
          if (durationEl) {
            duration = durationEl.innerText.trim();
          } else {
            const timeMatch = parentRow.innerText.match(/\d+:\d+|\d+\s*min/);
            if (timeMatch) duration = timeMatch[0];
          }
        }
        lectures.push({ title: lec.innerText.trim(), duration });
      }
      sections.push({ name: sectionName, lectures });
    }
  }
  
  return sections;
}

// Clean titles by stripping number prefixes (e.g. "1. ") and normalizing
function cleanTitle(title) {
  if (!title) return "";
  return title.replace(/^\d+[\.\s\-]+\s*/, "").toLowerCase().trim();
}

// Extract current item ID from the player URL
function getCurrentItemIdFromUrl() {
  const match = window.location.pathname.match(/\/learn\/(lecture|quiz|practice|assignment)\/(\d+)/);
  return match ? parseInt(match[2], 10) : null;
}

// Fetch user progress from internal API
async function fetchProgress(courseId) {
  try {
    const progressUrl = `${window.location.origin}/api-2.0/users/me/subscribed-courses/${courseId}/progress/`;
    const response = await fetch(progressUrl);
    if (response.ok) {
      const data = await response.json();
      return {
        completedLectureIds: data.completed_lecture_ids || [],
        lastAccessedLectureId: data.last_accessed_lecture_id || null
      };
    }
  } catch (err) {
    console.warn("[UdemyIngest] Progress API fetch failed:", err);
  }
  return null;
}

// Scrape progress checkmarks and active status from the player page DOM
function scrapeDOMProgress() {
  const completedTitles = new Set();
  let currentLectureTitle = null;
  let currentSectionTitle = null;
  
  // Locate checkboxes in player sidebar
  const checkboxes = document.querySelectorAll('input[type="checkbox"][data-purpose="progress-toggle-button"]');
  checkboxes.forEach(cb => {
    const parentRow = cb.closest('[class*="curriculum-item--row--"], [class*="curriculum-item--container--"], [data-purpose="sidebar-item"], li, div');
    if (!parentRow) return;
    
    const titleEl = parentRow.querySelector('[class*="item-title"], [class*="lecture-title"], [class*="curriculum-item--title"], [data-purpose="item-title"], span, a');
    if (!titleEl) return;
    
    const titleText = titleEl.innerText.trim();
    if (titleText) {
      if (cb.checked) {
        completedTitles.add(cleanTitle(titleText));
      }
      
      const isSelected = parentRow.classList.contains('selected') || 
                         parentRow.classList.contains('active') ||
                         parentRow.getAttribute('aria-current') === 'true' ||
                         parentRow.getAttribute('aria-current') === 'step' ||
                         !!parentRow.querySelector('[class*="selected"]') ||
                         !!parentRow.querySelector('[class*="active"]');
      if (isSelected) {
        currentLectureTitle = titleText;
        const sectionPanel = parentRow.closest('[class*="section--section-panel--"], [data-purpose="section-panel"], [class*="section--section--"]');
        if (sectionPanel) {
          const secHeader = sectionPanel.querySelector('[class*="section-title"], [class*="section-header"], [data-purpose="section-title"], h3, h4');
          if (secHeader) {
            currentSectionTitle = secHeader.innerText.trim();
          }
        }
      }
    }
  });

  // Fallback for current lecture title if no checkbox row is marked active/selected
  if (!currentLectureTitle) {
    const activeEl = document.querySelector(
      '[class*="item--item--selected"], [class*="item--selected"], [class*="curriculum-item--selected"], [aria-current="true"], [aria-current="step"]'
    );
    if (activeEl) {
      const titleEl = activeEl.querySelector('[class*="item-title"], [class*="lecture-title"], [class*="curriculum-item--title"], [data-purpose="item-title"], span, a') || activeEl;
      currentLectureTitle = titleEl.innerText.trim();
      
      const sectionPanel = activeEl.closest('[class*="section--section-panel--"], [data-purpose="section-panel"], [class*="section--section--"]');
      if (sectionPanel) {
        const secHeader = sectionPanel.querySelector('[class*="section-title"], [class*="section-header"], [data-purpose="section-title"], h3, h4');
        if (secHeader) {
          currentSectionTitle = secHeader.innerText.trim();
        }
      }
    }
  }
  
  return {
    completedTitles,
    currentLectureTitle,
    currentSectionTitle
  };
}

// Orchestrates the multi-tier extraction
async function extractCourseData() {
  const metadata = scrapeDOMMetadata();
  const courseId = findCourseId();
  
  let sections = [];
  let extractedViaApi = false;
  
  if (courseId) {
    console.log("[UdemyIngest] Found Course ID:", courseId);
    
    // Tier 1: Try subscriber curriculum API
    try {
      const subUrl = `${window.location.origin}/api-2.0/courses/${courseId}/cached-subscriber-curriculum-items/?page_size=10000&fields[chapter]=title,object_index,sort_order&fields[lecture]=title,object_index,asset,supplementary_assets&fields[asset]=time_estimation,asset_type`;
      const response = await fetch(subUrl);
      if (response.ok) {
        const json = await response.json();
        if (json.results && json.results.length > 0) {
          sections = parseApiCurriculum(json.results);
          extractedViaApi = true;
          console.log("[UdemyIngest] Successfully extracted curriculum via Tier 1 Subscriber API.");
        }
      }
    } catch (err) {
      console.warn("[UdemyIngest] Tier 1 API fetch failed:", err);
    }
    
    // Tier 2: Try public curriculum API if Tier 1 failed
    if (!extractedViaApi) {
      try {
        const pubUrl = `${window.location.origin}/api-2.0/courses/${courseId}/public-curriculum-items/?page_size=10000`;
        const response = await fetch(pubUrl);
        if (response.ok) {
          const json = await response.json();
          if (json.results && json.results.length > 0) {
            sections = parseApiCurriculum(json.results);
            extractedViaApi = true;
            console.log("[UdemyIngest] Successfully extracted curriculum via Tier 2 Public API.");
          }
        }
      } catch (err) {
        console.warn("[UdemyIngest] Tier 2 API fetch failed:", err);
      }
    }
  }
  
  // Tier 3: DOM Scraping Fallback (If APIs failed or Course ID is not found)
  if (!extractedViaApi) {
    console.log("[UdemyIngest] Falling back to Tier 3 DOM Scraping...");
    
    // Auto-expand curriculum accordions on landing page before scraping
    const expandButton = document.querySelector('button[data-purpose="expand-toggle"], [class*="expand-all"], button[class*="curriculum-header"]');
    if (expandButton && expandButton.innerText.toLowerCase().includes("expand")) {
      expandButton.click();
      await new Promise(r => setTimeout(r, 600)); // wait for transitions
    }
    
    sections = await scrapeDOMCurriculum();
  }
  
  // Clean empty sections
  const cleanSections = sections.filter(sec => sec.name && sec.name.length > 0);
  
  // Fetch user progress via API if enrolled and courseId exists
  let completedLectureIds = [];
  let lastAccessedLectureId = null;
  if (courseId) {
    const progressData = await fetchProgress(courseId);
    if (progressData) {
      completedLectureIds = progressData.completedLectureIds;
      lastAccessedLectureId = progressData.lastAccessedLectureId;
    }
  }
  
  // Scrape DOM progress info as well
  const domProgress = scrapeDOMProgress();
  const currentLectureIdFromUrl = getCurrentItemIdFromUrl();
  
  // Enrich sections with progress info
  let completedLecturesCount = 0;
  let totalLecturesCount = 0;
  let currentLectureObj = null;
  
  const enrichedSections = cleanSections.map((sec, secIdx) => {
    let sectionCompletedCount = 0;
    
    const enrichedLectures = sec.lectures.map(lec => {
      totalLecturesCount++;
      
      const isCompleted = (lec.id && completedLectureIds.includes(lec.id)) || 
                          (lec.title && domProgress.completedTitles.has(cleanTitle(lec.title)));
      
      const isCurrent = (lec.id && lec.id === currentLectureIdFromUrl) ||
                        (lec.title && domProgress.currentLectureTitle && cleanTitle(lec.title) === cleanTitle(domProgress.currentLectureTitle)) ||
                        (lec.id && lec.id === lastAccessedLectureId && !currentLectureIdFromUrl);
      
      if (isCompleted) {
        completedLecturesCount++;
        sectionCompletedCount++;
      }
      
      const enrichedLec = {
        ...lec,
        completed: isCompleted,
        isCurrent: isCurrent
      };
      
      if (isCurrent) {
        currentLectureObj = {
          id: lec.id || null,
          title: lec.title,
          sectionName: sec.name,
          sectionIndex: secIdx
        };
      }
      
      return enrichedLec;
    });
    
    return {
      ...sec,
      lectures: enrichedLectures,
      completedCount: sectionCompletedCount,
      totalCount: sec.lectures.length,
      completed: sec.lectures.length > 0 && sectionCompletedCount === sec.lectures.length
    };
  });
  
  // Count completed/remaining sections
  const totalSectionsCount = enrichedSections.length;
  const completedSectionsCount = enrichedSections.filter(s => s.completed).length;
  const remainingSectionsCount = totalSectionsCount - completedSectionsCount;
  const remainingLecturesCount = totalLecturesCount - completedLecturesCount;
  const percentComplete = totalLecturesCount > 0 ? Math.round((completedLecturesCount / totalLecturesCount) * 100) : 0;
  
  const progressState = {
    completedLecturesCount,
    remainingLecturesCount,
    totalLecturesCount,
    completedSectionsCount,
    remainingSectionsCount,
    totalSectionsCount,
    percentComplete
  };
  
  // Calculate computed duration if page duration is blank
  const computedDuration = calculateTotalDuration(enrichedSections);
  const finalDuration = metadata.duration || computedDuration || "Unknown Duration";
  
  return {
    title: metadata.title || "Unknown Course Title",
    instructor: metadata.instructor || "Unknown Instructor",
    description: metadata.description || "",
    duration: finalDuration,
    sectionsCount: totalSectionsCount,
    lecturesCount: totalLecturesCount,
    learningObjectives: metadata.learningObjectives,
    prerequisites: metadata.prerequisites,
    sections: enrichedSections,
    progress: progressState,
    currentLecture: currentLectureObj
  };
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "ready", isUdemy: isUdemyPage() });
  } else if (request.action === "getCourseInfo") {
    const metadata = scrapeDOMMetadata();
    sendResponse({ isUdemy: isUdemyPage(), title: metadata.title });
  } else if (request.action === "extractCourseData") {
    extractCourseData()
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(err => {
        sendResponse({ success: false, error: err.message || "Unknown error during extraction" });
      });
    return true; // Keep message channel open for async response
  }
});
