/**
 * Learning Schema Definition & Normalization
 * Standardizes learning course/playlist metadata and progress tracking.
 */
const LearningSchema = {
  /**
   * Normalizes raw extracted data into the unified schema.
   */
  normalize(raw) {
    return {
      platform: raw.platform || "udemy", // "udemy" | "youtube"
      title: raw.title || "Unknown Title",
      instructor: raw.instructor || "Unknown Instructor", // Instructor (Udemy) or Creator (YouTube)
      description: raw.description || "",
      duration: raw.duration || "Unknown Duration",
      sectionsCount: typeof raw.sectionsCount === "number" ? raw.sectionsCount : 0,
      lecturesCount: typeof raw.lecturesCount === "number" ? raw.lecturesCount : 0, // Total lectures or videos
      learningObjectives: Array.isArray(raw.learningObjectives) ? raw.learningObjectives : [],
      prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites : [],
      sections: Array.isArray(raw.sections) ? raw.sections.map(this.normalizeSection) : [],
      progress: raw.progress ? this.normalizeProgress(raw.progress) : this.defaultProgress(),
      currentLecture: raw.currentLecture ? this.normalizeLectureRef(raw.currentLecture) : null,
      lastCompletedLecture: raw.lastCompletedLecture ? this.normalizeLectureRef(raw.lastCompletedLecture) : null,
      nextLecture: raw.nextLecture ? this.normalizeLectureRef(raw.nextLecture) : null
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
        duration: lec.duration || "",
        type: lec.type || "lecture", // "lecture", "video", "quiz", etc.
        completed: !!lec.completed,
        isCurrent: !!lec.isCurrent,
        url: lec.url || "" // Optional URL (used for YouTube videos)
      })) : []
    };
  },

  normalizeProgress(p) {
    return {
      completedLecturesCount: p.completedLecturesCount || 0,
      remainingLecturesCount: p.remainingLecturesCount || 0,
      totalLecturesCount: p.totalLecturesCount || 0,
      completedSectionsCount: p.completedSectionsCount || 0,
      remainingSectionsCount: p.remainingSectionsCount || 0,
      totalSectionsCount: p.totalSectionsCount || 0,
      percentComplete: p.percentComplete || 0
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
      percentComplete: 0
    };
  },

  normalizeLectureRef(ref) {
    return {
      id: ref.id !== undefined ? ref.id : null,
      title: ref.title || "",
      sectionName: ref.sectionName || "",
      sectionIndex: typeof ref.sectionIndex === "number" ? ref.sectionIndex : 0,
      url: ref.url || "" // Optional
    };
  }
};

// Export for ES6 module environments or keep as global in standard web extensions
if (typeof module !== "undefined" && module.exports) {
  module.exports = LearningSchema;
}
