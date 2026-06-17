/**
 * AI Context Generator
 * Generates prompt-optimized LLM context detailing the user's progress and active learning state.
 */
const AiContextGenerator = {
  formatSecondsToTimeStr(seconds) {
    if (isNaN(seconds) || seconds <= 0) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  generate(data) {
    if (!data) return "";
    
    const isYouTube = data.platform === "youtube";
    const isVideo = data.type === "video";
    
    // Standalone YouTube Video Layout
    if (isYouTube && isVideo) {
      const currentTimestamp = this.formatSecondsToTimeStr(data.progress?.currentTimeSeconds);
      const remainingTime = this.formatSecondsToTimeStr(data.progress?.remainingTimeSeconds);
      
      let ai = `Use this information as the learner's current learning context.\n\n`;
      ai += `# Learning Context: YouTube Video\n\n`;
      ai += `Video:\n${data.title}\n\n`;
      ai += `Creator:\n${data.instructor}\n\n`;
      ai += `Duration:\n${data.duration}\n\n`;
      ai += `Progress:\n${data.progress?.percentComplete || 0}%\n\n`;
      ai += `Current Position:\n${currentTimestamp}\n\n`;
      ai += `Remaining Time:\n${remainingTime}\n\n`;
      ai += `---\n\n`;
      ai += `# Video Description\n\n${data.description || ""}\n\n`;
      ai += `---\n\n`;
      ai += `# Chapters Covered\n\n`;
      
      const completedChapters = Array.isArray(data.chapters) ? data.chapters.filter(ch => (data.progress?.currentTimeSeconds || 0) >= ch.timestamp) : [];
      if (completedChapters.length > 0) {
        completedChapters.forEach(ch => {
          ai += `* ${ch.title}\n`;
        });
      } else {
        ai += `* None\n`;
      }
      ai += `\n`;
      
      ai += `---\n\n`;
      ai += `# Current Learning State\n\n`;
      ai += `The learner is currently watching this video and is approximately at:\n\n${currentTimestamp}\n\n`;
      ai += `The learner has completed approximately:\n\n${data.progress?.percentComplete || 0}%\n\nof the video.\n\n`;
      ai += `---\n\n`;
      ai += `# Instructions For AI Assistant\n\n`;
      ai += `* Use this video as the learner's current learning resource.\n`;
      ai += `* Consider the video's chapters and description when answering.\n`;
      ai += `* Avoid assuming topics not present in the video.\n`;
      ai += `* Continue explanations relative to the learner's current position.\n`;
      ai += `* Reference upcoming chapters when relevant.\n`;
      
      return ai.trim();
    }
    
    // YouTube Playlist Layout
    if (isYouTube && !isVideo) {
      let ai = `Use this information as the learner's current learning context.\n\n`;
      ai += `# Learning Context: YouTube Playlist\n\n`;
      ai += `Playlist:\n${data.title}\n\n`;
      ai += `Creator:\n${data.instructor}\n\n`;
      ai += `Playlist Duration:\n${data.duration}\n\n`;
      ai += `Total Videos:\n${data.lecturesCount}\n\n`;
      ai += `Progress:\n${data.progress?.completedLecturesCount || 0}/${data.lecturesCount}\n\n`;
      ai += `Current Video:\n${data.currentLecture?.title || "None"}\n\n`;
      ai += `Current Position:\nVideo ${data.currentLecture ? data.currentLecture.id : 0} of ${data.lecturesCount}\n\n`;
      ai += `---\n\n`;
      ai += `# Playlist Description\n\n${data.description || ""}\n\n`;
      ai += `---\n\n`;
      ai += `# Current Video Description\n\n${data.currentLecture?.description || "No description available"}\n\n`;
      ai += `This description should always be included whenever available because it provides the strongest signal about what the learner is actively studying.\n\n`;
      ai += `---\n\n`;
      ai += `# Learning Progress\n\n`;
      ai += `Completed Videos:\n${data.progress?.completedLecturesCount || 0}\n\n`;
      ai += `Remaining Videos:\n${data.progress?.remainingLecturesCount || 0}\n\n`;
      ai += `Completion Percentage:\n${data.progress?.percentComplete || 0}%\n\n`;
      ai += `---\n\n`;
      ai += `# Upcoming Videos\n\n`;
      
      const currentId = data.currentLecture ? data.currentLecture.id : 0;
      const upcoming = (data.sections?.[0]?.lectures || []).filter(v => v.id > currentId);
      if (upcoming.length > 0) {
        upcoming.forEach(v => {
          ai += `* ${v.title}\n`;
        });
      } else {
        ai += `* None\n`;
      }
      ai += `\n`;
      
      ai += `---\n\n`;
      ai += `# Instructions For AI Assistant\n\n`;
      ai += `* Treat this playlist as the learner's active learning path.\n`;
      ai += `* Use both the playlist structure and current video description for context.\n`;
      ai += `* Assume completed videos have already been consumed.\n`;
      ai += `* Prioritize helping with the current video.\n`;
      ai += `* Reference upcoming videos when suggesting next steps.\n`;
      ai += `* Keep responses aligned with the playlist progression.\n`;
      
      return ai.trim();
    }
    
    // Standard Udemy Course Layout
    let ai = `Use this information as the learner's current course progress and learning context.\n\n`;
    ai += `# Learning Context: Udemy Course Progress\n`;
    ai += `* **Course:** ${data.title}\n`;
    if (data.instructor) ai += `* **Instructor:** ${data.instructor}\n`;
    if (data.duration) ai += `* **Duration:** ${data.duration}\n`;
    
    if (data.progress) {
      const p = data.progress;
      ai += `* **Progress:** ${p.percentComplete}% complete (${p.completedLecturesCount}/${p.totalLecturesCount} lectures, ${p.completedSectionsCount}/${p.totalSectionsCount} sections)\n`;
    }
    ai += '\n';
    
    ai += `## Learning Position\n`;
    if (data.currentLecture) {
      const cur = data.currentLecture;
      ai += `* **Current Lecture:** "${cur.title}" (Section ${cur.sectionIndex + 1}: ${cur.sectionName})\n`;
    }
    if (data.lastCompletedLecture) {
      const last = data.lastCompletedLecture;
      ai += `* **Last Completed Lecture:** "${last.title}" (Section ${last.sectionIndex + 1}: ${last.sectionName})\n`;
    }
    if (data.nextLecture) {
      const next = data.nextLecture;
      ai += `* **Next Lecture:** "${next.title}" (Section ${next.sectionIndex + 1}: ${next.sectionName})\n`;
    }
    ai += '\n';
    
    ai += `## Completed Sections\n`;
    const completedSections = data.sections.filter(s => s.completed);
    const partialSections = data.sections.filter(s => !s.completed && s.completedCount > 0);
    
    if (completedSections.length === 0 && partialSections.length === 0) {
      ai += `* No sections completed yet.\n`;
    } else {
      completedSections.forEach((sec) => {
        const secNum = data.sections.indexOf(sec) + 1;
        ai += `* Section ${secNum}: ${sec.name} — ✅ All ${sec.totalCount} lectures completed\n`;
      });
      partialSections.forEach(sec => {
        const secNum = data.sections.indexOf(sec) + 1;
        ai += `* Section ${secNum}: ${sec.name} — ${sec.completedCount}/${sec.totalCount} lectures completed\n`;
      });
    }
    ai += `\n`;
    
    if (data.currentLecture) {
      const curSecIdx = data.currentLecture.sectionIndex;
      const curSec = data.sections[curSecIdx];
      if (curSec) {
        ai += `## Current Section Detail\n`;
        ai += `**Section ${curSecIdx + 1}: ${curSec.name}** (${curSec.completedCount}/${curSec.totalCount} completed)\n`;
        curSec.lectures.forEach(lec => {
          const check = lec.completed ? '[x]' : '[ ]';
          let marker = '';
          if (lec.isCurrent) marker = ' ← CURRENT';
          ai += `  - ${check} ${lec.title}${marker}\n`;
        });
        ai += `\n`;
      }
    }
    
    ai += `## Upcoming Sections\n`;
    const upcomingSections = data.sections.filter(s => !s.completed);
    const currentSecIdx = data.currentLecture ? data.currentLecture.sectionIndex : -1;
    const futureOnly = upcomingSections.filter((s) => data.sections.indexOf(s) > currentSecIdx);
    
    if (futureOnly.length === 0) {
      ai += `* All sections reached or completed!\n`;
    } else {
      futureOnly.forEach(sec => {
        const secNum = data.sections.indexOf(sec) + 1;
        ai += `* Section ${secNum}: ${sec.name} (${sec.totalCount} lectures)\n`;
      });
    }
    ai += `\n`;
    
    ai += `## Instructions for AI Assistant\n`;
    ai += `- Assume the learner has understood all completed topics listed above.\n`;
    ai += `- Do not re-explain or repeat completed material unless explicitly asked.\n`;
    ai += `- Prioritize the current topic in your responses.\n`;
    ai += `- When relevant, recommend or preview upcoming topics from the next sections/videos.\n`;
    ai += `- If the learner asks a question, frame your answer within the context of this playlist/course's curriculum.\n`;
    
    return ai.trim();
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = AiContextGenerator;
}
