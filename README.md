<p align="center">
  <br>
  <img src="https://img.icons8.com/nolan/128/artificial-intelligence.png" alt="Udemy Ingest Logo" width="80" height="80">
  <h1 align="center">🎓 Udemy Ingest</h1>
  <p align="center"><strong>Convert Udemy course structures and learning progress into portable, prompt-ready AI context with a single click.</strong></p>
</p>

<p align="center">
  <a href="https://github.com/shubham2007p/udemy-ingest/blob/main/LICENSE"><img src="https://img.shields.io/github/license/shubham2007p/udemy-ingest?color=blue&style=flat-square" alt="License"></a>
  <a href="https://github.com/shubham2007p/udemy-ingest/stargazers"><img src="https://img.shields.io/github/stars/shubham2007p/udemy-ingest?color=yellow&style=flat-square" alt="Stars"></a>
  <img src="https://img.shields.io/badge/Chrome-Extension-orange?style=flat-square" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-brightgreen?style=flat-square" alt="Manifest V3">
</p>

<p align="center">
  <a href="#-why-udemy-ingest">Why Udemy Ingest?</a> ·
  <a href="#-key-features">Key Features</a> ·
  <a href="#-installation--updates">Installation & Updates</a> ·
  <a href="#-supported-platforms">Supported Platforms</a>
</p>

---

## 💡 Why Udemy Ingest?

Modern learners frequently use AI assistants (ChatGPT, Claude, Gemini) alongside structured online courses, but those assistants have no awareness of:

* 📺 **What course you are studying** (missing syllabus outline and instructor context).
* 🎯 **What topics you've completed** (wasted time rehashing already covered material).
* 🧭 **Where you currently are** (missing the active lecture context).
* 📝 **What curriculum remains** (no roadmap to guide the AI's support).

Udemy Ingest bridges this gap. With a single click, it extracts your course structure and real-time learning progress, generating structured, prompt-ready context designed to paste directly into your AI assistant.

---

## 🛠️ Key Features

* **Real-Time Progress Tracking**: Extracts current lecture, current section, and counts of completed vs. remaining topics.
* **Smart DOM & API Extraction**: Pulls syllabus and progress information using Udemy's internal APIs (with cookie authorization) and falls back to player sidebar DOM scraping.
* **Three Structured Export Formats**:
  * 📝 **Markdown**: Clean, readable outline with completion checkmarks (`[x]` and `[ ]`) and active position indicators.
  * 🗂️ **JSON**: Complete machine-readable syllabus structure and progress statistics.
  * 🤖 **AI Context**: Prompt-ready, instruction-prepended text optimized for immediate continuity in LLMs.
* **One-Click Copy**: Clipboard actions copy selected formats instantly with visual status feedback.

---

## 📦 Installation & Updates

### ⬇️ Direct Download Link
* 🚀 **[Download the Latest Release (ZIP)](https://github.com/shubham2007p/udemy-ingest/archive/refs/heads/main.zip)**
*(Extract the ZIP folder to your local machine before proceeding)*

---

### 💻 How to Install (Chrome Developer Mode)
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left.
4. Select the `extension` folder inside the directory where you cloned or extracted this repository (the folder containing `manifest.json`).

---

### 🔄 How to Keep Updated (Systematic Updates)

To ensure you don't have to keep downloading ZIP files over and over, you can use the following methods:

#### Method A: Git Clone (Recommended)
If you install the extension by cloning the repository, updating is as simple as running one command:
1. Open your terminal in the repository folder.
2. Run the update command:
   ```bash
   git pull origin main
   ```
3. Go to `chrome://extensions/` and click the **Reload (circular arrow)** icon on the Udemy Ingest card. The extension will update to the latest pushed version immediately.

#### Method B: CRX Packaged Auto-Updates (Advanced)
The extension includes a self-hosted autoupdate configuration. If you package the extension into a `.crx` file:
* The `manifest.json` specifies `update_url` pointing to `updates.xml` on this repository.
* When you push updates to GitHub, Chrome will check `updates.xml` and automatically download and install updates in the background.

---

## 🌐 Supported Platforms

* **Udemy** (Personal Consumer Accounts)
* **Udemy Business / Enterprise** (Self-hosted subdomains are dynamically resolved)

---

## 📝 Example AI Context Output

```markdown
Use this information as the learner's current course progress and learning context.

# Learning Context: Udemy Course Progress
* **Course:** Python Coding Essentials
* **Instructor:** Hitesh Choudhary
* **Current Progress:** 80% Complete (4/5 lectures completed)
* **Current Position:** Section 2 - Introduction to Coding world with python > Lecture "What is Programming..?"

## Completed Topics
* **Section 1: Introduction** - [All 3 lectures completed]
* **Section 2: Introduction to Coding world with python**
  - [x] Meet your Instructor - Hitesh

## Remaining Topics to Study
* **Section 2: Introduction to Coding world with python**
  - [ ] What is Programming..? <-- CURRENT POSITION (Start here)
```

---

## 📄 License
Distributed under the MIT License. See [LICENSE](file:///c:/Users/shubh/Downloads/idea%20projects/udemy%20ingest%20chrome%20extension/LICENSE) for more information.
