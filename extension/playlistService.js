/**
 * YouTube Playlist Service
 * Fetches playlist details, handles pagination, batching video duration requests, and calculation.
 */
const YouTubePlaylistService = {
  // Helper to format seconds into "M:SS" or "H:MM:SS" format for individual videos
  formatSecondsToTimeStr(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  async fetchPlaylistDetails(playlistId) {
    if (!playlistId) {
      throw new Error("Playlist ID is required");
    }

    if (typeof YouTubeApi === "undefined") {
      throw new Error("YouTubeApi is not loaded");
    }

    // 1. Fetch Playlist Metadata
    const playlistData = await YouTubeApi.fetchFromApi("playlists", {
      part: "snippet,contentDetails",
      id: playlistId
    });

    if (!playlistData.items || playlistData.items.length === 0) {
      throw new Error("Playlist not found or is private");
    }

    const playlistItem = playlistData.items[0];
    const playlistSnippet = playlistItem.snippet || {};
    const playlistContentDetails = playlistItem.contentDetails || {};
    const totalCount = playlistContentDetails.itemCount || 0;

    // 2. Fetch Playlist Video Items (with Pagination)
    let allItems = [];
    let nextPageToken = "";
    
    // Safety limit to prevent infinite loops (max 1000 items)
    const maxPages = 20;
    let pagesFetched = 0;

    do {
      const params = {
        part: "snippet,contentDetails",
        playlistId: playlistId,
        maxResults: 50
      };
      if (nextPageToken) {
        params.pageToken = nextPageToken;
      }

      const response = await YouTubeApi.fetchFromApi("playlistItems", params);
      if (response.items && response.items.length > 0) {
        allItems = allItems.concat(response.items);
      }
      nextPageToken = response.nextPageToken || "";
      pagesFetched++;
    } while (nextPageToken && pagesFetched < maxPages);

    // 3. Batch Request Video Durations (max 50 per batch)
    const videoIds = allItems.map(item => item.contentDetails?.videoId).filter(Boolean);
    const idToDurationSecondsMap = {};

    for (let i = 0; i < videoIds.length; i += 50) {
      const batchIds = videoIds.slice(i, i + 50);
      const batchData = await YouTubeApi.fetchFromApi("videos", {
        part: "contentDetails",
        id: batchIds.join(",")
      });

      if (batchData.items) {
        batchData.items.forEach(v => {
          if (typeof YouTubeVideoService !== "undefined" && YouTubeVideoService.parseISO8601Duration) {
            idToDurationSecondsMap[v.id] = YouTubeVideoService.parseISO8601Duration(v.contentDetails?.duration);
          } else {
            // Basic parsing fallback
            idToDurationSecondsMap[v.id] = 0;
          }
        });
      }
    }

    // 4. Construct Playlist Video List
    let totalSeconds = 0;
    const playlistVideos = allItems.map((item, index) => {
      const snippet = item.snippet || {};
      const videoId = item.contentDetails?.videoId || "";
      const durationSeconds = idToDurationSecondsMap[videoId] || 0;
      totalSeconds += durationSeconds;

      return {
        id: index + 1,
        videoId: videoId,
        title: snippet.title || "Deleted/Private Video",
        duration: this.formatSecondsToTimeStr(durationSeconds),
        durationSeconds: durationSeconds,
        type: "video",
        completed: false,
        isCurrent: false,
        url: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}&index=${index + 1}`
      };
    });

    let formattedTotalDuration = "Unknown Duration";
    if (totalSeconds > 0) {
      if (typeof LearningSchema !== "undefined" && LearningSchema.formatDuration) {
        formattedTotalDuration = LearningSchema.formatDuration(totalSeconds);
      } else {
        const totalMinutes = Math.round(totalSeconds / 60);
        formattedTotalDuration = `${totalMinutes}m`;
      }
    }

    return {
      platform: "youtube",
      type: "course",
      title: playlistSnippet.title || "Unknown Playlist",
      instructor: playlistSnippet.channelTitle || "Unknown Creator",
      description: playlistSnippet.description || "",
      duration: formattedTotalDuration,
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      sectionsCount: 1,
      lecturesCount: playlistVideos.length,
      sections: [
        {
          name: "Playlist Videos",
          completed: false,
          completedCount: 0,
          totalCount: playlistVideos.length,
          lectures: playlistVideos
        }
      ]
    };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = YouTubePlaylistService;
}
