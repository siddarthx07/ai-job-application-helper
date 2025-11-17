# AutoFiller - Smart Cover Letter Generator

A Chrome extension that automatically generates tailored cover letters using Google's Gemini AI for job applications on Greenhouse, Workday, Lever, and most job application pages.

## Features

- 🤖 **AI-Powered Generation**: Uses Gemini AI to create personalized cover letters
- 📝 **Smart Auto-Fill**: Automatically detects and fills cover letter fields on job forms
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

1. **Add Resume**: Click extension icon → Paste resume → Save
2. **Navigate to Job**: Open any job application page
3. **Generate**: Review detected job details → Choose tone/length → Generate
4. **Fill Form**: Click "Fill Form" to auto-fill, or edit first if needed

The extension automatically detects job details and cover letter fields. Works with textarea, input, and contenteditable fields.

## Troubleshooting

- **API Not Configured**: Ensure `.env` file exists and run `npm run build`
- **Field Not Detected**: Click "Refresh" in popup, ensure you're on the application form (not just job posting)
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
