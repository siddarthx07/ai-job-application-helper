# Quick Setup Guide

## 🚀 Get Started in 3 Steps

### Step 1: Configure Your API Key
1. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Your `.env` file should already contain:
   ```env
   GEMINI_API=your_actual_api_key_here
   ```
3. Run the build script:
   ```bash
   npm install
   npm run build
   ```

### Step 2: Install Extension
1. Open Chrome
2. Go to `chrome://extensions/`
3. Turn ON "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select this `autofiller` folder
6. ✅ Extension installed!

### Step 3: Pin & Use
1. Click the puzzle piece 🧩 in Chrome toolbar
2. Pin the "AutoFiller" extension
3. Go to a job application page
4. Click the AutoFiller icon – Chrome opens our full-height side panel on the right
5. Keep the panel open while you browse, upload your PDF resume once, and then generate cover letters or tailored resumes!

## ⚡ Quick Test
1. Go to any job posting page
2. Click the AutoFiller extension icon
3. You should see job details detected and the extension ready to use

## 🔧 Troubleshooting
- **"API: Not configured"**: Add your Gemini API key to `.env` and run `npm run build`
- **"Unsupported site"**: Navigate to a job application page
- **Extension not visible**: Check `chrome://extensions/` and make sure it's enabled

## 📝 Usage Flow
1. **Upload Resume**: Click "Upload Resume PDF" in the side panel (file stays local)
2. **Find Job**: Go to a job application page
3. **Cover Letter**: Click "Generate Cover Letter" inside the panel, then "Fill Form"
4. **Tailored Resume**: Click "Generate Tailored Resume" to download a LaTeX file customized for that job

That's it! You're ready to auto-generate tailored cover letters! 🎉
