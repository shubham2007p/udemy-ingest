/**
 * YouTube Extractor
 * Scrapes YouTube playlist pages, watch pages inside playlists, and standalone video watch pages.
 */
const YouTubeExtractor = {
  isPlaylistPage() {
    const host = window.location.hostname;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    return host.includes("youtube.com") && path.includes("/playlist") && params.has("list");
  },

  isWatchPageWithPlaylist() {
    const host = window.location.hostname;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    return host.includes("youtube.com") && path.includes("/watch") && params.has("list");
  },

  isWatchPageWithoutPlaylist() {
    const host = window.location.hostname;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    return host.includes("youtube.com") && path.includes("/watch") && params.has("v") && !params.has("list");
  },

  // Helper to parse time string (e.g., "5:30", "1:15:20") into seconds
  parseTimeToSeconds(timeStr) {
    if (typeof LearningSchema !== "undefined") {
      return LearningSchema.parseDurationToSeconds(timeStr);
    }
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(":").map(Number);
    if (parts.some(isNaN)) return 0;
    
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parts[0] || 0;
  },

  // Helper to parse verbal duration strings (e.g. "27 hours, 15 minutes") into seconds
  parseVerbalTimeToSeconds(str) {
    if (typeof LearningSchema !== "undefined") {
      return LearningSchema.parseDurationToSeconds(str);
    }
    if (!str) return 0;
    let seconds = 0;
    const daysMatch = str.match(/(\d+)\s*d/i) || str.match(/(\d+)\s*day/i);
    const hrsMatch = str.match(/(\d+)\s*h/i) || str.match(/(\d+)\s*hour/i);
    const minsMatch = str.match(/(\d+)\s*m/i) || str.match(/(\d+)\s*min/i);
    const secsMatch = str.match(/(\d+)\s*s/i) || str.match(/(\d+)\s*sec/i);
    
    if (daysMatch) seconds += parseInt(daysMatch[1], 10) * 86400;
    if (hrsMatch) seconds += parseInt(hrsMatch[1], 10) * 3600;
    if (minsMatch) seconds += parseInt(minsMatch[1], 10) * 60;
    if (secsMatch) seconds += parseInt(secsMatch[1], 10);
    
    return seconds;
  },

  // Helper to format total seconds into standard/extended string format
  formatTotalDuration(totalSeconds) {
    if (typeof LearningSchema !== "undefined") {
      return LearningSchema.formatDuration(totalSeconds);
    }
    if (!totalSeconds || isNaN(totalSeconds)) return "Unknown Duration";
    const totalMinutes = Math.round(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      return `${days}d ${hours}h` + (mins > 0 ? ` ${mins}m` : '');
    } else if (totalHours > 0) {
      return `${totalHours}h` + (mins > 0 ? ` ${mins}m` : '');
    }
    return `${mins}m`;
  },

  // Helper to extract width percentage from style string
  getProgressPercent(progressEl) {
    if (!progressEl) return 0;
    const style = progressEl.getAttribute("style") || "";
    const match = style.match(/width:\s*([\d\.]+)%/);
    return match ? parseFloat(match[1]) : 0;
  },

  // Helper to extract Video ID from a YouTube video link
  getVideoIdFromUrl(url) {
    if (!url) return null;
    try {
      let cleanUrl = url;
      if (url.startsWith("/")) {
        cleanUrl = "https://www.youtube.com" + url;
      }
      const u = new URL(cleanUrl);
      if (u.hostname.includes("youtube.com")) {
        return u.searchParams.get("v");
      }
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.substring(1);
      }
    } catch (e) {}
    const match = url.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  },

  // Safe JSON extractor that counts brackets to extract valid objects
  extractJson(text) {
    const startIdx = text.indexOf('{');
    if (startIdx === -1) return null;
    
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let quoteChar = null;
    
    for (let i = startIdx; i < text.length; i++) {
      const char = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (inString) {
        if (char === quoteChar) {
          inString = false;
          quoteChar = null;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        inString = true;
        quoteChar = char;
        continue;
      }
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          const potentialJson = text.substring(startIdx, i + 1);
          try {
            return JSON.parse(potentialJson);
          } catch (e) {
            // If parse fails, keep searching (brace might be in a non-standard literal)
          }
        }
      }
    }
    return null;
  },

  // Get ytInitialData by parsing page script tags (matched against URL list param to prevent contamination)
  getYtInitialData() {
    const params = new URLSearchParams(window.location.search);
    const currentListId = params.get("list");
    const scripts = Array.from(document.querySelectorAll('script'));
    
    for (let i = scripts.length - 1; i >= 0; i--) {
      const text = scripts[i].textContent || "";
      if (text.includes("ytInitialData")) {
        const startIdx = text.indexOf("ytInitialData");
        if (startIdx !== -1) {
          const parsed = this.extractJson(text.substring(startIdx));
          if (parsed) {
            if (currentListId) {
              const playlistId = parsed.header?.playlistHeaderRenderer?.playlistId ||
                                 parsed.sidebar?.playlistSidebarRenderer?.items?.[0]?.playlistSidebarPrimaryInfoRenderer?.navigationEndpoint?.watchEndpoint?.playlistId ||
                                 parsed.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.playlistId;
              if (playlistId && playlistId === currentListId) {
                return parsed;
              }
            } else {
              return parsed;
            }
          }
        }
      }
    }
    
    // Fallback: search backwards and return the first one parsed successfully
    for (let i = scripts.length - 1; i >= 0; i--) {
      const text = scripts[i].textContent || "";
      if (text.includes("ytInitialData")) {
        const startIdx = text.indexOf("ytInitialData");
        if (startIdx !== -1) {
          const parsed = this.extractJson(text.substring(startIdx));
          if (parsed) return parsed;
        }
      }
    }
    return null;
  },

  // Get ytInitialPlayerResponse by parsing script tags (matched against current videoId)
  getYtInitialPlayerResponse() {
    const currentVideoId = this.getVideoIdFromUrl(window.location.href);
    if (!currentVideoId) return null;
    const scripts = Array.from(document.querySelectorAll('script'));
    
    for (let i = scripts.length - 1; i >= 0; i--) {
      const text = scripts[i].textContent || "";
      if (text.includes("ytInitialPlayerResponse")) {
        const startIdx = text.indexOf("ytInitialPlayerResponse");
        if (startIdx !== -1) {
          const parsed = this.extractJson(text.substring(startIdx));
          if (parsed) {
            const videoId = parsed.videoDetails?.videoId;
            if (videoId && videoId === currentVideoId) {
              return parsed;
            }
          }
        }
      }
    }
    return null;
  },

  // Get JSON-LD data from script tags
  getJsonLdData() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (let script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent);
        if (parsed && parsed["@type"] === "VideoObject") {
          return parsed;
        }
      } catch (e) {}
    }
    return null;
  },

  // Parse ISO 8601 Duration (e.g. PT1H6M18S) into seconds
  parseISO8601Duration(durationStr) {
    if (!durationStr) return 0;
    const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (!match) return 0;
    const hours = parseInt(match[1] || 0, 10);
    const minutes = parseInt(match[2] || 0, 10);
    const seconds = parseInt(match[3] || 0, 10);
    return hours * 3600 + minutes * 60 + seconds;
  },

  // Recursively search object values for a playlist duration string
  findPlaylistDurationInObject(obj) {
    if (!obj) return null;
    if (typeof obj === "string") {
      if (/\d+\s*(?:hour|minute|second|day|hr|min|sec|wk|week)s?/i.test(obj)) {
        if (!/ago/i.test(obj) && !/updated/i.test(obj) && !/views/i.test(obj)) {
          return obj;
        }
      }
      return null;
    }
    if (typeof obj === "object") {
      for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const res = this.findPlaylistDurationInObject(obj[key]);
          if (res) return res;
        }
      }
    }
    return null;
  },

  // Parse playlist video items from ytInitialData
  parsePlaylistItemsFromState(playlistVideoList) {
    const videos = [];
    playlistVideoList.forEach((item, index) => {
      const renderer = item.playlistVideoRenderer;
      if (!renderer) return;
      
      const vTitle = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || "Unknown Video";
      const videoId = renderer.videoId;
      const vUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
      
      let lengthSeconds = parseInt(renderer.lengthSeconds, 10) || 0;
      let vDuration = "";
      if (lengthSeconds > 0) {
        const hrs = Math.floor(lengthSeconds / 3600);
        const mins = Math.floor((lengthSeconds % 3600) / 60);
        const secs = lengthSeconds % 60;
        if (hrs > 0) {
          vDuration = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
          vDuration = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
      } else if (renderer.lengthText) {
        vDuration = renderer.lengthText.simpleText || (renderer.lengthText.runs && renderer.lengthText.runs[0] && renderer.lengthText.runs[0].text) || "";
      }
      
      let isCompleted = false;
      if (Array.isArray(renderer.thumbnailOverlays)) {
        for (let overlay of renderer.thumbnailOverlays) {
          const resume = overlay.thumbnailOverlayResumePlaybackRenderer;
          if (resume && typeof resume.percentDurationWatched === "number") {
            isCompleted = resume.percentDurationWatched > 80;
            break;
          }
        }
      }
      
      videos.push({
        id: index + 1,
        title: vTitle,
        duration: vDuration,
        type: "video",
        completed: isCompleted,
        isCurrent: false,
        url: vUrl
      });
    });
    return videos;
  },

  // Expand description section programmatically if collapsed
  async expandDescriptionDOM() {
    const expandButtons = [
      'ytd-text-inline-expander #expand',
      '#description-inline-expander #expand',
      'tp-yt-paper-button#expand',
      '#action-panel-details #more',
      '.ytd-video-secondary-info-renderer #more',
      '#meta #more',
      'ytd-playlist-header-renderer #expand'
    ];
    
    let clicked = false;
    for (let selector of expandButtons) {
      const btn = document.querySelector(selector);
      if (btn && btn.offsetHeight > 0 && btn.offsetWidth > 0) {
        const expander = btn.closest('ytd-text-inline-expander, #description-inline-expander');
        const isCollapsed = (expander && expander.hasAttribute('collapsed')) ||
                            (btn && btn.getAttribute('aria-expanded') === 'false') ||
                            (expander && expander.getAttribute('aria-expanded') === 'false');
        if (isCollapsed || !expander) {
          btn.click();
          clicked = true;
          break;
        }
      }
    }
    if (clicked) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  },

  // Scrape playlist creator with cascading fallbacks
  scrapePlaylistCreator(ytInitialData) {
    if (ytInitialData?.header?.playlistHeaderRenderer) {
      const header = ytInitialData.header.playlistHeaderRenderer;
      const owner = header.ownerText?.runs?.[0]?.text || header.ownerText?.simpleText;
      if (owner) return owner.trim();
    }
    const selectors = [
      'ytd-playlist-header-renderer #owner-text a',
      'ytd-playlist-header-renderer #owner-container a',
      'ytd-playlist-header-renderer #text a',
      'ytd-playlist-header-renderer a[href*="/channel/"]',
      'ytd-playlist-header-renderer a[href*="/@"]',
      'ytd-playlist-byline-renderer #text a',
      '#owner-container #text a'
    ];
    for (let selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim()) {
        return el.innerText.trim();
      }
    }
    const firstVideoCreator = document.querySelector('ytd-playlist-video-renderer #channel-name a, ytd-playlist-video-renderer .yt-simple-endpoint');
    if (firstVideoCreator && firstVideoCreator.innerText.trim()) {
      return firstVideoCreator.innerText.trim();
    }
    return "Unknown Creator";
  },

  // Scrape watch page playlist creator with cascading fallbacks
  scrapeWatchPlaylistCreator(ytInitialData) {
    try {
      const owner = ytInitialData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.ownerName?.simpleText ||
                    ytInitialData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.ownerName?.runs?.[0]?.text;
      if (owner) return owner.trim();
    } catch (e) {}

    const selectors = [
      'ytd-playlist-panel-renderer #owner-name',
      'ytd-playlist-panel-renderer #publisher-link',
      'ytd-playlist-panel-renderer #publisher-container #publisher-link',
      'ytd-playlist-panel-renderer #header-description #publisher-link',
      'ytd-playlist-panel-renderer .publisher-link'
    ];
    for (let selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim()) {
        return el.innerText.trim();
      }
    }
    const videoOwner = document.querySelector('ytd-video-owner-renderer #channel-name a, ytd-watch-metadata #owner #channel-name a, #upload-info #text a');
    if (videoOwner && videoOwner.innerText.trim()) {
      return videoOwner.innerText.trim();
    }
    return "Unknown Creator";
  },

  // Scrape playlist header duration info
  scrapePlaylistHeaderDuration(ytInitialData) {
    if (ytInitialData) {
      let durationText = null;
      if (ytInitialData.header) {
        durationText = this.findPlaylistDurationInObject(ytInitialData.header);
      }
      if (!durationText && ytInitialData.sidebar) {
        durationText = this.findPlaylistDurationInObject(ytInitialData.sidebar);
      }
      if (!durationText) {
        durationText = this.findPlaylistDurationInObject(ytInitialData);
      }
      if (durationText) {
        return durationText;
      }
    }

    const statsContainer = document.querySelector('ytd-playlist-header-renderer #stats, ytd-playlist-byline-renderer #stats, ytd-playlist-header-renderer #metadata-line');
    if (statsContainer) {
      const spans = statsContainer.querySelectorAll('span, yt-formatted-string');
      for (let span of spans) {
        const text = span.innerText || "";
        if (/\d+\s*(hour|minute|second|hr|min|day)/i.test(text) && !/ago/i.test(text) && !/updated/i.test(text)) {
          return text.trim();
        }
      }
    }
    return null;
  },

  // Helper to determine if we should append a '+' sign to the calculated duration
  checkPartialDuration(scrapedCount, calculatedDuration, ytInitialData) {
    if (!calculatedDuration || calculatedDuration === "Unknown Duration") return calculatedDuration;
    
    let totalVideosInPlaylist = 0;
    if (ytInitialData && ytInitialData.header && ytInitialData.header.playlistHeaderRenderer) {
      const numVideosText = ytInitialData.header.playlistHeaderRenderer.numVideosText;
      if (numVideosText) {
        const txt = numVideosText.simpleText || (numVideosText.runs && numVideosText.runs[0] && numVideosText.runs[0].text) || "";
        const match = txt.match(/(\d+)/);
        if (match) {
          totalVideosInPlaylist = parseInt(match[1], 10);
        }
      }
    }

    if (totalVideosInPlaylist === 0) {
      const statsContainer = document.querySelector('ytd-playlist-header-renderer #stats, ytd-playlist-byline-renderer #stats, ytd-playlist-panel-renderer #num-items, ytd-playlist-panel-renderer #playlist-items-count');
      if (statsContainer) {
        const match = statsContainer.innerText.match(/(\d+)/);
        if (match) {
          totalVideosInPlaylist = parseInt(match[1], 10);
        }
      }
    }

    if (totalVideosInPlaylist > 0 && scrapedCount < totalVideosInPlaylist) {
      if (!calculatedDuration.endsWith("+")) {
        return calculatedDuration + "+";
      }
    }
    return calculatedDuration;
  },

  // Scrape publish date on watch pages
  scrapePublishDate() {
    const selectors = [
      '#info-strings yt-formatted-string',
      'ytd-watch-metadata #info-container span',
      '#info-container #info span',
      '#metadata-line span:nth-child(2)',
      '#date a'
    ];
    for (let selector of selectors) {
      const el = document.querySelector(selector);
      const txt = el ? el.innerText.trim() : "";
      if (txt && (/\d{4}/.test(txt) || txt.includes("ago") || txt.includes("Premiered") || txt.includes("202"))) {
        return txt.replace(/•/g, '').trim();
      }
    }
    return "";
  },

  // Scrape chapters with dual-path parsing
  parseChapters(descriptionText) {
    const chapters = [];
    
    // Path A: Try scraping YouTube's interactive chapters from DOM
    const chapterEls = document.querySelectorAll('ytd-macro-markers-list-item-renderer');
    if (chapterEls && chapterEls.length > 0) {
      chapterEls.forEach(el => {
        const titleEl = el.querySelector('#video-title, #details h4');
        const timeEl = el.querySelector('#time-tag, #time, #details span');
        if (titleEl && timeEl) {
          const title = titleEl.innerText.trim();
          const timeStr = timeEl.innerText.trim();
          const timestamp = this.parseTimeToSeconds(timeStr);
          chapters.push({ title, timestamp, timeStr });
        }
      });
    }

    // Path B: Fallback - Parse description text
    if (chapters.length === 0 && descriptionText) {
      const lines = descriptionText.split('\n');
      const timestampRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})/;
      
      lines.forEach(line => {
        const match = line.match(timestampRegex);
        if (match) {
          const timeStr = match[0];
          const timestamp = this.parseTimeToSeconds(timeStr);
          const title = line.replace(timeStr, '').replace(/^\s*[-–—:|]\s*/, '').replace(/\s*[-–—:|]\s*$/, '').trim();
          if (title.length > 0) {
            chapters.push({ title, timestamp, timeStr });
          }
        }
      });
    }

    // Sort chapters by start time
    chapters.sort((a, b) => a.timestamp - b.timestamp);
    
    // De-duplicate chapters by timestamp
    const uniqueChapters = [];
    const seenTimes = new Set();
    chapters.forEach(c => {
      if (!seenTimes.has(c.timestamp)) {
        seenTimes.add(c.timestamp);
        uniqueChapters.push(c);
      }
    });

    return uniqueChapters;
  },

  // Extract from playlist page (/playlist?list=PL...)
  async extractPlaylistPage() {
    const ytInitialData = this.getYtInitialData();

    let title = "";
    if (ytInitialData?.header?.playlistHeaderRenderer) {
      const header = ytInitialData.header.playlistHeaderRenderer;
      title = header.title?.simpleText || (header.title?.runs?.[0]?.text) || "";
    }
    if (!title) {
      const titleEl = document.querySelector('ytd-playlist-header-renderer h1#title, ytd-playlist-header-renderer #title a, h1#title');
      title = titleEl ? titleEl.innerText.trim() : document.title.replace(/ - YouTube$/i, "").trim();
    }

    const creator = this.scrapePlaylistCreator(ytInitialData);

    let description = "";
    if (ytInitialData?.header?.playlistHeaderRenderer) {
      const header = ytInitialData.header.playlistHeaderRenderer;
      description = header.description?.simpleText || (header.description?.runs?.[0]?.text) || "";
    }
    if (!description) {
      await this.expandDescriptionDOM();
      const descEl = document.querySelector('ytd-playlist-header-renderer #description-text, ytd-playlist-header-renderer #description');
      description = descEl ? descEl.innerText.trim() : "";
    }

    const rawVideos = [];
    
    // Tier 1: Try parsing playlist items from ytInitialData
    let playlistVideoList = null;
    try {
      const tabs = ytInitialData?.contents?.twoColumnBrowseResultsRenderer?.tabs;
      const tabContent = tabs?.[0]?.tabRenderer?.content;
      const sectionContents = tabContent?.sectionListRenderer?.contents;
      const itemSectionContents = sectionContents?.[0]?.itemSectionRenderer?.contents;
      playlistVideoList = itemSectionContents?.[0]?.playlistVideoListRenderer?.contents;
    } catch (e) {}
    
    if (Array.isArray(playlistVideoList) && playlistVideoList.length > 0) {
      const parsed = this.parsePlaylistItemsFromState(playlistVideoList);
      parsed.forEach(v => {
        rawVideos.push(v);
      });
    } else {
      // Tier 4: Fallback to DOM scraping
      const videoEls = document.querySelectorAll('ytd-playlist-video-renderer');
      if (videoEls.length > 0) {
        videoEls.forEach((el, index) => {
          const titleLink = el.querySelector('a#video-title');
          if (!titleLink) return;
          const vTitle = titleLink.innerText.trim();
          const vUrl = titleLink.href || "";

          let vDuration = "";
          const durationEl = el.querySelector('ytd-thumbnail-overlay-time-status-renderer span, #time-status span, .ytd-thumbnail-overlay-time-status-renderer');
          if (durationEl) {
            vDuration = durationEl.innerText.trim();
          }

          const progressEl = el.querySelector('#progress');
          let isCompleted = false;
          if (progressEl) {
            const pct = this.getProgressPercent(progressEl);
            isCompleted = pct > 80;
          }

          rawVideos.push({
            title: vTitle,
            duration: vDuration,
            type: "video",
            completed: isCompleted,
            isCurrent: false,
            url: vUrl
          });
        });
      }
    }

    // Deduplicate videos by Video ID
    const seenIds = new Set();
    const uniqueVideos = [];
    rawVideos.forEach(v => {
      const vId = this.getVideoIdFromUrl(v.url) || v.title;
      if (vId && !seenIds.has(vId)) {
        seenIds.add(vId);
        uniqueVideos.push(v);
      }
    });

    let completedCount = 0;
    let totalSeconds = 0;
    let validDurationsCount = 0;
    let missingDurationsCount = 0;

    uniqueVideos.forEach((v, index) => {
      v.id = index + 1;
      if (v.completed) {
        completedCount++;
      }
      const seconds = this.parseTimeToSeconds(v.duration);
      if (seconds > 0) {
        totalSeconds += seconds;
        validDurationsCount++;
      } else {
        missingDurationsCount++;
      }
    });

    // Logging requirement (Problem 4 & 5)
    console.log(`[AIIngest] Playlist Duration Calculation Debug:`, {
      playlistVideosFound: uniqueVideos.length,
      videosWithDuration: validDurationsCount,
      totalSeconds: totalSeconds
    });

    let totalVideosInPlaylist = 0;
    if (ytInitialData?.header?.playlistHeaderRenderer) {
      const numVideosText = ytInitialData.header.playlistHeaderRenderer.numVideosText;
      if (numVideosText) {
        const txt = numVideosText.simpleText || (numVideosText.runs && numVideosText.runs[0] && numVideosText.runs[0].text) || "";
        const match = txt.match(/(\d+)/);
        if (match) {
          totalVideosInPlaylist = parseInt(match[1], 10);
        }
      }
    }
    if (totalVideosInPlaylist === 0) {
      const statsContainer = document.querySelector('ytd-playlist-header-renderer #stats, ytd-playlist-byline-renderer #stats');
      if (statsContainer) {
        const match = statsContainer.innerText.match(/(\d+)/);
        if (match) {
          totalVideosInPlaylist = parseInt(match[1], 10);
        }
      }
    }

    const totalCount = uniqueVideos.length;
    const progressState = {
      completedLecturesCount: completedCount,
      remainingLecturesCount: totalCount - completedCount,
      totalLecturesCount: totalCount,
      completedSectionsCount: completedCount === totalCount && totalCount > 0 ? 1 : 0,
      remainingSectionsCount: completedCount === totalCount && totalCount > 0 ? 0 : 1,
      totalSectionsCount: 1,
      percentComplete: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    };

    const sections = [{
      name: "Playlist Videos",
      completed: completedCount === totalCount && totalCount > 0,
      completedCount: completedCount,
      totalCount: totalCount,
      lectures: uniqueVideos
    }];

    let lastCompletedLectureObj = null;
    let nextLectureObj = null;

    for (let i = 0; i < uniqueVideos.length; i++) {
      const v = uniqueVideos[i];
      if (v.completed) {
        lastCompletedLectureObj = {
          id: v.id,
          title: v.title,
          sectionName: "Playlist Videos",
          sectionIndex: 0,
          url: v.url
        };
      }
      if (!v.completed && !nextLectureObj) {
        nextLectureObj = {
          id: v.id,
          title: v.title,
          sectionName: "Playlist Videos",
          sectionIndex: 0,
          url: v.url
        };
      }
    }

    // P0 requirement: Only calculate playlist duration when trusted header exists or every video duration is valid
    let finalDuration = this.scrapePlaylistHeaderDuration(ytInitialData);
    if (!finalDuration) {
      const everyDurationIsValid = uniqueVideos.every(v => this.parseTimeToSeconds(v.duration) > 0);
      if (everyDurationIsValid && uniqueVideos.length > 0 && !(totalVideosInPlaylist > 0 && totalCount < totalVideosInPlaylist)) {
        finalDuration = this.formatTotalDuration(totalSeconds);
        finalDuration = this.checkPartialDuration(totalCount, finalDuration, ytInitialData);
      } else {
        if (totalVideosInPlaylist > 0 && totalCount < totalVideosInPlaylist) {
          finalDuration = `Incomplete (${totalCount}/${totalVideosInPlaylist} loaded)`;
        } else {
          finalDuration = "Unknown Duration";
        }
      }
    }

    return {
      platform: "youtube",
      type: "course",
      title: title || "Unknown YouTube Playlist",
      instructor: creator || "Unknown Creator",
      description: description,
      duration: finalDuration,
      url: window.location.href,
      sectionsCount: 1,
      lecturesCount: totalCount,
      learningObjectives: [],
      prerequisites: [],
      sections: sections,
      progress: progressState,
      currentLecture: null,
      lastCompletedLecture: lastCompletedLectureObj,
      nextLecture: nextLectureObj
    };
  },

  // Extract from watch page inside playlist (/watch?v=...&list=PL...)
  async extractWatchPage() {
    const ytInitialData = this.getYtInitialData();
    
    let title = "";
    try {
      const playlist = ytInitialData?.contents?.twoColumnWatchNextResults?.playlist?.playlist;
      if (playlist) {
        title = playlist.title || "";
      }
    } catch (e) {}
    
    if (!title) {
      const panelEl = document.querySelector('ytd-playlist-panel-renderer');
      if (panelEl) {
        const titleEl = panelEl.querySelector('.title a, #title a, #header-description h3 a');
        if (titleEl) {
          title = titleEl.innerText.trim();
        }
      }
    }
    if (!title) {
      title = document.querySelector('ytd-playlist-panel-renderer #title')?.innerText.trim() || "YouTube Playlist";
    }

    const creator = this.scrapeWatchPlaylistCreator(ytInitialData);

    // Scrape current video's description for playlist output schema (independent block)
    let currentVideoDescription = "";
    try {
      const jsonLdData = this.getJsonLdData();
      const ytInitialPlayerResponse = this.getYtInitialPlayerResponse();
      
      if (jsonLdData?.description) {
        currentVideoDescription = jsonLdData.description;
      } else if (ytInitialPlayerResponse?.videoDetails) {
        currentVideoDescription = ytInitialPlayerResponse.videoDetails.shortDescription || "";
      }
      if (!currentVideoDescription) {
        await this.expandDescriptionDOM();
        const descEl = document.querySelector('#description-inline-expander, #description-text, ytd-text-inline-expander');
        if (descEl) {
          currentVideoDescription = descEl.innerText.trim();
        }
      }
    } catch (e) {
      console.warn("[AIIngest] Failed to extract current video description:", e);
    }

    const rawVideos = [];
    
    // Tier 1: Try parsing playlist items from ytInitialData
    let playlistContents = null;
    try {
      playlistContents = ytInitialData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;
    } catch (e) {}
    
    if (Array.isArray(playlistContents) && playlistContents.length > 0) {
      playlistContents.forEach((item, index) => {
        const renderer = item.playlistPanelVideoRenderer;
        if (!renderer) return;
        
        const vTitle = renderer.title?.simpleText || renderer.title?.runs?.[0]?.text || "Unknown Video";
        const videoId = renderer.videoId;
        const vUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}&list=${renderer.playlistId || ""}` : "";
        
        let vDuration = renderer.lengthText?.simpleText || (renderer.lengthText?.runs?.[0]?.text) || "";
        const isCurrent = !!renderer.selected;
        
        let isCompleted = false;
        if (renderer.thumbnailOverlays) {
          for (let overlay of renderer.thumbnailOverlays) {
            const resume = overlay.thumbnailOverlayResumePlaybackRenderer;
            if (resume && typeof resume.percentDurationWatched === "number") {
              isCompleted = resume.percentDurationWatched > 80;
              break;
            }
          }
        }
        
        rawVideos.push({
          title: vTitle,
          duration: vDuration,
          type: "video",
          completed: isCompleted,
          isCurrent: isCurrent,
          url: vUrl
        });
      });
    } else {
      // Tier 4: Fallback to DOM scraping
      let videoEls = [];
      const panelEl = document.querySelector('ytd-playlist-panel-renderer');
      if (panelEl) {
        videoEls = panelEl.querySelectorAll('ytd-playlist-panel-video-renderer');
      }

      if (videoEls.length > 0) {
        videoEls.forEach((el, index) => {
          const titleEl = el.querySelector('#video-title');
          const linkEl = el.querySelector('a#wc-endpoint, a');
          if (!titleEl) return;
          const vTitle = titleEl.innerText.trim();
          const vUrl = linkEl ? linkEl.href : window.location.href;

          let vDuration = "";
          const durationEl = el.querySelector('#duration');
          if (durationEl) {
            vDuration = durationEl.innerText.trim();
          }

          const isCurrent = el.hasAttribute('selected') || 
                            el.classList.contains('selected') ||
                            el.getAttribute('aria-selected') === 'true' ||
                            !!el.querySelector('[aria-current="true"]') ||
                            !!el.querySelector('[aria-current="step"]');

          const progressEl = el.querySelector('#progress');
          let isCompleted = false;
          if (progressEl) {
            const pct = this.getProgressPercent(progressEl);
            isCompleted = pct > 80;
          }

          rawVideos.push({
            title: vTitle,
            duration: vDuration,
            type: "video",
            completed: isCompleted,
            isCurrent: isCurrent,
            url: vUrl
          });
        });
      }
    }

    // Deduplicate videos by Video ID
    const seenIds = new Set();
    const uniqueVideos = [];
    rawVideos.forEach(v => {
      const vId = this.getVideoIdFromUrl(v.url) || v.title;
      if (vId && !seenIds.has(vId)) {
        seenIds.add(vId);
        uniqueVideos.push(v);
      }
    });

    let completedCount = 0;
    let totalSeconds = 0;
    let currentLectureObj = null;
    let validDurationsCount = 0;
    let missingDurationsCount = 0;

    uniqueVideos.forEach((v, index) => {
      v.id = index + 1;
      if (v.completed) {
        completedCount++;
      }
      const seconds = this.parseTimeToSeconds(v.duration);
      if (seconds > 0) {
        totalSeconds += seconds;
        validDurationsCount++;
      } else {
        missingDurationsCount++;
      }

      if (v.isCurrent) {
        currentLectureObj = {
          id: v.id,
          title: v.title,
          sectionName: "Playlist Videos",
          sectionIndex: 0,
          url: v.url,
          description: currentVideoDescription
        };
      }
    });

    // Logging requirement
    console.log(`[AIIngest] Playlist Duration Calculation Debug:`, {
      playlistVideosFound: uniqueVideos.length,
      videosWithDuration: validDurationsCount,
      totalSeconds: totalSeconds
    });

    if (!currentLectureObj && uniqueVideos.length > 0) {
      const currentUrl = window.location.href;
      const match = uniqueVideos.find(v => v.url && (v.url.includes(currentUrl) || currentUrl.includes(v.url) || (v.url.split('&')[0] === currentUrl.split('&')[0])));
      if (match) {
        match.isCurrent = true;
        currentLectureObj = {
          id: match.id,
          title: match.title,
          sectionName: "Playlist Videos",
          sectionIndex: 0,
          url: match.url,
          description: currentVideoDescription
        };
      }
    }

    let totalVideosInPlaylist = 0;
    if (ytInitialData?.header?.playlistHeaderRenderer) {
      const numVideosText = ytInitialData.header.playlistHeaderRenderer.numVideosText;
      if (numVideosText) {
        const txt = numVideosText.simpleText || (numVideosText.runs && numVideosText.runs[0] && numVideosText.runs[0].text) || "";
        const match = txt.match(/(\d+)/);
        if (match) {
          totalVideosInPlaylist = parseInt(match[1], 10);
        }
      }
    }
    if (totalVideosInPlaylist === 0) {
      const statsContainer = document.querySelector('ytd-playlist-header-renderer #stats, ytd-playlist-byline-renderer #stats, ytd-playlist-panel-renderer #num-items, ytd-playlist-panel-renderer #playlist-items-count');
      if (statsContainer) {
        const match = statsContainer.innerText.match(/(\d+)/);
        if (match) {
          totalVideosInPlaylist = parseInt(match[1], 10);
        }
      }
    }

    const totalCount = uniqueVideos.length;
    const progressState = {
      completedLecturesCount: completedCount,
      remainingLecturesCount: totalCount - completedCount,
      totalLecturesCount: totalCount,
      completedSectionsCount: completedCount === totalCount && totalCount > 0 ? 1 : 0,
      remainingSectionsCount: completedCount === totalCount && totalCount > 0 ? 0 : 1,
      totalSectionsCount: 1,
      percentComplete: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    };

    const sections = [{
      name: "Playlist Videos",
      completed: completedCount === totalCount && totalCount > 0,
      completedCount: completedCount,
      totalCount: totalCount,
      lectures: uniqueVideos
    }];

    let lastCompletedLectureObj = null;
    let nextLectureObj = null;

    for (let i = 0; i < uniqueVideos.length; i++) {
      const v = uniqueVideos[i];
      if (v.completed) {
        lastCompletedLectureObj = {
          id: v.id,
          title: v.title,
          sectionName: "Playlist Videos",
          sectionIndex: 0,
          url: v.url
        };
      }
      if (!v.completed && !nextLectureObj) {
        nextLectureObj = {
          id: v.id,
          title: v.title,
          sectionName: "Playlist Videos",
          sectionIndex: 0,
          url: v.url
        };
      }
    }

    // P0 requirement: Only calculate playlist duration when trusted header exists or every video duration is valid
    let finalDuration = this.scrapePlaylistHeaderDuration(ytInitialData);
    if (!finalDuration) {
      const everyDurationIsValid = uniqueVideos.every(v => this.parseTimeToSeconds(v.duration) > 0);
      if (everyDurationIsValid && uniqueVideos.length > 0 && !(totalVideosInPlaylist > 0 && totalCount < totalVideosInPlaylist)) {
        finalDuration = this.formatTotalDuration(totalSeconds);
        finalDuration = this.checkPartialDuration(totalCount, finalDuration, ytInitialData);
      } else {
        if (totalVideosInPlaylist > 0 && totalCount < totalVideosInPlaylist) {
          finalDuration = `Incomplete (${totalCount}/${totalVideosInPlaylist} loaded)`;
        } else {
          finalDuration = "Unknown Duration";
        }
      }
    }

    return {
      platform: "youtube",
      type: "course",
      title: title || "Unknown YouTube Playlist",
      instructor: creator || "Unknown Creator",
      description: "",
      duration: finalDuration,
      url: window.location.href,
      sectionsCount: 1,
      lecturesCount: totalCount,
      learningObjectives: [],
      prerequisites: [],
      sections: sections,
      progress: progressState,
      currentLecture: currentLectureObj,
      lastCompletedLecture: lastCompletedLectureObj,
      nextLecture: nextLectureObj
    };
  },

  // Extract standalone watch pages
  async extractSingleVideo() {
    const jsonLdData = this.getJsonLdData();
    const ytInitialPlayerResponse = this.getYtInitialPlayerResponse();

    let title = "";
    let creator = "";
    let duration = "Unknown Duration";
    let description = "";
    let publishDate = "";
    let parsedChapters = [];
    let currentTimeSecs = 0;
    let totalTimeSecs = 0;
    let percentComplete = 0;

    // Independent Extraction: Title
    try {
      if (jsonLdData?.name) {
        title = jsonLdData.name;
      } else if (ytInitialPlayerResponse?.videoDetails) {
        title = ytInitialPlayerResponse.videoDetails.title || "";
      }
      if (!title) {
        const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-watch-metadata, ytd-video-primary-info-renderer h1.title');
        title = titleEl ? titleEl.innerText.trim() : document.title.replace(/ - YouTube$/i, "").trim();
      }
    } catch (e) {
      console.warn("[AIIngest] Failed to extract title:", e);
    }
    if (!title) title = "Unknown Title";

    // Independent Extraction: Creator
    try {
      if (jsonLdData?.author) {
        creator = jsonLdData.author;
      } else if (ytInitialPlayerResponse?.videoDetails) {
        creator = ytInitialPlayerResponse.videoDetails.author || "";
      }
      if (!creator) {
        const creatorSelectors = [
          'ytd-video-owner-renderer #channel-name a',
          'ytd-watch-metadata #owner #channel-name a',
          'ytd-video-owner-renderer a',
          '#upload-info #text a',
          '#owner-name a'
        ];
        for (let selector of creatorSelectors) {
          const el = document.querySelector(selector);
          if (el && el.innerText.trim()) {
            creator = el.innerText.trim();
            break;
          }
        }
      }
    } catch (e) {
      console.warn("[AIIngest] Failed to extract creator:", e);
    }
    if (!creator) creator = "Unknown Creator";

    // Independent Extraction: Duration
    try {
      if (jsonLdData?.duration) {
        totalTimeSecs = this.parseISO8601Duration(jsonLdData.duration);
      }
      if (totalTimeSecs <= 0 && ytInitialPlayerResponse?.videoDetails) {
        totalTimeSecs = parseInt(ytInitialPlayerResponse.videoDetails.lengthSeconds, 10) || 0;
      }
      
      if (totalTimeSecs > 0) {
        const hrs = Math.floor(totalTimeSecs / 3600);
        const mins = Math.floor((totalTimeSecs % 3600) / 60);
        const secs = totalTimeSecs % 60;
        if (hrs > 0) {
          duration = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
          duration = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
      } else {
        const durationEl = document.querySelector('.ytp-time-duration');
        if (durationEl && durationEl.innerText.trim()) {
          duration = durationEl.innerText.trim();
        }
        totalTimeSecs = this.parseTimeToSeconds(duration);
      }
    } catch (e) {
      console.warn("[AIIngest] Failed to extract duration:", e);
    }

    // Independent Extraction: Description (P0 requirement)
    try {
      if (jsonLdData?.description) {
        description = jsonLdData.description;
      } else if (ytInitialPlayerResponse?.videoDetails) {
        description = ytInitialPlayerResponse.videoDetails.shortDescription || "";
      }
      if (!description) {
        await this.expandDescriptionDOM();
        const descEl = document.querySelector('#description-inline-expander, #description-text, ytd-text-inline-expander');
        if (descEl) {
          description = descEl.innerText.trim();
        }
      }
    } catch (e) {
      console.warn("[AIIngest] Failed to extract description:", e);
    }

    // Independent Extraction: Publish Date
    try {
      if (jsonLdData?.uploadDate) {
        publishDate = jsonLdData.uploadDate;
      } else if (ytInitialPlayerResponse?.microformat?.playerMicroformatRenderer) {
        publishDate = ytInitialPlayerResponse.microformat.playerMicroformatRenderer.publishDate || "";
      }
      if (!publishDate) {
        publishDate = this.scrapePublishDate();
      }
    } catch (e) {
      console.warn("[AIIngest] Failed to extract publish date:", e);
    }

    // Independent Extraction: Chapters
    try {
      parsedChapters = this.parseChapters(description);
    } catch (e) {
      console.warn("[AIIngest] Failed to parse chapters:", e);
    }

    // Independent Extraction: Progress
    try {
      const curTimeEl = document.querySelector('.ytp-time-current');
      if (curTimeEl && curTimeEl.innerText.trim()) {
        const curTimeText = curTimeEl.innerText.trim();
        if (curTimeText.startsWith('-')) {
          const remainingTimeSecs = this.parseTimeToSeconds(curTimeText.substring(1));
          currentTimeSecs = Math.max(0, totalTimeSecs - remainingTimeSecs);
        } else {
          currentTimeSecs = this.parseTimeToSeconds(curTimeText);
        }
        if (totalTimeSecs > 0) {
          percentComplete = Math.round((currentTimeSecs / totalTimeSecs) * 100);
        }
      }
      percentComplete = Math.max(0, Math.min(percentComplete, 100));
    } catch (e) {
      console.warn("[AIIngest] Failed to extract progress:", e);
    }

    const mappedLectures = [];
    let currentLectureObj = null;
    let completedCount = 0;

    if (parsedChapters.length > 0) {
      parsedChapters.forEach((ch, idx) => {
        const nextCh = parsedChapters[idx + 1];
        const isCompleted = currentTimeSecs >= ch.timestamp;
        const isCurrent = currentTimeSecs >= ch.timestamp && (!nextCh || currentTimeSecs < nextCh.timestamp);
        
        if (isCompleted) {
          completedCount++;
        }

        const lectureRef = {
          id: idx + 1,
          title: ch.title,
          duration: ch.timeStr,
          type: "video_chapter",
          completed: isCompleted,
          isCurrent: isCurrent,
          url: `${window.location.href.split('&t=')[0]}&t=${ch.timestamp}s`
        };

        mappedLectures.push(lectureRef);

        if (isCurrent) {
          currentLectureObj = {
            id: lectureRef.id,
            title: lectureRef.title,
            sectionName: "Chapters",
            sectionIndex: 0,
            url: lectureRef.url
          };
        }
      });
    } else {
      const isCompleted = percentComplete > 80;
      const singleLecture = {
        id: 1,
        title: title,
        duration: duration,
        type: "video",
        completed: isCompleted,
        isCurrent: true,
        url: window.location.href
      };
      mappedLectures.push(singleLecture);
      currentLectureObj = {
        id: 1,
        title: title,
        sectionName: "Video",
        sectionIndex: 0,
        url: window.location.href
      };
      completedCount = isCompleted ? 1 : 0;
    }

    const sections = [{
      name: parsedChapters.length > 0 ? "Chapters" : "Video",
      completed: completedCount === mappedLectures.length,
      completedCount: completedCount,
      totalCount: mappedLectures.length,
      lectures: mappedLectures
    }];

    const totalCount = mappedLectures.length;
    const progressState = {
      completedLecturesCount: completedCount,
      remainingLecturesCount: totalCount - completedCount,
      totalLecturesCount: totalCount,
      completedSectionsCount: completedCount === totalCount ? 1 : 0,
      remainingSectionsCount: completedCount === totalCount ? 0 : 1,
      totalSectionsCount: 1,
      percentComplete: percentComplete,
      currentTimeSeconds: currentTimeSecs,
      remainingTimeSeconds: Math.max(0, totalTimeSecs - currentTimeSecs)
    };

    let lastCompletedLectureObj = null;
    let nextLectureObj = null;

    for (let i = 0; i < mappedLectures.length; i++) {
      const v = mappedLectures[i];
      if (v.completed) {
        lastCompletedLectureObj = {
          id: v.id,
          title: v.title,
          sectionName: sections[0].name,
          sectionIndex: 0,
          url: v.url
        };
      }
      if (!v.completed && !nextLectureObj) {
        nextLectureObj = {
          id: v.id,
          title: v.title,
          sectionName: sections[0].name,
          sectionIndex: 0,
          url: v.url
        };
      }
    }

    return {
      platform: "youtube",
      type: "video",
      title: title,
      instructor: creator,
      description: description,
      duration: duration,
      url: window.location.href,
      publishDate: publishDate,
      sectionsCount: 1,
      lecturesCount: totalCount,
      learningObjectives: [],
      prerequisites: [],
      sections: sections,
      progress: progressState,
      currentLecture: currentLectureObj,
      lastCompletedLecture: lastCompletedLectureObj,
      nextLecture: nextLectureObj,
      chapters: parsedChapters
    };
  },

  resetState() {
    // Clear any instance-specific or cached state to prevent SPA state contamination
    this._cachedData = null;
    this._cachedPlayerResponse = null;
    console.log("[AIIngest] YouTubeExtractor state reset completed.");
  },

  async extract() {
    this.resetState();
    if (this.isPlaylistPage()) {
      return this.extractPlaylistPage();
    } else if (this.isWatchPageWithPlaylist()) {
      return this.extractWatchPage();
    } else if (this.isWatchPageWithoutPlaylist()) {
      return this.extractSingleVideo();
    }
    
    throw new Error("Not on a valid YouTube Playlist page or Video page.");
  }
};
