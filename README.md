<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bundled/blank

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

   # Research Duplicacy Detector

A web app to detect duplicacy/plagiarism in research papers using modern NLP/LLM APIs.

## Demo
![demo-gif](docs/demo.gif) <!-- add a small gif or screenshot -->

## Features
- Upload single/multiple PDFs
- Extract text from PDF
- Compute similarity scores (cosine / embedding-based)
- Show matched sections & confidence score

## Tech stack
- Frontend: React + TypeScript (Vite)
- Uses: Gemini / Embeddings API (set GEMINI_API_KEY)

## Prerequisites
- Node >= 18
- npm or yarn

## Setup
1. `git clone <repo>`
2. `cd Detection_of_duplicacy_inResearchPapers`
3. `npm install`
4. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`
5. `npm run dev`

## Environment variables
Create `.env.local` (do NOT commit real keys). See `.env.example`.

## Contributing
PRs welcome — open an issue first for bigger changes.

## License
MIT License

Copyright (c) [2025] [Himanshu Chaurasiya]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

