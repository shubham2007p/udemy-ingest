/**
 * YouTube Extractor Coordinator (API-First Migration)
 * Serves as the entry point for content.js and popup.js. Coordinates 
 * PageStateExtractor, YouTubeVideoService, and YouTubePlaylistService.
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

  getPlaylistIdFromUrl(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.searchParams.get("list");
    } catch (e) {}
    return null;
  },

  async extract() {
    const isPlaylist = this.isPlaylistPage();
    const isWatchPlaylist = this.isWatchPageWithPlaylist();
    const isWatchSingle = this.isWatchPageWithoutPlaylist();
    
    const currentUrl = window.location.href;
    
    // Check components are loaded
    if (typeof YouTubePlaylistService === "undefined" || 
        typeof YouTubeVideoService === "undefined" || 
        typeof PageStateExtractor === "undefined") {
      throw new Error("Required extractor dependencies are not loaded");
    }

    if (isPlaylist) {
      const playlistId = this.getPlaylistIdFromUrl(currentUrl);
      if (!playlistId) throw new Error("Invalid YouTube Playlist URL");
      
      // 1. Fetch Playlist details from API
      const course = await YouTubePlaylistService.fetchPlaylistDetails(playlistId);
      
      // 2. Fetch DOM progress
      const localProgress = PageStateExtractor.extractPlaylistDOMProgress();
      
      // Merge progress into playlist items
      let completedCount = 0;
      course.sections[0].lectures.forEach(lecture => {
        const progress = localProgress[lecture.videoId];
        if (progress) {
          lecture.completed = progress.completed;
        }
        if (lecture.completed) {
          completedCount++;
        }
      });
      
      course.sections[0].completedCount = completedCount;
      course.sections[0].completed = (completedCount === course.sections[0].totalCount);
      
      // Build progress struct
      course.progress = {
        completedLecturesCount: completedCount,
        remainingLecturesCount: course.lecturesCount - completedCount,
        totalLecturesCount: course.lecturesCount,
        completedSectionsCount: course.sections[0].completed ? 1 : 0,
        remainingSectionsCount: course.sections[0].completed ? 0 : 1,
        totalSectionsCount: 1,
        percentComplete: course.lecturesCount > 0 ? Math.round((completedCount / course.lecturesCount) * 100) : 0,
        currentTimeSeconds: 0,
        remainingTimeSeconds: 0
      };

      return course;
    }
    
    else if (isWatchPlaylist || isWatchSingle) {
      const videoId = this.getVideoIdFromUrl(currentUrl);
      if (!videoId) throw new Error("Invalid YouTube Video URL");

      // 1. Fetch video details from API
      const videoDetails = await YouTubeVideoService.fetchVideoDetails(videoId);

      // 2. Scrape playback state from active player
      const localProgress = PageStateExtractor.extractCurrentWatchProgress();

      // 3. Build single video object
      const videoObj = {
        platform: "youtube",
        type: "video",
        title: videoDetails.title,
        instructor: videoDetails.instructor,
        description: videoDetails.description,
        duration: videoDetails.duration,
        url: currentUrl,
        publishDate: videoDetails.publishDate,
        sectionsCount: 1,
        lecturesCount: videoDetails.chapters.length || 1,
        sections: [
          {
            name: "Chapters",
            completed: localProgress.percentComplete >= 100,
            completedCount: 0,
            totalCount: videoDetails.chapters.length || 1,
            lectures: []
          }
        ],
        progress: {
          percentComplete: localProgress.percentComplete,
          currentTimeSeconds: localProgress.currentTimeSeconds,
          remainingTimeSeconds: localProgress.remainingTimeSeconds
        },
        chapters: videoDetails.chapters
      };

      // Populate chapters as lectures if they exist
      if (videoDetails.chapters.length > 0) {
        let currentLectureIndex = -1;
        let completedCount = 0;
        
        // Find active chapter based on current time
        for (let i = 0; i < videoDetails.chapters.length; i++) {
          const chapter = videoDetails.chapters[i];
          const nextChapter = videoDetails.chapters[i + 1];
          const isPastStart = localProgress.currentTimeSeconds >= chapter.timestamp;
          const isBeforeNext = nextChapter ? localProgress.currentTimeSeconds < nextChapter.timestamp : true;
          
          if (isPastStart && isBeforeNext) {
            currentLectureIndex = i;
            break;
          }
        }
        
        videoObj.sections[0].lectures = videoDetails.chapters.map((ch, idx) => {
          const isCurrent = (idx === currentLectureIndex);
          const completed = localProgress.currentTimeSeconds >= ch.timestamp && !isCurrent;
          if (completed) completedCount++;
          
          let chDuration = "0:00";
          if (idx < videoDetails.chapters.length - 1) {
            const seconds = videoDetails.chapters[idx + 1].timestamp - ch.timestamp;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            chDuration = `${mins}:${secs.toString().padStart(2, '0')}`;
          } else if (videoDetails.durationSeconds > 0) {
            const seconds = videoDetails.durationSeconds - ch.timestamp;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            chDuration = `${mins}:${secs.toString().padStart(2, '0')}`;
          }

          return {
            id: idx + 1,
            title: ch.title,
            duration: chDuration,
            type: "video_chapter",
            completed: completed,
            isCurrent: isCurrent,
            url: `https://www.youtube.com/watch?v=${videoId}&t=${ch.timestamp}s`
          };
        });

        videoObj.sections[0].completedCount = completedCount;
        videoObj.sections[0].completed = (completedCount === videoDetails.chapters.length);
        
        if (currentLectureIndex !== -1) {
          const currentCh = videoDetails.chapters[currentLectureIndex];
          videoObj.currentLecture = {
            id: currentLectureIndex + 1,
            title: currentCh.title,
            sectionName: "Chapters",
            sectionIndex: 0,
            url: `https://www.youtube.com/watch?v=${videoId}&t=${currentCh.timestamp}s`
          };
        }
      } else {
        // Fallback for video with no chapters
        videoObj.sections[0].lectures = [
          {
            id: 1,
            title: videoDetails.title,
            duration: videoDetails.duration,
            type: "video",
            completed: localProgress.percentComplete >= 85,
            isCurrent: true,
            url: currentUrl
          }
        ];
        videoObj.sections[0].completedCount = localProgress.percentComplete >= 85 ? 1 : 0;
        videoObj.sections[0].completed = localProgress.percentComplete >= 85;
        videoObj.currentLecture = {
          id: 1,
          title: videoDetails.title,
          sectionName: "Chapters",
          sectionIndex: 0,
          url: currentUrl
        };
      }

      // If it's a playlist watch page, extract parent playlist context
      if (isWatchPlaylist) {
        const playlistId = this.getPlaylistIdFromUrl(currentUrl);
        if (playlistId) {
          try {
            const playlistDetails = await YouTubePlaylistService.fetchPlaylistDetails(playlistId);
            const localPlaylistProgress = PageStateExtractor.extractPlaylistDOMProgress();
            
            let playlistCompletedCount = 0;
            playlistDetails.sections[0].lectures.forEach(lecture => {
              if (lecture.videoId === videoId) {
                lecture.completed = localProgress.percentComplete >= 85;
                lecture.isCurrent = true;
              } else {
                const progress = localPlaylistProgress[lecture.videoId];
                if (progress) {
                  lecture.completed = progress.completed;
                }
              }
              if (lecture.completed) {
                playlistCompletedCount++;
              }
            });

            playlistDetails.sections[0].completedCount = playlistCompletedCount;
            playlistDetails.sections[0].completed = (playlistCompletedCount === playlistDetails.sections[0].totalCount);

            playlistDetails.progress = {
              completedLecturesCount: playlistCompletedCount,
              remainingLecturesCount: playlistDetails.lecturesCount - playlistCompletedCount,
              totalLecturesCount: playlistDetails.lecturesCount,
              completedSectionsCount: playlistDetails.sections[0].completed ? 1 : 0,
              remainingSectionsCount: playlistDetails.sections[0].completed ? 0 : 1,
              totalSectionsCount: 1,
              percentComplete: playlistDetails.lecturesCount > 0 ? Math.round((playlistCompletedCount / playlistDetails.lecturesCount) * 100) : 0,
              currentTimeSeconds: 0,
              remainingTimeSeconds: 0
            };

            playlistDetails.currentLecture = {
              id: playlistDetails.sections[0].lectures.find(l => l.videoId === videoId)?.id || 1,
              title: videoDetails.title,
              sectionName: "Playlist Videos",
              sectionIndex: 0,
              url: currentUrl,
              description: videoDetails.description || "",
              progress: {
                percentComplete: localProgress.percentComplete,
                currentTimeSeconds: localProgress.currentTimeSeconds,
                remainingTimeSeconds: localProgress.remainingTimeSeconds,
                durationSeconds: videoDetails.durationSeconds || 0
              }
            };
            
            playlistDetails.chapters = videoDetails.chapters;

            return playlistDetails;
          } catch (playlistErr) {
            console.warn("[AIIngest] Playlist metadata API fetch failed, falling back to video metadata.", playlistErr);
          }
        }
      }

      return videoObj;
    }

    throw new Error("Not on a supported YouTube Page");
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = YouTubeExtractor;
}
