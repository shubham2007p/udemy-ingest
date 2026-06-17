/**
 * Markdown Generator
 * Generates platform-aware Markdown representation of course/playlist data.
 */
const MarkdownGenerator = {
  generate(data) {
    if (!data) return "";
    
    const isYouTube = data.platform === "youtube";
    const instructorTerm = isYouTube ? "Creator" : "Instructor";
    const lectureTerm = isYouTube ? "video" : "lecture";
    const lecturesTerm = isYouTube ? "videos" : "lectures";
    
    let md = `# ${data.title}\n\n`;
    if (data.instructor) md += `${instructorTerm}: ${data.instructor}\n`;
    if (data.duration) md += `Duration: ${data.duration}\n`;
    
    if (data.progress) {
      const p = data.progress;
      if (isYouTube) {
        md += `Progress: ${p.percentComplete}% complete (${p.completedLecturesCount}/${p.totalLecturesCount} ${lecturesTerm} completed)\n`;
      } else {
        md += `Progress: ${p.percentComplete}% complete (${p.completedLecturesCount}/${p.totalLecturesCount} ${lecturesTerm}, ${p.completedSectionsCount}/${p.totalSectionsCount} sections completed)\n`;
      }
    }
    
    if (data.currentLecture) {
      const cur = data.currentLecture;
      if (isYouTube) {
        md += `Current Position: Video #${cur.id} - "${cur.title}"\n`;
      } else {
        md += `Current Position: Section ${cur.sectionIndex + 1} - "${cur.sectionName}" > Lecture "${cur.title}"\n`;
      }
    }
    md += `\n`;
    
    if (data.learningObjectives && data.learningObjectives.length > 0) {
      md += `## Learning Objectives\n`;
      data.learningObjectives.forEach(obj => {
        md += `* ${obj}\n`;
      });
      md += `\n`;
    }
    
    if (data.prerequisites && data.prerequisites.length > 0) {
      md += `## Prerequisites\n`;
      data.prerequisites.forEach(req => {
        md += `* ${req}\n`;
      });
      md += `\n`;
    }

    if (data.description) {
      md += `## Description\n${data.description}\n\n`;
    }
    
    if (isYouTube) {
      md += `## Playlist Videos\n\n`;
      data.sections.forEach((sec) => {
        sec.lectures.forEach((lec) => {
          const durStr = lec.duration ? ` (${lec.duration})` : '';
          const check = lec.completed ? '[x]' : '[ ]';
          const currentMarker = lec.isCurrent ? ' <-- CURRENT POSITION' : '';
          md += `* ${check} ${lec.title}${durStr}${currentMarker}\n`;
        });
      });
    } else {
      md += `## Curriculum\n\n`;
      data.sections.forEach((sec, idx) => {
        const secStatus = sec.completed ? ' [COMPLETED]' : '';
        md += `### Section ${idx + 1} - ${sec.name}${secStatus}\n\n`;
        sec.lectures.forEach((lec) => {
          const durStr = lec.duration ? ` (${lec.duration})` : '';
          const check = lec.completed ? '[x]' : '[ ]';
          const currentMarker = lec.isCurrent ? ' <-- CURRENT POSITION' : '';
          md += `* ${check} ${lec.title}${durStr}${currentMarker}\n`;
        });
        md += `\n`;
      });
    }
    
    return md.trim();
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = MarkdownGenerator;
}
