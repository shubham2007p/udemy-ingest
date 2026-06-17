/**
 * JSON Generator
 * Generates structured JSON representation of course/playlist data.
 */
const JsonGenerator = {
  generate(data) {
    if (!data) return "";
    
    if (data.platform === "youtube") {
      if (data.type === "video") {
        // Format for YouTube Single Video
        const videoId = data.videoId || "";
        const durationSecs = typeof LearningSchema !== "undefined" ? LearningSchema.parseDurationToSeconds(data.duration) : 0;
        
        const topics = typeof LearningSchema !== "undefined" ? LearningSchema.extractLearningFocusAndUpcoming(data) : { focus: [], upcoming: [] };

        return JSON.stringify({
          platform: "youtube",
          type: "video",
          metadata: {
            title: data.title || "",
            creator: data.instructor || "",
            videoId: videoId || "",
            url: data.url || "",
            publishDate: data.publishDate || "",
            durationSeconds: durationSecs,
            durationFormatted: data.duration || ""
          },
          progress: {
            currentTimeSeconds: data.progress?.currentTimeSeconds !== null ? data.progress?.currentTimeSeconds : null,
            remainingTimeSeconds: data.progress?.remainingTimeSeconds !== null ? data.progress?.remainingTimeSeconds : null,
            percentage: data.progress?.percentComplete !== undefined ? data.progress.percentComplete : 0
          },
          learningFocus: {
            currentFocus: topics.focus,
            upcomingTopics: topics.upcoming
          },
          description: data.description || "",
          chapters: Array.isArray(data.chapters) ? data.chapters.map(c => ({
            title: c.title || "",
            timestamp: c.timeStr || "",
            seconds: c.timestamp || 0
          })) : [],
          generatedAt: new Date().toISOString()
        }, null, 2);
      } else if (data.type === "course") {
        // Format for YouTube Playlist
        const playlistDurationSecs = typeof LearningSchema !== "undefined" ? LearningSchema.parseDurationToSeconds(data.duration) : 0;
        const lectures = data.sections?.[0]?.lectures || [];
        const topics = typeof LearningSchema !== "undefined" ? LearningSchema.extractLearningFocusAndUpcoming(data) : { focus: [], upcoming: [] };
        
        let currentVideoProgress = null;
        if (data.currentLecture && data.currentLecture.progress) {
          currentVideoProgress = {
            currentTimeSeconds: data.currentLecture.progress.currentTimeSeconds !== null ? data.currentLecture.progress.currentTimeSeconds : null,
            remainingTimeSeconds: data.currentLecture.progress.remainingTimeSeconds !== null ? data.currentLecture.progress.remainingTimeSeconds : null,
            percentage: data.currentLecture.progress.percentComplete !== undefined ? data.currentLecture.progress.percentComplete : 0
          };
        }

        return JSON.stringify({
          platform: "youtube",
          type: "playlist",
          playlist: {
            title: data.title || "",
            creator: data.instructor || "",
            url: data.url || "",
            description: data.description || "",
            durationSeconds: playlistDurationSecs,
            durationFormatted: data.duration || "",
            videoCount: data.lecturesCount || 0
          },
          progress: {
            completedVideos: data.progress?.completedLecturesCount || 0,
            remainingVideos: data.progress?.remainingLecturesCount || 0,
            percentage: data.progress?.percentComplete !== undefined ? data.progress.percentComplete : 0
          },
          learningFocus: {
            currentFocus: topics.focus,
            upcomingTopics: topics.upcoming
          },
          currentVideo: {
            title: data.currentLecture?.title || "",
            url: data.currentLecture?.url || "",
            index: data.currentLecture?.id || 0,
            description: data.currentLecture?.description || "",
            progress: currentVideoProgress
          },
          videos: lectures.map(v => {
            const vDurationSecs = typeof LearningSchema !== "undefined" ? LearningSchema.parseDurationToSeconds(v.duration) : 0;
            return {
              title: v.title || "",
              url: v.url || "",
              durationSeconds: vDurationSecs,
              durationFormatted: v.duration || "",
              completed: !!v.completed
            };
          }),
          generatedAt: new Date().toISOString()
        }, null, 2);
      }
    }
    
    // Fallback for Udemy or other formats
    return JSON.stringify(data, null, 2);
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = JsonGenerator;
}
