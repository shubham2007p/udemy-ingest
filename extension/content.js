/**
 * content.js
 * Coordinator content script that routes messages to the platform-specific extractors.
 */

function isUdemyPage() {
  const host = window.location.hostname;
  const path = window.location.pathname;
  return host.includes("udemy.com") && (path.includes("/course/") || path.includes("/learn/"));
}

function isYouTubePage() {
  return typeof YouTubeExtractor !== "undefined" && 
         (YouTubeExtractor.isPlaylistPage() || 
          YouTubeExtractor.isWatchPageWithPlaylist() || 
          YouTubeExtractor.isWatchPageWithoutPlaylist());
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const isUdemy = isUdemyPage();
  const isYouTube = isYouTubePage();
  const isSupported = isUdemy || isYouTube;
  const platform = isUdemy ? "udemy" : (isYouTube ? "youtube" : null);

  if (request.action === "ping") {
    sendResponse({ status: "ready", isSupported: isSupported, platform: platform });
  } 
  
  else if (request.action === "getCourseInfo") {
    let title = "Learning Platform Page";
    if (isUdemy && typeof UdemyExtractor !== "undefined") {
      title = UdemyExtractor.scrapeDOMMetadata().title || "Udemy Course Page";
    } else if (isYouTube && typeof YouTubeExtractor !== "undefined") {
      if (YouTubeExtractor.isPlaylistPage()) {
        const titleEl = document.querySelector('ytd-playlist-header-renderer h1#title, ytd-playlist-header-renderer #title a, h1#title');
        title = titleEl ? titleEl.innerText.trim() : document.title.replace(/ - YouTube$/i, "").trim();
      } else if (YouTubeExtractor.isWatchPageWithPlaylist()) {
        const panelEl = document.querySelector('ytd-playlist-panel-renderer');
        const titleEl = panelEl ? panelEl.querySelector('.title a, #title a, #header-description h3 a') : null;
        title = titleEl ? titleEl.innerText.trim() : (document.querySelector('ytd-playlist-panel-renderer #title')?.innerText.trim() || "YouTube Playlist");
      } else {
        // Standalone video
        const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-watch-metadata, ytd-video-primary-info-renderer h1.title');
        title = titleEl ? titleEl.innerText.trim() : document.title.replace(/ - YouTube$/i, "").trim();
      }
    }
    sendResponse({ isSupported: isSupported, platform: platform, title: title });
  } 
  
  else if (request.action === "extractCourseData") {
    let extractPromise = null;
    
    if (isUdemy && typeof UdemyExtractor !== "undefined") {
      extractPromise = UdemyExtractor.extract();
    } else if (isYouTube && typeof YouTubeExtractor !== "undefined") {
      extractPromise = YouTubeExtractor.extract();
    } else {
      sendResponse({ success: false, error: "Unsupported platform or extractor not loaded" });
      return;
    }

    extractPromise
      .then(rawData => {
        const normalized = LearningSchema.normalize(rawData);
        sendResponse({ success: true, data: normalized });
      })
      .catch(err => {
        console.error("[AIIngest] Extraction error:", err);
        sendResponse({ success: false, error: err.message || "Unknown error during extraction" });
      });
      
    return true; // Keep message channel open for async response
  }
});
