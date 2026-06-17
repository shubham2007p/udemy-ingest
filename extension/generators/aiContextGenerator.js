/**
 * AI Context Generator
 * Generates prompt-optimized LLM context detailing the user's progress and active learning state.
 */
const AiContextGenerator = {
  generate(data) {
    if (!data) return "";
    
    const isYouTube = data.platform === "youtube";
    const platformTerm = isYouTube ? "YouTube Playlist" : "Udemy Course";
    const titleTerm = isYouTube ? "Playlist" : "Course";
    const instructorTerm = isYouTube ? "Creator" : "Instructor";
    const lecturesTerm = isYouTube ? "videos" : "lectures";
    const lectureTerm = isYouTube ? "video" : "lecture";
    
    let ai = `Use this information as the learner's current course progress and learning context.\n\n`;
    ai += `# Learning Context: ${platformTerm} Progress\n`;
    ai += `* **${titleTerm}:** ${data.title}\n`;
    if (data.instructor) ai += `* **${instructorTerm}:** ${data.instructor}\n`;
    if (data.duration) ai += `* **Duration:** ${data.duration}\n`;
    
    if (data.progress) {
      const p = data.progress;
      if (isYouTube) {
        ai += `* **Progress:** ${p.percentComplete}% complete (${p.completedLecturesCount}/${p.totalLecturesCount} ${lecturesTerm})\n`;
      } else {
        ai += `* **Progress:** ${p.percentComplete}% complete (${p.completedLecturesCount}/${p.totalLecturesCount} ${lecturesTerm}, ${p.completedSectionsCount}/${p.totalSectionsCount} sections)\n`;
      }
    }
    ai += '\n';
    
    ai += `## Learning Position\n`;
    if (data.currentLecture) {
      const cur = data.currentLecture;
      if (isYouTube) {
        ai += `* **Current Video:** "${cur.title}" (Video #${cur.id})\n`;
      } else {
        ai += `* **Current Lecture:** "${cur.title}" (Section ${cur.sectionIndex + 1}: ${cur.sectionName})\n`;
      }
    }
    
    if (data.lastCompletedLecture) {
      const last = data.lastCompletedLecture;
      if (isYouTube) {
        ai += `* **Last Completed Video:** "${last.title}" (Video #${last.id})\n`;
      } else {
        ai += `* **Last Completed Lecture:** "${last.title}" (Section ${last.sectionIndex + 1}: ${last.sectionName})\n`;
      }
    }
    
    if (data.nextLecture) {
      const next = data.nextLecture;
      if (isYouTube) {
        ai += `* **Next Video:** "${next.title}" (Video #${next.id})\n`;
      } else {
        ai += `* **Next Lecture:** "${next.title}" (Section ${next.sectionIndex + 1}: ${next.sectionName})\n`;
      }
    }
    ai += '\n';
    
    if (isYouTube) {
      // YouTube specific compact progress summary
      const flatSection = data.sections[0];
      const allVideos = flatSection ? flatSection.lectures : [];
      const completedVideos = allVideos.filter(v => v.completed);
      const remainingVideos = allVideos.filter(v => !v.completed);
      
      // Completed Videos section
      ai += `## Completed Videos\n`;
      if (completedVideos.length === 0) {
        ai += `* No videos completed yet.\n`;
      } else {
        // If there are many completed, only list the last 5 to save tokens
        if (completedVideos.length > 8) {
          ai += `* ... ${completedVideos.length - 5} older videos completed\n`;
          completedVideos.slice(-5).forEach(v => {
            ai += `* Video #${v.id}: ${v.title} — ✅ Completed\n`;
          });
        } else {
          completedVideos.forEach(v => {
            ai += `* Video #${v.id}: ${v.title} — ✅ Completed\n`;
          });
        }
      }
      ai += `\n`;
      
      // Current Video Detail
      if (data.currentLecture) {
        ai += `## Current Video Detail\n`;
        ai += `* **Video #${data.currentLecture.id}: ${data.currentLecture.title}** ← CURRENT\n\n`;
      }
      
      // Upcoming Videos section (next 10 videos)
      ai += `## Upcoming Videos\n`;
      // Filter out the active video if it's already shown in detail above
      const curId = data.currentLecture ? data.currentLecture.id : -1;
      const futureOnly = remainingVideos.filter(v => v.id > curId);
      
      if (futureOnly.length === 0) {
        ai += `* All videos reached or completed!\n`;
      } else {
        if (futureOnly.length > 10) {
          futureOnly.slice(0, 10).forEach(v => {
            ai += `* Video #${v.id}: ${v.title}\n`;
          });
          ai += `* ... and ${futureOnly.length - 10} other upcoming videos in playlist\n`;
        } else {
          futureOnly.forEach(v => {
            ai += `* Video #${v.id}: ${v.title}\n`;
          });
        }
      }
      ai += `\n`;
      
    } else {
      // Udemy compact progress summary
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
    }
    
    // AI Instruction Block
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
