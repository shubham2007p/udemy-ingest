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

  // Helper to format total seconds into a readable string (e.g., "3h 45m")
  formatTotalDuration(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds)) return "Unknown Duration";
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.round((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
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

  // Scrape playlist creator with cascading fallbacks (Issue 4)
  scrapePlaylistCreator() {
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
    // Fallback: Check creator of first video in list
    const firstVideoCreator = document.querySelector('ytd-playlist-video-renderer #channel-name a, ytd-playlist-video-renderer .yt-simple-endpoint');
    if (firstVideoCreator && firstVideoCreator.innerText.trim()) {
      return firstVideoCreator.innerText.trim();
    }
    return "Unknown Creator";
  },

  // Scrape watch page playlist creator with cascading fallbacks (Issue 4)
  scrapeWatchPlaylistCreator() {
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
    // Fallback: Check creator of currently playing video
    const videoOwner = document.querySelector('ytd-video-owner-renderer #channel-name a, ytd-watch-metadata #owner #channel-name a, #upload-info #text a');
    if (videoOwner && videoOwner.innerText.trim()) {
      return videoOwner.innerText.trim();
    }
    return "Unknown Creator";
  },

  // Scrape playlist header duration info (Issue 3)
  scrapePlaylistHeaderDuration() {
    const statsContainer = document.querySelector('ytd-playlist-header-renderer #stats, ytd-playlist-byline-renderer #stats, ytd-playlist-header-renderer #metadata-line');
    if (statsContainer) {
      const spans = statsContainer.querySelectorAll('span, yt-formatted-string');
      for (let span of spans) {
        const text = span.innerText || "";
        if (/\d+\s*(hour|minute|second|hr|min)/i.test(text)) {
          return text.trim();
        }
      }
    }
    return null;
  },

  // Helper to determine if we should append a '+' sign to the calculated duration
  // by comparing DOM video count to the scraped total video count (Issue 3)
  checkPartialDuration(scrapedCount, calculatedDuration) {
    if (!calculatedDuration || calculatedDuration === "Unknown Duration") return calculatedDuration;
    
    let totalVideosInPlaylist = 0;
    const statsContainer = document.querySelector('ytd-playlist-header-renderer #stats, ytd-playlist-byline-renderer #stats, ytd-playlist-panel-renderer #num-items, ytd-playlist-panel-renderer #playlist-items-count');
    if (statsContainer) {
      const match = statsContainer.innerText.match(/(\d+)\s*(videos|items)/i);
      if (match) {
        totalVideosInPlaylist = parseInt(match[1], 10);
      }
    }

    if (totalVideosInPlaylist > 0 && scrapedCount < totalVideosInPlaylist) {
      if (!calculatedDuration.endsWith("+")) {
        return calculatedDuration + "+";
      }
    }
    return calculatedDuration;
  },

  // Extract from playlist page (/playlist?list=PL...)
  async extractPlaylistPage() {
    let title = "";
    const titleEl = document.querySelector('ytd-playlist-header-renderer h1#title, ytd-playlist-header-renderer #title a, h1#title');
    if (titleEl) {
      title = titleEl.innerText.trim();
    } else {
      title = document.title.replace(/ - YouTube$/i, "").trim();
    }

    const creator = this.scrapePlaylistCreator();

    let description = "";
    const descEl = document.querySelector('ytd-playlist-header-renderer #description-text, ytd-playlist-header-renderer #description');
    if (descEl) {
      description = descEl.innerText.trim();
    }

    const videos = [];
    const videoEls = document.querySelectorAll('ytd-playlist-video-renderer');
    let totalSeconds = 0;
    let completedCount = 0;

    videoEls.forEach((el, index) => {
      const titleLink = el.querySelector('a#video-title');
      if (!titleLink) return;
      const vTitle = titleLink.innerText.trim();
      const vUrl = titleLink.href || "";

      let vDuration = "";
      const durationEl = el.querySelector('ytd-thumbnail-overlay-time-status-renderer span, #time-status span, .ytd-thumbnail-overlay-time-status-renderer');
      if (durationEl) {
        vDuration = durationEl.innerText.trim();
        totalSeconds += this.parseTimeToSeconds(vDuration);
      }

      const progressEl = el.querySelector('#progress');
      let isCompleted = false;
      if (progressEl) {
        const pct = this.getProgressPercent(progressEl);
        isCompleted = pct > 80;
      }

      if (isCompleted) {
        completedCount++;
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

    const totalCount = videos.length;
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
      lectures: videos
    }];

    let lastCompletedLectureObj = null;
    let nextLectureObj = null;

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
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

    // Determine final duration: try header first, then fallback to visible sum (Issue 3)
    let finalDuration = this.scrapePlaylistHeaderDuration();
    if (!finalDuration) {
      finalDuration = this.formatTotalDuration(totalSeconds);
      finalDuration = this.checkPartialDuration(totalCount, finalDuration);
    }

    return {
      platform: "youtube",
      title: title || "Unknown YouTube Playlist",
      instructor: creator || "Unknown Creator",
      description: description,
      duration: finalDuration,
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
    let title = "";
    const panelEl = document.querySelector('ytd-playlist-panel-renderer');
    if (panelEl) {
      const titleEl = panelEl.querySelector('.title a, #title a, #header-description h3 a');
      if (titleEl) {
        title = titleEl.innerText.trim();
      }
    }
    if (!title) {
      title = document.querySelector('ytd-playlist-panel-renderer #title')?.innerText.trim() || "YouTube Playlist";
    }

    const creator = this.scrapeWatchPlaylistCreator();

    const videos = [];
    let videoEls = [];
    if (panelEl) {
      videoEls = panelEl.querySelectorAll('ytd-playlist-panel-video-renderer');
    }

    let totalSeconds = 0;
    let completedCount = 0;
    let currentLectureObj = null;

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
        totalSeconds += this.parseTimeToSeconds(vDuration);
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

      if (isCompleted) {
        completedCount++;
      }

      const videoData = {
        id: index + 1,
        title: vTitle,
        duration: vDuration,
        type: "video",
        completed: isCompleted,
        isCurrent: isCurrent,
        url: vUrl
      };

      if (isCurrent) {
        currentLectureObj = {
          id: videoData.id,
          title: videoData.title,
          sectionName: "Playlist Videos",
          sectionIndex: 0,
          url: vUrl
        };
      }

      videos.push(videoData);
    });

    if (!currentLectureObj && videos.length > 0) {
      const currentUrl = window.location.href;
      const match = videos.find(v => v.url && (v.url.includes(currentUrl) || currentUrl.includes(v.url) || (v.url.split('&')[0] === currentUrl.split('&')[0])));
      if (match) {
        match.isCurrent = true;
        currentLectureObj = {
          id: match.id,
          title: match.title,
          sectionName: "Playlist Videos",
          sectionIndex: 0,
          url: match.url
        };
      }
    }

    const totalCount = videos.length;
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
      lectures: videos
    }];

    let lastCompletedLectureObj = null;
    let nextLectureObj = null;

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
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

    // Duration check (Issue 3)
    let finalDuration = this.scrapePlaylistHeaderDuration();
    if (!finalDuration) {
      finalDuration = this.formatTotalDuration(totalSeconds);
      finalDuration = this.checkPartialDuration(totalCount, finalDuration);
    }

    return {
      platform: "youtube",
      title: title || "Unknown YouTube Playlist",
      instructor: creator || "Unknown Creator",
      description: "",
      duration: finalDuration,
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

  // Extract standalone watch pages (Issue 2)
  async extractSingleVideo() {
    let title = "";
    const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-watch-metadata, ytd-video-primary-info-renderer h1.title');
    if (titleEl) {
      title = titleEl.innerText.trim();
    } else {
      title = document.title.replace(/ - YouTube$/i, "").trim();
    }

    // Scrape video creator using specific selectors (Issue 4)
    let creator = "";
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
    if (!creator) creator = "Unknown Creator";

    // Duration
    let duration = "Unknown Duration";
    const durationEl = document.querySelector('.ytp-time-duration');
    if (durationEl && durationEl.innerText.trim()) {
      duration = durationEl.innerText.trim();
    }

    // Description
    let description = "";
    const descEl = document.querySelector('#description-inline-expander, #description-text, ytd-text-inline-expander');
    if (descEl) {
      description = descEl.innerText.trim();
    }

    // Progress determination from watch player state
    let isCompleted = false;
    let percentComplete = 0;
    const curTimeEl = document.querySelector('.ytp-time-current');
    if (curTimeEl && durationEl && durationEl.innerText.trim()) {
      const curSecs = this.parseTimeToSeconds(curTimeEl.innerText);
      const totalSecs = this.parseTimeToSeconds(durationEl.innerText);
      if (totalSecs > 0) {
        percentComplete = Math.round((curSecs / totalSecs) * 100);
        isCompleted = percentComplete > 80;
      }
    }

    const videos = [{
      id: 1,
      title: title,
      duration: duration,
      type: "video",
      completed: isCompleted,
      isCurrent: true,
      url: window.location.href
    }];

    const progressState = {
      completedLecturesCount: isCompleted ? 1 : 0,
      remainingLecturesCount: isCompleted ? 0 : 1,
      totalLecturesCount: 1,
      completedSectionsCount: isCompleted ? 1 : 0,
      remainingSectionsCount: isCompleted ? 0 : 1,
      totalSectionsCount: 1,
      percentComplete: percentComplete
    };

    const sections = [{
      name: "Single Video",
      completed: isCompleted,
      completedCount: isCompleted ? 1 : 0,
      totalCount: 1,
      lectures: videos
    }];

    const currentLectureObj = {
      id: 1,
      title: title,
      sectionName: "Single Video",
      sectionIndex: 0,
      url: window.location.href
    };

    return {
      platform: "youtube",
      title: title,
      instructor: creator,
      description: description,
      duration: duration,
      sectionsCount: 1,
      lecturesCount: 1,
      learningObjectives: [],
      prerequisites: [],
      sections: sections,
      progress: progressState,
      currentLecture: currentLectureObj,
      lastCompletedLecture: isCompleted ? currentLectureObj : null,
      nextLecture: isCompleted ? null : currentLectureObj
    };
  },

  async extract() {
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
