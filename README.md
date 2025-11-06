# AutoFiller - Smart Cover Letter Generator

A Chrome extension that automatically generates tailored cover letters using Google's Gemini AI for job applications on Greenhouse.

## Features

- 🤖 **AI-Powered Generation**: Uses Gemini AI to create personalized cover letters
- 📝 **Auto-Fill**: Automatically fills cover letter fields on Greenhouse application forms
- 📥 **Download Option**: Downloads cover letters as HTML files when auto-fill isn't available
- 💾 **Resume Storage**: Saves your resume for reuse
- ⚙️ **Customizable**: Choose tone (professional, enthusiastic, technical, creative) and length
- 🎯 **Smart Detection**: Automatically extracts job details from supported Greenhouse job sites

## Setup Instructions

### 1. Configure Gemini API Key

1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a `.env` file in the project root with:

```env
GEMINI_API=your_actual_api_key_here
```

3. Run the build script to generate the configuration:

```bash
npm install
npm run build
```

### 2. Install Extension in Developer Mode

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `autofiller` folder
5. The extension should now appear in your extensions list

### 3. Pin the Extension

1. Click the puzzle piece icon in Chrome toolbar
2. Find "AutoFiller - Smart Cover Letter Generator"
3. Click the pin icon to keep it visible

## How to Use

### Step 1: Add Your Resume
1. Click the AutoFiller extension icon
2. Paste your resume text in the "Your Resume" section
3. Click "Save Resume"

### Step 2: Navigate to a Job
1. Go to a Greenhouse-powered job application page
2. Open the job application form
3. The extension will automatically detect job details and confirm Greenhouse support

### Step 3: Generate Cover Letter
1. Click the extension icon
2. Review the detected job details
3. Choose your preferred tone and length
4. Click "Generate Cover Letter"

### Step 4: Use the Cover Letter
- **If cover letter field is detected**: Click "Fill Form" to auto-fill
- **If no field detected**: Click "Download" to save as HTML file and upload manually

## Supported Scenarios

### ✅ Auto-Fill (Preferred)
- Greenhouse job application forms with a cover letter field (including the "Enter manually" textarea)
- Automatically fills the generated cover letter into the form

### ✅ Download & Upload
- Pages with file upload only
- Downloads cover letter as HTML file
- You can then upload the file to the job application

## Troubleshooting

### "API: Not configured" Error
- Make sure you've added your Gemini API key to `config/config.js`
- Reload the extension after making changes

### "Unsupported site" Warning
- The extension works on Greenhouse job pages
- Navigate to a supported job application page

### Cover Letter Field Not Detected
- Try clicking "Refresh" in the extension popup
- The extension will automatically offer download option as fallback

### Extension Not Working
1. Check if the extension is enabled in `chrome://extensions/`
2. Try reloading the extension
3. Refresh the job application page
4. Check the browser console for errors (F12 → Console)

## File Structure

```
autofiller/
├── manifest.json          # Extension configuration
├── config/
│   └── config.js          # API key and settings
├── background/
│   └── background.js      # API calls and storage
├── content/
│   ├── content.js         # Page interaction
│   └── content.css        # Styling
├── popup/
│   ├── popup.html         # Extension UI
│   ├── popup.css          # UI styling
│   └── popup.js           # UI logic
├── assets/                # Icons (create your own)
└── README.md             # This file
```

## Privacy & Security

- Your resume is stored locally in Chrome's storage
- API calls are made directly to Google's Gemini API
- No data is sent to third-party servers
- Job details are extracted locally from the page

## Limitations

- Currently works on Greenhouse job applications only
- Requires manual API key configuration
- Chrome extension only (no Firefox support yet)

## Future Enhancements

- Support for more job sites (LinkedIn, Indeed, etc.)
- Better PDF generation
- Multiple resume templates
- Cover letter templates
- Analytics and success tracking

## Version History

- **v1.0.0**: Initial release with Greenhouse support and Gemini AI integration
