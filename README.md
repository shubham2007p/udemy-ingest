# UdemyIngest

Turn Udemy courses into AI-ready context.

UdemyIngest is a Chrome extension that extracts the structure of a Udemy course and converts it into a format that Large Language Models (LLMs) can understand.

Instead of manually explaining your course to ChatGPT, Claude, Gemini, or other AI assistants, UdemyIngest generates a structured course dump containing curriculum information, metadata, and learning context.

Inspired by the simplicity of GitIngest, but designed for online learning.

---

## Why?

AI assistants are excellent tutors, but they usually have no idea:

* Which course you're taking
* What topics have been covered
* What comes next in the curriculum
* How the course is structured
* The scope and depth of the course

As a result, users must repeatedly explain their learning context.

UdemyIngest solves this problem by transforming a Udemy course curriculum into an AI-friendly representation.

---

## Example Output

```markdown
# Python & TensorFlow: Deep Dive into Machine Learning

Instructor: Meta Brains

Duration: 3h 1m

## Curriculum

### Section 1 - Introduction to Machine & Deep Learning

- What is Machine Learning?
- Types of Machine Learning
- Applications of Machine Learning

### Section 2 - Basics of TensorFlow

- What is TensorFlow?
- Installing TensorFlow
- TensorFlow Architecture
```

The generated output can be pasted directly into AI assistants.

---

## Features

### Current

* Extract course title
* Extract curriculum structure
* Extract sections
* Extract lecture names
* Extract lecture durations
* Generate Markdown output

### Planned

* JSON export
* One-click copy to clipboard
* Course statistics
* Learning dependency graphs
* AI context blocks
* Progress-aware exports
* Support for multiple learning platforms

---

## How It Works

1. Open a Udemy course page.
2. Launch UdemyIngest.
3. Click Generate Course Dump.
4. The extension extracts visible curriculum information.
5. Markdown and structured outputs are generated.
6. Paste the result into your preferred AI assistant.

---

## Project Goals

The long-term vision is not simply to export course data.

The goal is to create a bridge between online learning platforms and AI systems.

UdemyIngest aims to provide AI assistants with enough context to:

* Understand a course structure
* Build study plans
* Generate quizzes
* Recommend projects
* Identify missing prerequisites
* Track learning progress

---

## MVP Scope

The first version focuses exclusively on:

* Udemy
* Chrome
* Curriculum extraction
* Markdown generation

No video content is downloaded or processed.

Only information visible to the user is extracted.

---

## Technical Stack

* HTML
* CSS
* JavaScript
* Chrome Extension Manifest V3

---

## Roadmap

### Version 0.1

* Curriculum extraction
* Markdown export

### Version 0.2

* JSON export
* Copy to clipboard

### Version 0.3

* AI context generation
* Course statistics

### Version 0.4

* Learning graph generation
* Progress tracking

### Version 1.0

* Complete AI-ready course ingestion pipeline

---

## Contributing

Feedback, issues, and feature requests are welcome.

---

## License

MIT License
