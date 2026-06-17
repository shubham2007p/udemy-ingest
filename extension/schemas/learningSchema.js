/**
 * Learning Schema Definition & Normalization
 * Standardizes learning course/playlist/video metadata and progress tracking.
 */
const LearningSchema = {
  /**
   * Normalizes raw extracted data into the unified schema.
   */
  normalize(raw) {
    const durationSecs = LearningSchema.parseDurationToSeconds(raw.duration);
    const currentProgress = raw.progress ? LearningSchema.normalizeProgress(raw.progress, durationSecs) : LearningSchema.defaultProgress();
    
    // Extract videoId if platform is youtube
    let videoId = raw.videoId || "";
    if (!videoId && raw.platform === "youtube" && raw.url) {
      try {
        let cleanUrl = raw.url;
        if (cleanUrl.startsWith("/")) {
          cleanUrl = "https://www.youtube.com" + cleanUrl;
        }
        const u = new URL(cleanUrl);
        if (u.hostname.includes("youtube.com")) {
          videoId = u.searchParams.get("v") || "";
        } else if (u.hostname.includes("youtu.be")) {
          videoId = u.pathname.substring(1) || "";
        }
      } catch (e) {}
      if (!videoId) {
        const match = raw.url.match(/(?:v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (match) {
          videoId = match[1];
        }
      }
    }

    // Defensive Validation Checks
    if (currentProgress.currentTimeSeconds !== null && durationSecs > 0 && currentProgress.currentTimeSeconds > durationSecs) {
      console.warn(`[AIIngest] Validation Warning: currentTimeSeconds (${currentProgress.currentTimeSeconds}) exceeds duration (${durationSecs}). Capping current position.`);
      currentProgress.currentTimeSeconds = durationSecs;
      currentProgress.percentComplete = 100;
      currentProgress.remainingTimeSeconds = 0;
    }
    
    const lecturesCount = typeof raw.lecturesCount === "number" ? Math.max(0, raw.lecturesCount) : 0;
    
    if (raw.type === "course" && raw.currentLecture) {
      const lectures = Array.isArray(raw.sections) ? raw.sections.flatMap(s => s.lectures || []) : [];
      const exists = lectures.some(lec => lec.title === raw.currentLecture.title || lec.url === raw.currentLecture.url);
      if (!exists && lectures.length > 0) {
        console.warn(`[AIIngest] Validation Warning: Current video "${raw.currentLecture.title}" not found in playlist structure.`);
      }
    }

    return {
      platform: raw.platform || "udemy", // "udemy" | "youtube"
      type: raw.type || "course",         // "course" | "video"
      title: raw.title || "Unknown Title",
      instructor: raw.instructor || "Unknown Instructor", // Instructor (Udemy) or Creator (YouTube)
      description: raw.description || "",
      duration: LearningSchema.normalizeDuration(raw.duration),
      url: raw.url || "",
      videoId: videoId,
      publishDate: raw.publishDate || "", // Optional, YouTube single video publish date
      sectionsCount: typeof raw.sectionsCount === "number" ? raw.sectionsCount : 0,
      lecturesCount: lecturesCount,
      learningObjectives: Array.isArray(raw.learningObjectives) ? raw.learningObjectives : [],
      prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites : [],
      sections: Array.isArray(raw.sections) ? raw.sections.map(LearningSchema.normalizeSection) : [],
      progress: currentProgress,
      currentLecture: raw.currentLecture ? LearningSchema.normalizeLectureRef(raw.currentLecture) : null,
      lastCompletedLecture: raw.lastCompletedLecture ? LearningSchema.normalizeLectureRef(raw.lastCompletedLecture) : null,
      nextLecture: raw.nextLecture ? LearningSchema.normalizeLectureRef(raw.nextLecture) : null,
      chapters: Array.isArray(raw.chapters) ? raw.chapters.map(c => ({
        title: LearningSchema.cleanChapterTitle(c.title),
        timestamp: typeof c.timestamp === "number" ? c.timestamp : 0, // start time in seconds
        timeStr: c.timeStr || "" // readable timestamp e.g. "05:32"
      })) : []
    };
  },

  normalizeSection(sec) {
    return {
      name: sec.name || "Unknown Section",
      completed: !!sec.completed,
      completedCount: typeof sec.completedCount === "number" ? sec.completedCount : 0,
      totalCount: typeof sec.totalCount === "number" ? sec.totalCount : 0,
      lectures: Array.isArray(sec.lectures) ? sec.lectures.map(lec => ({
        id: lec.id !== undefined ? lec.id : null,
        title: lec.title || "Unknown Item",
        duration: LearningSchema.normalizeDuration(lec.duration),
        type: lec.type || "lecture", // "lecture", "video", "quiz", etc.
        completed: !!lec.completed,
        isCurrent: !!lec.isCurrent,
        url: lec.url || ""
      })) : []
    };
  },

  normalizeProgress(p, durationSecs = 0) {
    if (!p) return this.defaultProgress();

    let currentTime = p.currentTimeSeconds;
    let remainingTime = p.remainingTimeSeconds;
    
    // Check for missing/invalid current time
    if (currentTime === undefined || currentTime === null || isNaN(currentTime)) {
      currentTime = null;
    } else {
      currentTime = Math.round(currentTime);
    }
    
    let percentComplete = null;

    if (currentTime !== null && durationSecs > 0) {
      if (currentTime < 0 || currentTime > durationSecs) {
        // Out of bounds progress
        percentComplete = "Unknown";
        currentTime = null;
        remainingTime = null;
      } else {
        percentComplete = Math.round((currentTime / durationSecs) * 100);
        percentComplete = Math.max(0, Math.min(percentComplete, 100));
      }
    } else if (typeof p.percentComplete === "number" && !isNaN(p.percentComplete)) {
      if (p.percentComplete < 0 || p.percentComplete > 100) {
        percentComplete = "Unknown";
      } else {
        percentComplete = Math.round(p.percentComplete);
      }
    } else if (p.percentComplete === "Unknown") {
      percentComplete = "Unknown";
    }

    if (percentComplete === null || percentComplete === "Unknown") {
      return {
        completedLecturesCount: Math.max(0, p.completedLecturesCount || 0),
        remainingLecturesCount: Math.max(0, p.remainingLecturesCount || 0),
        totalLecturesCount: Math.max(0, p.totalLecturesCount || 0),
        completedSectionsCount: Math.max(0, p.completedSectionsCount || 0),
        remainingSectionsCount: Math.max(0, p.remainingSectionsCount || 0),
        totalSectionsCount: Math.max(0, p.totalSectionsCount || 0),
        percentComplete: "Unknown",
        currentTimeSeconds: null,
        remainingTimeSeconds: null
      };
    }

    // If remaining time is missing, calculate it
    if ((remainingTime === undefined || remainingTime === null || isNaN(remainingTime)) && durationSecs > 0 && currentTime !== null) {
      remainingTime = Math.max(0, durationSecs - currentTime);
    } else if (remainingTime !== null && remainingTime !== undefined) {
      remainingTime = Math.max(0, Math.round(remainingTime));
    }

    return {
      completedLecturesCount: Math.max(0, p.completedLecturesCount || 0),
      remainingLecturesCount: Math.max(0, p.remainingLecturesCount || 0),
      totalLecturesCount: Math.max(0, p.totalLecturesCount || 0),
      completedSectionsCount: Math.max(0, p.completedSectionsCount || 0),
      remainingSectionsCount: Math.max(0, p.remainingSectionsCount || 0),
      totalSectionsCount: Math.max(0, p.totalSectionsCount || 0),
      percentComplete: percentComplete,
      currentTimeSeconds: currentTime,
      remainingTimeSeconds: remainingTime
    };
  },

  defaultProgress() {
    return {
      completedLecturesCount: 0,
      remainingLecturesCount: 0,
      totalLecturesCount: 0,
      completedSectionsCount: 0,
      remainingSectionsCount: 0,
      totalSectionsCount: 0,
      percentComplete: 0,
      currentTimeSeconds: 0,
      remainingTimeSeconds: 0
    };
  },

  normalizeLectureRef(ref) {
    return {
      id: ref.id !== undefined ? ref.id : null,
      title: ref.title || "",
      sectionName: ref.sectionName || "",
      sectionIndex: typeof ref.sectionIndex === "number" ? ref.sectionIndex : 0,
      url: ref.url || "",
      description: ref.description || "",
      progress: ref.progress ? LearningSchema.normalizeProgress(ref.progress, ref.progress.durationSeconds || 0) : null
    };
  },

  /**
   * Helper: Normalizes a raw duration string to standard/extended string format.
   */
  normalizeDuration(durationStr) {
    if (!durationStr || durationStr === "Unknown Duration") {
      return "Unknown Duration";
    }
    const hasPlus = durationStr.toString().endsWith("+");
    const cleanStr = hasPlus ? durationStr.slice(0, -1) : durationStr;
    const seconds = this.parseDurationToSeconds(cleanStr);
    if (seconds > 0) {
      const formatted = this.formatDuration(seconds);
      return hasPlus ? formatted + "+" : formatted;
    }
    return durationStr; // fallback to original if parsing failed
  },

  /**
   * Helper: Parses various duration strings to total seconds.
   * Supports: SS, MM:SS, HH:MM:SS, DD:HH:MM:SS, and verbal strings.
   */
  parseDurationToSeconds(str) {
    if (!str) return 0;
    if (typeof str === "number") return str;
    
    const s = str.toString().trim().toLowerCase();
    
    // Check if it's in colon format like DD:HH:MM:SS or HH:MM:SS or MM:SS
    if (/^-?\d+(?::\d+)+$/.test(s)) {
      const parts = s.split(":").map(Number);
      if (parts.some(isNaN)) return 0;
      
      const revParts = parts.reverse();
      let seconds = 0;
      if (revParts.length >= 1) seconds += revParts[0];
      if (revParts.length >= 2) seconds += revParts[1] * 60;
      if (revParts.length >= 3) seconds += revParts[2] * 3600;
      if (revParts.length >= 4) seconds += revParts[3] * 86400;
      return Math.abs(seconds);
    }
    
    let seconds = 0;
    
    // Regular expression matches for days, hours, minutes, seconds
    const daysMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:d|day)/);
    const hoursMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hour|hr)/);
    const minsMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minute)/);
    const secsMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|second)/);
    
    if (daysMatch) seconds += parseFloat(daysMatch[1]) * 86400;
    if (hoursMatch) seconds += parseFloat(hoursMatch[1]) * 3600;
    if (minsMatch) seconds += parseFloat(minsMatch[1]) * 60;
    if (secsMatch) seconds += parseFloat(secsMatch[1]);
    
    // Fallback: if no matches but is a numeric value
    if (seconds === 0 && /^\d+(?:\.\d+)?$/.test(s)) {
      seconds = parseFloat(s);
    }
    
    return Math.abs(seconds);
  },

  /**
   * Helper: Formats total seconds into standard/extended string format.
   * Format Rules:
   * - < 24h: e.g. "18h 22m" or "5h 12m" or "45m"
   * - >= 24h: e.g. "1d 3h 12m" or "2d 14h 4m" or "5d 8h"
   */
  formatDuration(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) {
      return "Unknown Duration";
    }
    
    const totalMinutes = Math.round(totalSeconds / 60);
    if (totalMinutes < 1) {
      const secs = Math.round(totalSeconds);
      return secs > 0 ? `${secs}s` : "Unknown Duration";
    }
    
    const totalHours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      
      let res = `${days}d`;
      if (hours > 0) res += ` ${hours}h`;
      if (mins > 0) res += ` ${mins}m`;
      return res;
    } else if (totalHours > 0) {
      let res = `${totalHours}h`;
      if (mins > 0) res += ` ${mins}m`;
      return res;
    }
    
    return `${mins}m`;
  },

  /**
   * Helper: Cleans up chapter titles by removing emojis, symbols, empty parentheses, and leading/trailing punctuation.
   */
  cleanChapterTitle(title) {
    if (!title) return "";
    let t = title.trim();
    // Remove emojis, symbols and formatting characters at the start (ignoring letters, numbers, punctuation, spaces)
    try {
      t = t.replace(/^[^\p{L}\p{N}\p{P}\s]+/gu, "");
    } catch (e) {
      t = t.replace(/^[^\w\s\d\p{P}]+/gu, "");
    }
    // Remove empty parentheses
    t = t.replace(/\(\s*\)/g, "");
    // Remove leading/trailing colons, dashes, pipes, and whitespace
    t = t.replace(/^[-–—:|#\s]+/, "").replace(/[-–—:|#\s]+$/, "");
    return t.trim();
  },

  /**
   * Helper: Infers learning topics/concepts from a title using non-LLM heuristics.
   */
  inferTopicsFromTitle(title) {
    if (!title) return [];
    
    const parts = title.split(/[-–—|:/,]/);
    const topics = [];
    
    parts.forEach(part => {
      let t = part.trim();
      
      // Filter out prefixes like "DAY 5", "Lecture 3", "Section 2", etc.
      t = t.replace(/^(?:day|lecture|lec|video|sec|section|part|ch|chapter)\s*\d+\s*(?:of\s*\d+)?\b/i, "");
      
      // Clean up punctuation and whitespace (keeping parentheses and brackets)
      t = t.replace(/^[^a-zA-Z0-9([{]+/, "").replace(/[^a-zA-Z0-9)\]}]+$/, "").trim();
      
      if (t.length > 2 && !/^(and|the|for|with|from|into|onto|than|then|versus|vs)$/i.test(t)) {
        if (isNaN(Number(t))) {
          // Capitalize formatted title
          const formatted = t.split(/\s+/).map(word => {
            if (/^(and|or|of|in|on|at|to|a|an|the|for|with|vs)$/i.test(word)) return word.toLowerCase();
            return word.charAt(0).toUpperCase() + word.slice(1);
          }).join(" ");
          
          if (formatted && !topics.includes(formatted)) {
            topics.push(formatted);
          }
        }
      }
    });

    if (topics.length === 0) {
      let cleanTitle = title.replace(/^(?:day|lecture|lec|video|sec|section|part|ch|chapter)\s*\d+\s*(?:of\s*\d+)?\b/i, "").trim();
      cleanTitle = cleanTitle.replace(/^[^a-zA-Z0-9([{]+/, "").replace(/[^a-zA-Z0-9)\]}]+$/, "").trim();
      if (cleanTitle.length > 2) {
        topics.push(cleanTitle);
      }
    }
    
    return topics;
  },

  /**
   * Helper: Extracts current focus and upcoming forecasts from chapters or playlist items.
   */
  extractLearningFocusAndUpcoming(data) {
    let focus = [];
    let upcoming = [];
    
    if (data.platform === "youtube") {
      if (data.type === "video") {
        const currentTime = data.progress?.currentTimeSeconds || 0;
        let activeChapter = null;
        let activeChapterIdx = -1;
        
        if (Array.isArray(data.chapters) && data.chapters.length > 0) {
          for (let i = 0; i < data.chapters.length; i++) {
            const ch = data.chapters[i];
            const nextCh = data.chapters[i + 1];
            if (currentTime >= ch.timestamp && (!nextCh || currentTime < nextCh.timestamp)) {
              activeChapter = ch;
              activeChapterIdx = i;
              break;
            }
          }
          
          if (activeChapter) {
            focus = this.inferTopicsFromTitle(activeChapter.title);
            const nextChapters = data.chapters.slice(activeChapterIdx + 1, activeChapterIdx + 4);
            nextChapters.forEach(ch => {
              upcoming = upcoming.concat(this.inferTopicsFromTitle(ch.title));
            });
          }
        }
        
        if (focus.length === 0) {
          focus = this.inferTopicsFromTitle(data.title);
        }
      } else if (data.type === "course") {
        if (data.currentLecture) {
          focus = this.inferTopicsFromTitle(data.currentLecture.title);
          
          const lectures = data.sections?.[0]?.lectures || [];
          const currentIdx = lectures.findIndex(lec => lec.videoId === data.currentLecture.videoId || lec.id === data.currentLecture.id);
          if (currentIdx !== -1) {
            const nextLectures = lectures.slice(currentIdx + 1, currentIdx + 4);
            nextLectures.forEach(lec => {
              upcoming = upcoming.concat(this.inferTopicsFromTitle(lec.title));
            });
          } else {
            const incomplete = lectures.filter(lec => !lec.completed).slice(0, 3);
            incomplete.forEach(lec => {
              upcoming = upcoming.concat(this.inferTopicsFromTitle(lec.title));
            });
          }
        } else {
          focus = this.inferTopicsFromTitle(data.title);
          const lectures = data.sections?.[0]?.lectures || [];
          lectures.slice(0, 3).forEach(lec => {
            upcoming = upcoming.concat(this.inferTopicsFromTitle(lec.title));
          });
        }
      }
    } else {
      // Udemy Fallback
      if (data.currentLecture) {
        focus = this.inferTopicsFromTitle(data.currentLecture.title);
        const lectures = data.sections?.flatMap(s => s.lectures || []) || [];
        const currentIdx = lectures.findIndex(lec => lec.id === data.currentLecture.id);
        if (currentIdx !== -1) {
          const nextLectures = lectures.slice(currentIdx + 1, currentIdx + 4);
          nextLectures.forEach(lec => {
            upcoming = upcoming.concat(this.inferTopicsFromTitle(lec.title));
          });
        }
      } else {
        focus = this.inferTopicsFromTitle(data.title);
      }
    }
    
    upcoming = upcoming.filter(topic => !focus.includes(topic));
    const uniqueUpcoming = [...new Set(upcoming)];
    
    return {
      focus: [...new Set(focus)],
      upcoming: uniqueUpcoming.slice(0, 5)
    };
  }
};

// Export for ES6 module environments or keep as global in standard web extensions
if (typeof module !== "undefined" && module.exports) {
  module.exports = LearningSchema;
}
