# DSA Mentor AI

A simple, beginner-friendly Data Structures and Algorithms learning assistant built with JavaScript, Node.js, Express, and the Google Gemini API.

## Features

- **Responsive Chat Interface:** Clean and intuitive UI designed for interactive learning.
- **Gemini AI Explanations:** Clear, beginner-focused explanations tailored for Data Structures and Algorithms.
- **Topic Shortcuts:** Quick prompt buttons for core DSA topics including Arrays, Stacks, Linked Lists, Recursion, Sorting, and Big O notation.
- **Rich Markdown Rendering:** Supports headings, bold text, lists, code blocks, tables, and links.
- **Conversational Context:** Retains recent message history so follow-up questions like *"Can you explain with an example?"* or *"What is its space complexity?"* are understood smoothly.
- **Concise Mode Support:** Provides brief, direct explanations when requested.
- **Robust Error Handling:** Features exponential backoff retries for server overloads (503) and user-friendly notifications for daily free-tier quota limits (429 rate limiting).
- **Secure Key Management:** Keeps the Google Gemini API key safely stored on the server using environment variables (`.env`).

## Requirements

- **Node.js:** v20.0.0 or newer
- **Gemini API Key:** Obtained from [Google AI Studio](https://aistudio.google.com/)

## Project Structure

```text
DSA-Mentor-AI/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .env.example
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── server.js