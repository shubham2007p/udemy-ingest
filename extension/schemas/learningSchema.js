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
    const currentProgress = raw.progress ? LearningSchema.normalizeProgress(raw.progress) : LearningSchema.defaultProgress();
    
    // Defensive Validation Checks
    if (currentProgress.currentTimeSeconds > durationSecs && durationSecs > 0) {
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
        title: c.title || "",
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

  normalizeProgress(p) {
    const percent = typeof p.percentComplete === "number" ? p.percentComplete : 0;
    const clampedPercent = Math.max(0, Math.min(Math.round(percent), 100));
    return {
      completedLecturesCount: Math.max(0, p.completedLecturesCount || 0),
      remainingLecturesCount: Math.max(0, p.remainingLecturesCount || 0),
      totalLecturesCount: Math.max(0, p.totalLecturesCount || 0),
      completedSectionsCount: Math.max(0, p.completedSectionsCount || 0),
      remainingSectionsCount: Math.max(0, p.remainingSectionsCount || 0),
      totalSectionsCount: Math.max(0, p.totalSectionsCount || 0),
      percentComplete: clampedPercent,
      currentTimeSeconds: Math.max(0, Math.round(p.currentTimeSeconds || 0)),
      remainingTimeSeconds: Math.max(0, Math.round(p.remainingTimeSeconds || 0))
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
      description: ref.description || ""
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
      return seconds;
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
    
    return seconds;
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
  }
};

// Export for ES6 module environments or keep as global in standard web extensions
if (typeof module !== "undefined" && module.exports) {
  module.exports = LearningSchema;
}
