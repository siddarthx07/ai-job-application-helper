# AutoFiller - ai-job-application-helper

A Chrome extension that automatically generates tailored resumes & cover letters using Google's Gemini AI for job applications on Greenhouse, Workday, Lever, and most job application pages.

## Features

- 🤖 **AI-Powered Generation**: Uses Gemini AI to create personalized cover letters
- 📝 **Smart Auto-Fill**: Automatically detects and fills cover letter fields on job forms
- 📌 **Docked Side Panel**: Full-height Chrome Side Panel experience so you can work right next to the application form
- 🎯 **Multi-Source Detection**: Extracts job details from structured data, Open Graph, DOM heuristics, and site-specific selectors
- 🌐 **Universal Support**: Works on any job site (optimized for Greenhouse, Workday, Lever)
- 🔍 **Intelligent Field Detection**: Finds cover letter fields using site-specific selectors and generic heuristics
- ⚙️ **Customizable**: Choose tone (professional, enthusiastic, technical, creative) and length (short, medium, long)
- ✏️ **Edit & Persist**: Review, edit, and save generated cover letters
- 💾 **Local Storage**: Resume and preferences saved locally

## Setup

### 1. Configure API Key

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a `.env` file in the project root:
   ```env
   GEMINI_API=your_actual_api_key_here
   ```
3. Build the configuration:
   ```bash
   npm install
   npm run build
   ```

### 2. Install Extension

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `autofiller` folder
4. Pin the extension to your toolbar

## Usage

1. **Open AutoFiller**: Click the extension icon to open Chrome's side panel on the right. The workspace stays pinned while you browse job pages.
2. **Upload Resume**: Use the "Upload Resume PDF" button once. The file stays local and powers both cover letters and the tailored resume feature.
3. **Navigate to Job**: Open any job application page. The side panel will show detected company, role, and whether a cover-letter field exists.
4. **Generate Cover Letter**: Choose tone/length → Generate → Edit if necessary → Click "Fill Form" to push it into the application.
5. **Tailor Your Resume**: Hit "Generate Tailored Resume" to produce a LaTeX file, view insights, and download the .tex file to compile.

### Tailored Resume Workflow

- AutoFiller uploads your PDF resume locally (no servers) and sends it to Gemini along with the current job description.
- Gemini returns a JSON payload containing:
  - A fully rewritten LaTeX document that keeps your template + section order
  - Skill-match scores (so you know which keywords are hitting)
  - Keyword gaps and suggested bullets (flagged for review)
- You can download the generated LaTeX file and compile it using Overleaf or your local LaTeX installation.
- The tailored LaTeX + insights are cached per job, so revisiting the same job instantly reloads your last version.

The extension automatically detects job details and cover letter fields. Works with textarea, input, and contenteditable fields.

## Troubleshooting

- **API Not Configured**: Ensure `.env` file exists and run `npm run build`
- **Field Not Detected**: Click "Refresh" inside the side panel, ensure you're on the actual application form (not just the posting)
- **Job Details Missing**: Extension waits up to 15s for async content - try refreshing
- **Extension Not Working**: Reload extension in `chrome://extensions/`, refresh page, check console (F12)

## Privacy & Security

- All data stored locally in Chrome storage
- Direct API calls to Google Gemini (no intermediate servers)
- No tracking or third-party data collection
- Job details extracted locally from page DOM

## Limitations

- Requires Gemini API key (free tier available)
- Chrome/Chromium only
- Some custom forms may require manual field detection

## Version History

**v1.0.0**: Initial release with Greenhouse/Workday/Lever support, multi-source job detection, intelligent field detection, and cover letter editing.
