/**
 * YouTube Video Service
 * Fetches single video details and handles duration parsing / chapter extraction.
 */
const YouTubeVideoService = {
  // Parses ISO 8601 duration string into seconds (e.g. PT1H23M45S -> 5025)
  parseISO8601Duration(durationStr) {
    if (!durationStr) return 0;
    // P[n]DT[n]H[n]M[n]S
    const match = durationStr.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i);
    if (!match) return 0;
    const days = parseInt(match[1] || 0, 10);
    const hours = parseInt(match[2] || 0, 10);
    const minutes = parseInt(match[3] || 0, 10);
    const seconds = parseInt(match[4] || 0, 10);
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  },

  // Parses description text to find timestamps and extract them as chapters
  parseChapters(descriptionText) {
    const chapters = [];
    if (!descriptionText) return chapters;

    const lines = descriptionText.split('\n');
    // Match standard timestamps like 00:00, 0:00, 1:23:45, etc.
    const timestampRegex = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/;

    lines.forEach(line => {
      const match = line.match(timestampRegex);
      if (match) {
        const timeStr = match[0];
        
        // Ensure timestamp is at the start of the line (allows up to 4 leading chars like bullet points/brackets)
        const startsWithTime = line.trim().indexOf(timeStr) <= 4;
        if (!startsWithTime) return;

        let timestamp = 0;
        
        if (typeof LearningSchema !== "undefined" && LearningSchema.parseDurationToSeconds) {
          timestamp = LearningSchema.parseDurationToSeconds(timeStr);
        } else {
          // Fallback parser
          const parts = timeStr.split(':').map(Number);
          if (parts.length === 2) {
            timestamp = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            timestamp = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        let title = line.replace(timeStr, '');
        // Strip delimiters
        title = title.replace(/^\s*[-–—:|[\]()]\s*/, '')
                     .replace(/\s*[-–—:|[\]()]\s*$/, '')
                     .trim();

        // Clean chapter title via LearningSchema clean helper if available
        if (typeof LearningSchema !== "undefined" && LearningSchema.cleanChapterTitle) {
          title = LearningSchema.cleanChapterTitle(title);
        }

        if (title.length > 0) {
          chapters.push({ title, timestamp, timeStr });
        }
      }
    });

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

  // Calls the YouTube Data API to fetch video metadata
  async fetchVideoDetails(videoId) {
    if (!videoId) {
      throw new Error("Video ID is required");
    }

    if (typeof YouTubeApi === "undefined") {
      throw new Error("YouTubeApi is not loaded");
    }

    const data = await YouTubeApi.fetchFromApi("videos", {
      part: "snippet,contentDetails",
      id: videoId
    });

    if (!data.items || data.items.length === 0) {
      throw new Error("Video not found or is private");
    }

    const item = data.items[0];
    const snippet = item.snippet || {};
    const contentDetails = item.contentDetails || {};

    const durationSeconds = this.parseISO8601Duration(contentDetails.duration);
    
    let formattedDuration = "Unknown Duration";
    if (durationSeconds > 0) {
      if (typeof LearningSchema !== "undefined" && LearningSchema.formatDuration) {
        formattedDuration = LearningSchema.formatDuration(durationSeconds);
      } else {
        const mins = Math.round(durationSeconds / 60);
        formattedDuration = `${mins}m`;
      }
    }

    const chapters = this.parseChapters(snippet.description || "");

    return {
      platform: "youtube",
      type: "video",
      videoId: videoId,
      title: snippet.title || "Unknown YouTube Video",
      instructor: snippet.channelTitle || "Unknown Channel",
      description: snippet.description || "",
      duration: formattedDuration,
      durationSeconds: durationSeconds,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishDate: snippet.publishedAt ? snippet.publishedAt.substring(0, 10) : "",
      chapters: chapters
    };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = YouTubeVideoService;
}
