/**
 * YouTube Page State Extractor
 * Reads real-time playback stats directly from the HTML5 video player and 
 * scans playlist DOM components for thumbnail watched overlays.
 */
const PageStateExtractor = {
  // Scrapes current video player playback statistics
  extractCurrentWatchProgress() {
    const videoEl = document.querySelector('video.html5-main-video');
    if (!videoEl) {
      return {
        percentComplete: 0,
        currentTimeSeconds: 0,
        remainingTimeSeconds: 0
      };
    }

    const currentTimeSeconds = Math.round(videoEl.currentTime) || 0;
    const durationSeconds = Math.round(videoEl.duration) || 0;
    
    let percentComplete = 0;
    if (durationSeconds > 0) {
      percentComplete = Math.max(0, Math.min(100, Math.round((currentTimeSeconds / durationSeconds) * 100)));
    }
    
    const remainingTimeSeconds = Math.max(0, durationSeconds - currentTimeSeconds);

    return {
      percentComplete,
      currentTimeSeconds,
      remainingTimeSeconds
    };
  },

  // Scrapes playlist items or panel items from DOM to determine watched percentage
  extractPlaylistDOMProgress() {
    const progressMap = {};
    
    // Select elements in playlists or watch page playlist panel
    const items = document.querySelectorAll(
      'ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer, ytd-compact-video-renderer'
    );
    
    items.forEach(item => {
      const linkEl = item.querySelector('a#video-title, a.ytd-playlist-video-renderer, a.ytd-playlist-panel-video-renderer, a.ytd-compact-video-renderer, a#thumbnail');
      if (!linkEl || !linkEl.href) return;
      
      let videoId = null;
      try {
        const url = new URL(linkEl.href, window.location.href);
        videoId = url.searchParams.get("v");
      } catch (e) {}

      if (!videoId) {
        const match = linkEl.href.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (match) videoId = match[1];
      }

      if (!videoId) return;

      // Look for the red progress bar inside thumbnail overlay
      const progressEl = item.querySelector('ytd-thumbnail-overlay-resume-playback-renderer #progress, #progress');
      let percentComplete = 0;
      if (progressEl) {
        const style = progressEl.getAttribute("style") || "";
        const match = style.match(/width:\s*([\d\.]+)%/);
        if (match) {
          percentComplete = Math.round(parseFloat(match[1]));
        }
      }

      const completed = percentComplete >= 85;

      progressMap[videoId] = {
        percentComplete,
        completed
      };
    });

    return progressMap;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PageStateExtractor;
}
