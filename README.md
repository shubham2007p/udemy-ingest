<p align="center">
  <br>
  <img alt="AI Ingest" src="extension/icon-128.png" width="80">
</p>

<h1 align="center">AI Ingest</h1>

<p align="center">
  <strong>Turn your learning progress into AI-ready context — in one click.</strong>
</p>

<p align="center">
  <em>Stop explaining what you're learning. Start learning.</em>
</p>

<br>

<p align="center">
  <a href="https://github.com/shubham2007p/udemy-ingest/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-0969da?style=for-the-badge&labelColor=1a1a2e" alt="License"></a>&nbsp;
  <a href="https://github.com/shubham2007p/udemy-ingest/stargazers"><img src="https://img.shields.io/badge/Stars-⭐_Star_This_Repo-e3b341?style=for-the-badge&labelColor=1a1a2e" alt="Stars"></a>&nbsp;
  <img src="https://img.shields.io/badge/Platform-Chrome-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white&labelColor=1a1a2e" alt="Chrome">&nbsp;
  <img src="https://img.shields.io/badge/Manifest-V3-00c853?style=for-the-badge&labelColor=1a1a2e" alt="Manifest V3">
</p>

<p align="center">
  <a href="#-the-problem">The Problem</a>&ensp;·&ensp;
  <a href="#-how-it-works">How It Works</a>&ensp;·&ensp;
  <a href="#-features">Features</a>&ensp;·&ensp;
  <a href="#-quick-start">Quick Start</a>&ensp;·&ensp;
  <a href="#-keeping-updated">Keeping Updated</a>&ensp;·&ensp;
  <a href="#-roadmap">Roadmap</a>
</p>

<br>

---

<br>

## 🧩 The Problem

You're halfway through a 40-hour Udemy course. You open ChatGPT to ask a question.

The AI has **zero context**:

| What the AI doesn't know | Why it matters |
| :--- | :--- |
| Which course you're studying | It can't tailor answers to your curriculum |
| What you've already completed | It wastes time re-explaining covered material |
| Where you currently are | It can't pick up where you left off |
| What topics come next | It can't prepare you for upcoming content |

**Result?** You spend 5 minutes rebuilding context before every conversation.

**AI Ingest eliminates this entirely.**

<br>

## ⚡ How It Works

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│ Course Page  │────▶│    AI Ingest      │────▶│   AI Assistant   │
│              │     │                   │     │                  │
│ • Curriculum │     │ • Extract course  │     │ ✓ Knows course   │
│ • Progress   │     │ • Detect progress │     │ ✓ Knows progress │
│ • Position   │     │ • Format context  │     │ ✓ Knows position │
└──────────────┘     └───────────────────┘     └──────────────────┘
```

**30 seconds.** Open extension → Extract → Copy → Paste into any AI.

<br>

## ✨ Features

### Three Export Formats

<table>
  <tr>
    <td width="33%" align="center">
      <h4>📝 Markdown</h4>
      <p>Human-readable outline with<br><code>[x]</code> completion checkmarks<br>and position markers</p>
    </td>
    <td width="33%" align="center">
      <h4>🗂️ JSON</h4>
      <p>Machine-readable structure<br>with full progress statistics<br>and metadata</p>
    </td>
    <td width="33%" align="center">
      <h4>🤖 AI Context</h4>
      <p>Prompt-ready text with<br>instruction prefix, optimized<br>for LLM continuity</p>
    </td>
  </tr>
</table>

### Core Capabilities

| Feature | Description |
| :--- | :--- |
| **Progress Tracking** | Detects completed / remaining lectures and sections in real time |
| **Current Position** | Identifies exactly which lecture you're on right now |
| **Smart Extraction** | Multi-tier: Udemy API → Subscriber API → DOM scraping fallback |
| **One-Click Copy** | Copy any format to clipboard instantly |
| **Udemy Business** | Dynamically resolves enterprise subdomains |

<br>

## 📋 Example Output

<details>
<summary><strong>🤖 AI Context Export</strong> (click to expand)</summary>

```
Use this information as the learner's current course progress and learning context.

# Learning Context: Udemy Course Progress
* **Course:** Complete Python Bootcamp
* **Instructor:** Hitesh Choudhary
* **Duration:** 1h 26m
* **Progress:** 80% complete (4/5 lectures, 1/2 sections)

## Learning Position
* **Current Lecture:** "What is Programming?" (Section 2: Intro to Coding)
* **Last Completed Lecture:** "Meet your Instructor - Hitesh" (Section 2: Intro to Coding)
* **Next Lecture:** "What is Programming?" (Section 2: Intro to Coding)

## Completed Sections
* Section 1: Introduction — ✅ All 3 lectures completed
* Section 2: Intro to Coding — 1/2 lectures completed

## Current Section Detail
**Section 2: Intro to Coding** (1/2 completed)
  - [x] Meet your Instructor - Hitesh
  - [ ] What is Programming? ← CURRENT

## Upcoming Sections
* All sections reached or completed!

## Instructions for AI Assistant
- Assume the learner has understood all completed topics listed above.
- Do not re-explain or repeat completed material unless explicitly asked.
- Prioritize the current section and current lecture topic in your responses.
- When relevant, recommend or preview upcoming topics from the next sections.
- If the learner asks a question, frame your answer within the context of this course's curriculum.
```

</details>

<details>
<summary><strong>📝 Markdown Export</strong> (click to expand)</summary>

```markdown
# Complete Python Bootcamp

Instructor: Hitesh Choudhary
Duration: 1h 26m
Progress: 80% complete (4/5 lectures, 1/2 sections completed)
Current Position: Section 2 - "Intro to Coding" > Lecture "What is Programming?"

## Curriculum

### Section 1 - Introduction [COMPLETED]

* [x] Installation of Tools (VSCode and Python) (3 min)
* [x] VS Code Setup (Extensions and Themes) (2 min)
* [x] Get your code files here (1 min)

### Section 2 - Intro to Coding

* [x] Meet your Instructor - Hitesh (5 min)
* [ ] What is Programming? (8 min) <-- CURRENT POSITION
```

</details>

<br>

## 🚀 Quick Start

### Option 1 — Direct Download (No Setup Needed)

> **[⬇ Download AI Ingest Extension (ZIP)](https://github.com/shubham2007p/udemy-ingest/raw/main/ai-ingest.zip)**

1. Extract the downloaded ZIP file into a folder (e.g., `ai-ingest`).
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left.
5. Select the folder where you extracted the ZIP files (the folder containing `manifest.json` directly).

### Option 2 — Clone with Git (Recommended for Devs)

```bash
git clone https://github.com/shubham2007p/udemy-ingest.git
```

Then load the `extension/` folder as unpacked in Chrome.

<br>

## 🔐 Security

**Why**: The YouTube API key must never be hard‑coded in the extension source because the extension bundle is publicly visible to anyone who installs it. Exposing the key allows anyone to use your quota and may result in unexpected charges or quota exhaustion.

**How to configure**:
1. Open the extension popup and click the **Settings** (gear) icon.
2. In the **YouTube API Key** field, paste your own API key obtained from the Google Cloud Console.
3. Click **Save**. The key is stored in Chrome's local storage and will be used by the extension.

**How to get your own YouTube API Key (v3)**:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google Account and create a new project (or select an existing one) from the project selector dropdown at the top.
3. Open the navigation menu, go to **APIs & Services > Library**.
4. In the API Library, search for **YouTube Data API v3** and click on it.
5. Click the **Enable** button.
6. Once enabled, go to **APIs & Services > Credentials** from the left sidebar.
7. Click **+ Create Credentials** at the top and select **API key**.
8. Copy the generated API key.
9. *(Recommended)* Click **Restrict Key** on the API key settings to restrict its usage to the YouTube Data API v3 to secure it further.

**Important**: Since the key you previously shared was included in the source code, it is now exposed. Please generate a new API key in the Google Cloud Console and replace the compromised one.

## 🔄 Keeping Updated

One of the biggest pain points with sideloaded extensions is staying current. We solve this:

### Git Pull Method (Recommended)

If you cloned the repository, updating is a single command:

```bash
git pull origin main
```

Then click the **↻ Reload** button on the extension card in `chrome://extensions/`. Done.

### Chrome Web Store (Coming Soon)

Once published to the Chrome Web Store, the extension will update automatically — no manual steps required.

<br>

## 🗺️ Roadmap

| Version | Status | Features |
| :--- | :---: | :--- |
| **v0.1** | ✅ Done | Curriculum extraction, Markdown export |
| **v0.2** | ✅ Done | JSON export, one-click copy |
| **v0.3** | ✅ Done | AI Context export, progress tracking, current position detection |
| **v0.4** | ✅ Done | YouTube support, progress history |
| **v1.0** | 📋 Planned | Multi-platform support (Coursera, edX), persistent learner profiles |

<br>

## 🏗️ Tech Stack

<p>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">&nbsp;
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">&nbsp;
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">&nbsp;
  <img src="https://img.shields.io/badge/Chrome_Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
</p>

<br>

## 🌐 Supported Platforms

| Platform | Status |
| :--- | :---: |
| Udemy (Personal) | ✅ Supported |
| Udemy Business / Enterprise | ✅ Supported |
| YouTube | ✅ Supported |
| Coursera | 🔜 Planned |
| edX | 🔜 Planned |

<br>

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<br>

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<br>

---

<p align="center">
  <sub>Built with focus by <a href="https://github.com/shubham2007p">@shubham2007p</a></sub>
</p>
