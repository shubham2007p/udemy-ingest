/**
 * YouTube Extractor
 * Scrapes YouTube playlist pages and watch pages inside playlists.
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

  // Extract from playlist page (/playlist?list=PL...)
  async extractPlaylistPage() {
    // 1. Scrape metadata
    let title = "";
    const titleEl = document.querySelector('ytd-playlist-header-renderer h1#title, ytd-playlist-header-renderer #title a, h1#title');
    if (titleEl) {
      title = titleEl.innerText.trim();
    } else {
      title = document.title.replace(/ - YouTube$/i, "").trim();
    }

    let creator = "";
    const creatorEl = document.querySelector('ytd-playlist-header-renderer #owner-text a, ytd-playlist-header-renderer #owner-container a, #owner-container #text a');
    if (creatorEl) {
      creator = creatorEl.innerText.trim();
    } else {
      // Fallback
      const channelLink = document.querySelector('ytd-playlist-header-renderer a[href*="/channel/"], ytd-playlist-header-renderer a[href*="/@"]');
      if (channelLink) creator = channelLink.innerText.trim();
    }

    let description = "";
    const descEl = document.querySelector('ytd-playlist-header-renderer #description-text, ytd-playlist-header-renderer #description');
    if (descEl) {
      description = descEl.innerText.trim();
    }

    // 2. Scrape videos
    const videos = [];
    const videoEls = document.querySelectorAll('ytd-playlist-video-renderer');
    let totalSeconds = 0;
    let completedCount = 0;

    videoEls.forEach((el, index) => {
      // Title & URL
      const titleLink = el.querySelector('a#video-title');
      if (!titleLink) return;
      const vTitle = titleLink.innerText.trim();
      const vUrl = titleLink.href || "";

      // Duration
      let vDuration = "";
      const durationEl = el.querySelector('ytd-thumbnail-overlay-time-status-renderer span, #time-status span, .ytd-thumbnail-overlay-time-status-renderer');
      if (durationEl) {
        vDuration = durationEl.innerText.trim();
        totalSeconds += this.parseTimeToSeconds(vDuration);
      }

      // Progress & Completed state
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

    // Construct flat section
    const sections = [{
      name: "Playlist Videos",
      completed: completedCount === totalCount && totalCount > 0,
      completedCount: completedCount,
      totalCount: totalCount,
      lectures: videos
    }];

    // Compute last completed and next video
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

    return {
      platform: "youtube",
      title: title || "Unknown YouTube Playlist",
      instructor: creator || "Unknown Creator",
      description: description,
      duration: this.formatTotalDuration(totalSeconds),
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
    // 1. Scrape metadata from playlist panel (usually on the right side)
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

    let creator = "";
    if (panelEl) {
      const creatorEl = panelEl.querySelector('#owner-name, #publisher-link, #publisher-container #publisher-link');
      if (creatorEl) {
        creator = creatorEl.innerText.trim();
      }
    }
    if (!creator) {
      creator = document.querySelector('ytd-playlist-panel-renderer #publisher-link')?.innerText.trim() || "Unknown Creator";
    }

    // 2. Scrape videos in the playlist panel
    const videos = [];
    let videoEls = [];
    if (panelEl) {
      videoEls = panelEl.querySelectorAll('ytd-playlist-panel-video-renderer');
    }

    let totalSeconds = 0;
    let completedCount = 0;
    let currentLectureObj = null;

    videoEls.forEach((el, index) => {
      // Title & URL
      const titleEl = el.querySelector('#video-title');
      const linkEl = el.querySelector('a#wc-endpoint, a');
      if (!titleEl) return;
      const vTitle = titleEl.innerText.trim();
      const vUrl = linkEl ? linkEl.href : window.location.href;

      // Duration
      let vDuration = "";
      const durationEl = el.querySelector('#duration');
      if (durationEl) {
        vDuration = durationEl.innerText.trim();
        totalSeconds += this.parseTimeToSeconds(vDuration);
      }

      // Check active state
      const isCurrent = el.hasAttribute('selected') || 
                        el.classList.contains('selected') ||
                        el.getAttribute('aria-selected') === 'true' ||
                        !!el.querySelector('[aria-current="true"]') ||
                        !!el.querySelector('[aria-current="step"]');

      // Progress & Completed state
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

    // Fallback: If we couldn't find the active item via attributes but we are on watch page, match URL
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

    // Construct flat section
    const sections = [{
      name: "Playlist Videos",
      completed: completedCount === totalCount && totalCount > 0,
      completedCount: completedCount,
      totalCount: totalCount,
      lectures: videos
    }];

    // Compute last completed and next video
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

    return {
      platform: "youtube",
      title: title || "Unknown YouTube Playlist",
      instructor: creator || "Unknown Creator",
      description: "",
      duration: this.formatTotalDuration(totalSeconds),
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

  async extract() {
    if (this.isPlaylistPage()) {
      return this.extractPlaylistPage();
    } else if (this.isWatchPageWithPlaylist()) {
      return this.extractWatchPage();
    }
    
    throw new Error("Not on a valid YouTube Playlist page or Playlist Watch page.");
  }
};
