// Popup script for AutoFiller Extension
// Handles UI interactions and communication with content/background scripts

class AutoFillerPopup {
  constructor() {
    this.jobDetails = {};
    this.currentTab = null;
    this.generatedCoverLetter = '';
    this.resumeFileMeta = null;
    this.generatedResume = null;
    this.currentJobKey = null;
    this.injectedTabs = new Set();
    this.init();
  }

  async init() {
    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tabs[0];

    console.log('[LaTeX] Using LaTeX.Online API for server-side compilation');

    // Initialize UI
    this.setupEventListeners();
    await this.loadSavedData();
    await this.checkPageStatus();
    this.checkApiConfiguration();
  }

  setupEventListeners() {
    // Resume upload
    const resumeInput = document.getElementById('resumeFileInput');
    document.getElementById('uploadResumeButton').addEventListener('click', () => resumeInput.click());
    resumeInput.addEventListener('change', (event) => this.handleResumeUpload(event));

    // Job details
    document.getElementById('refreshJobDetails').addEventListener('click', () => this.refreshJobDetails());

    // Preferences
    document.getElementById('toneSelect').addEventListener('change', () => this.savePreferences());
    document.getElementById('lengthSelect').addEventListener('change', () => this.savePreferences());

    // Main actions
    document.getElementById('generateButton').addEventListener('click', () => this.generateCoverLetter());
    document.getElementById('generateResumeButton').addEventListener('click', () => this.generateTailoredResume());
    document.getElementById('downloadResumeButton').addEventListener('click', () => this.downloadTailoredResume());

    // Preview actions
    document.getElementById('editButton').addEventListener('click', () => this.enableEditing());
    document.getElementById('fillButton').addEventListener('click', () => this.fillCoverLetter());
    document.getElementById('clearButton').addEventListener('click', () => this.clearCoverLetter());
  }

  async loadSavedData() {
    try {
      // Load resume metadata
      const resumeResponse = await chrome.runtime.sendMessage({ action: 'getResumeFile' });
      if (resumeResponse.success && resumeResponse.resumeFile) {
        const file = resumeResponse.resumeFile;
        this.resumeFileMeta = {
          name: file.name,
          size: file.size,
          uploadedAt: file.uploadedAt,
          hasExtractedText: Boolean(file.text)
        };
        this.updateResumeStatus();
      }

      // Load saved preferences
      const prefResponse = await chrome.runtime.sendMessage({ action: 'getPreferences' });
      if (prefResponse.success && prefResponse.preferences) {
        const prefs = prefResponse.preferences;
        document.getElementById('toneSelect').value = prefs.tone || 'professional';
        document.getElementById('lengthSelect').value = prefs.length || 'medium';
      }

      // Load saved cover letter
      const coverLetterResponse = await chrome.runtime.sendMessage({ action: 'getCoverLetter' });
      if (coverLetterResponse.success && coverLetterResponse.coverLetter) {
        this.generatedCoverLetter = coverLetterResponse.coverLetter;
        this.showPreview(coverLetterResponse.coverLetter);
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }

  async checkPageStatus(hasRetried = false) {
    if (!this.isSupportedPage()) {
      this.showPageWarning();
      return;
    }

    // Show which site is detected
    const siteName = this.getSiteName();
    this.updateStatus('', `Checking ${siteName}...`);

    try {
      // Get job details from content script
      const response = await chrome.tabs.sendMessage(this.currentTab.id, { 
        action: 'getJobDetails' 
      });

      if (response && response.success) {
        const jobDetails = response.jobDetails || {};
        const newJobKey = this.getJobKey(jobDetails);
        if (this.currentJobKey && this.currentJobKey !== newJobKey) {
          this.clearResumePreview();
        }
        this.jobDetails = jobDetails;
        this.currentJobKey = newJobKey;
        this.updateJobDetailsUI(jobDetails, !!response.hasCoverLetterField);
        this.loadStoredResumeForJob();
        this.updateStatus('active', `Ready (${siteName})`);
      } else {
        this.updateStatus('error', 'Page not ready');
      }
    } catch (error) {
      console.error('Error checking page status:', error);
      if (!hasRetried && this.shouldAttemptContentInjection(error)) {
        const injected = await this.ensureContentScriptsInjected();
        if (injected) {
          return this.checkPageStatus(true);
        }
      }
      this.updateStatus('error', 'Connection failed');
      this.showMessage('Could not connect to the job page. Reload it and try again.', 'error');
    }
  }

  isSupportedPage() {
    const url = this.currentTab?.url || '';
    if (!url.startsWith('http')) return false;
    if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
      return false;
    }
    return true;
  }

  getSiteName() {
    const url = this.currentTab?.url || '';
    try {
      const hostname = new URL(url).hostname;
      return hostname || 'Unknown site';
    } catch (error) {
      return 'Unknown site';
    }
  }

  getJobKey(details = this.jobDetails) {
    const company = (details.company || 'unknown').trim().toLowerCase();
    const title = (details.title || 'unknown').trim().toLowerCase();
    return `${company}::${title}`;
  }

  showPageWarning() {
    this.updateStatus('error', 'Unsupported site');
    document.getElementById('jobInfo').innerHTML = `
      <div style="text-align: center; color: #dc3545; padding: 20px;">
        <p><strong>⚠️ Please open a job application page in your browser</strong></p>
        <p style="font-size: 12px; margin-top: 8px;">
          AutoFiller works on most public job postings that load in a regular browser tab.
        </p>
      </div>
    `;
    document.getElementById('generateButton').disabled = true;
  }

  updateJobDetailsUI(jobDetails, hasCoverLetterField) {
    document.getElementById('companyName').textContent = jobDetails.company || 'Not detected';
    document.getElementById('jobTitle').textContent = jobDetails.title || 'Not detected';
    
    const statusElement = document.getElementById('coverLetterStatus');
    if (hasCoverLetterField) {
      statusElement.textContent = '✅ Found (Auto-fill)';
      statusElement.className = 'text-success';
    } else {
      statusElement.textContent = 'Not detected';
      statusElement.className = '';
    }
  }

  updateStatus(type, text) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    statusDot.className = `status-dot ${type}`;
    statusText.textContent = text;
  }

  checkApiConfiguration() {
    const apiStatus = document.getElementById('apiStatus');
    
    // Check if API key is configured from .env
    chrome.runtime.sendMessage({ action: 'checkApiKey' }, (response) => {
      if (response && response.configured) {
        apiStatus.textContent = 'API: Configured ✅';
        apiStatus.className = 'text-success';
        document.getElementById('generateButton').disabled = false;
      } else {
        apiStatus.textContent = 'API: Not configured ❌';
        apiStatus.className = 'text-danger';
        document.getElementById('generateButton').disabled = true;
      }
    });
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-autofiller-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
        } else {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        }
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.dataset.autofillerSrc = src;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  // WASM compiler methods removed - now using LaTeX.Online API for server-side compilation

  async ensurePdfParserRuntime() {
    if (window.__autofillerPdfParserLoaded) {
      return;
    }
    await this.loadScript(chrome.runtime.getURL('vendor/pdfjs/pdf.min.js'));
    if (!window.pdfjsLib) {
      throw new Error('PDF.js library is unavailable');
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdfjs/pdf.worker.min.js');
    window.__autofillerPdfParserLoaded = true;
  }

  async extractTextFromPdf(arrayBuffer) {
    try {
      await this.ensurePdfParserRuntime();
      const typedArray = new Uint8Array(arrayBuffer);
      const loadingTask = window.pdfjsLib.getDocument({ data: typedArray });
      const pdf = await loadingTask.promise;
      let combinedText = '';
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
          .map(item => (item.str || '').trim())
          .filter(Boolean)
          .join(' ');
        if (pageText) {
          combinedText += `${pageText}\n\n`;
        }
      }
      return combinedText.trim();
    } catch (error) {
      console.error('Failed to extract text from resume PDF:', error);
      return '';
    }
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 0xffff) {
      const chunk = bytes.subarray(i, i + 0xffff);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return window.btoa(binary);
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return `Updated ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch (error) {
      return '';
    }
  }

  updateResumeStatus() {
    const nameEl = document.getElementById('resumeFileName');
    const updatedEl = document.getElementById('resumeUpdatedAt');
    const statusEl = document.getElementById('resumeUploadStatus');
    if (this.resumeFileMeta?.name) {
      nameEl.textContent = this.resumeFileMeta.name;
      updatedEl.textContent = this.formatTimestamp(this.resumeFileMeta.uploadedAt);
      if (this.resumeFileMeta.hasExtractedText === false) {
        statusEl.textContent = '⚠️ Text extraction failed';
        statusEl.style.color = '#dc3545';
      } else {
        statusEl.textContent = '';
        statusEl.style.color = '';
      }
    } else {
      nameEl.textContent = 'No resume uploaded';
      updatedEl.textContent = '';
      statusEl.textContent = '';
      statusEl.style.color = '';
    }
  }

  async handleResumeUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      this.showMessage('Please upload a PDF resume file', 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const arrayBuffer = loadEvent.target.result;

        // Clone the ArrayBuffer before PDF.js detaches it
        const arrayBufferCopy = arrayBuffer.slice(0);

        const extractedText = await this.extractTextFromPdf(arrayBufferCopy);
        if (!extractedText?.trim()) {
          this.showMessage('Could not extract text from PDF. Please upload a text-based resume.', 'error');
          event.target.value = '';
          return;
        }
        const base64 = this.arrayBufferToBase64(arrayBuffer);
        const payload = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64,
          uploadedAt: Date.now(),
          text: extractedText
        };

        const response = await chrome.runtime.sendMessage({
          action: 'saveResumeFile',
          resumeFile: payload
        });

        if (!response || !response.success) {
          throw new Error(response?.error || 'Failed to save resume to storage');
        }

        this.resumeFileMeta = {
          name: payload.name,
          size: payload.size,
          uploadedAt: payload.uploadedAt,
          hasExtractedText: true
        };
        this.updateResumeStatus();

        const statusEl = document.getElementById('resumeUploadStatus');
        statusEl.textContent = '✅ Uploaded';
        statusEl.style.color = '';
        setTimeout(() => {
          statusEl.textContent = '';
        }, 2500);
      } catch (error) {
        console.error('Failed to store resume file', error);
        this.showMessage('Failed to store resume file', 'error');
      } finally {
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      this.showMessage('Could not read the selected file', 'error');
      event.target.value = '';
    };

    reader.readAsArrayBuffer(file);
  }

  async savePreferences() {
    const preferences = {
      tone: document.getElementById('toneSelect').value,
      length: document.getElementById('lengthSelect').value
    };

    try {
      await chrome.runtime.sendMessage({ 
        action: 'savePreferences', 
        preferences 
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  async refreshJobDetails() {
    if (!this.isSupportedPage()) {
      this.showPageWarning();
      return;
    }

    this.updateStatus('', 'Refreshing...');
    await this.checkPageStatus();
  }

  async generateCoverLetter() {
    if (!this.resumeFileMeta) {
      this.showMessage('Upload your resume PDF first', 'error');
      return;
    }
    if (!this.resumeFileMeta.hasExtractedText) {
      this.showMessage('Resume text unavailable. Re-upload a readable PDF.', 'error');
      return;
    }

    if (!this.jobDetails.title && !this.jobDetails.company) {
      this.showMessage('No job details detected. Try refreshing.', 'error');
      return;
    }

    // Show loading
    this.showLoading(true);
    document.getElementById('generateButton').disabled = true;

    try {
      const preferences = {
        tone: document.getElementById('toneSelect').value,
        length: document.getElementById('lengthSelect').value
      };

      const response = await chrome.runtime.sendMessage({
        action: 'generateCoverLetter',
        jobDetails: this.jobDetails,
        resumeSource: 'uploadedFile',
        preferences: preferences
      });

      if (response.success) {
        this.generatedCoverLetter = response.coverLetter;
        this.showPreview(response.coverLetter);
        
        // Save cover letter to storage
        await chrome.runtime.sendMessage({ 
          action: 'saveCoverLetter', 
          coverLetter: response.coverLetter 
        });
        
        this.showMessage('Cover letter generated successfully!', 'success');
      } else {
        throw new Error(response.error || 'Failed to generate cover letter');
      }
    } catch (error) {
      console.error('Error generating cover letter:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
      document.getElementById('generateButton').disabled = false;
    }
  }

  async generateTailoredResume() {
    if (!this.resumeFileMeta) {
      this.showMessage('Upload your resume PDF before generating a tailored version', 'error');
      return;
    }
    if (!this.resumeFileMeta.hasExtractedText) {
      this.showMessage('Resume text unavailable. Re-upload a readable PDF.', 'error');
      return;
    }

    if (!this.jobDetails.title && !this.jobDetails.company) {
      this.showMessage('No job detected. Open a job description first.', 'error');
      return;
    }

    this.toggleResumeLoading(true);
    document.getElementById('downloadResumeButton').disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'generateTailoredResume',
        jobDetails: this.jobDetails
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to tailor resume');
      }

      console.log('[Resume] Received response from background script');
      console.log('[Resume] Response has resumeLatex:', !!response.result?.resumeLatex);
      console.log('[Resume] LaTeX preview (first 300 chars):',
        response.result?.resumeLatex?.substring(0, 300));

      this.generatedResume = {
        latex: response.result.resumeLatex,
        highlights: response.result.skillsHighlights || [],
        keywordGaps: response.result.keywordGaps || [],
        bulletSuggestions: response.result.addedBulletSuggestions || [],
        generatedAt: Date.now(),
        jobKey: this.getJobKey()
      };

      // Try to compile LaTeX to PDF using WASM
      console.log('[Resume] Attempting to compile LaTeX to PDF...');
      try {
        const pdfDataUrl = await this.compileLatex(this.generatedResume.latex);
        this.generatedResume.pdfDataUrl = pdfDataUrl;
        this.showResumePreview(pdfDataUrl, this.generatedResume);
        await this.persistTailoredResume(this.generatedResume);
        this.showMessage('Tailored resume generated! Preview ready.', 'success');
      } catch (compileError) {
        // Fallback: offer LaTeX download if compilation fails
        console.warn('[Resume] PDF compilation failed, offering LaTeX download:', compileError);
        this.showResumeInsights(this.generatedResume);
        this.showLatexDownloadOption(this.generatedResume.latex);
        await this.persistTailoredResume(this.generatedResume);
        this.showMessage('Resume generated! Compile LaTeX manually (PDF compilation failed).', 'warning');
      }
    } catch (error) {
      console.error('Error generating tailored resume:', error);
      this.showMessage(`Resume error: ${error.message}`, 'error');
    } finally {
      this.toggleResumeLoading(false);
    }
  }

  toggleResumeLoading(show) {
    const loader = document.getElementById('resumeLoading');
    const generateButton = document.getElementById('generateResumeButton');
    loader.style.display = show ? 'flex' : 'none';
    generateButton.disabled = show;
  }

  // Test compilation method removed - not needed with LaTeX.Online API

  async compileLatex(latexContent) {
    console.log('[LaTeX] Starting server-side compilation...');
    console.log('[LaTeX] Input length:', latexContent.length, 'characters');
    console.log('[LaTeX] First 200 chars:', latexContent.substring(0, 200));
    console.log('[LaTeX] Last 200 chars:', latexContent.substring(latexContent.length - 200));

    try {
      // Send to background script to handle the API call
      console.log('[LaTeX] Sending compilation request to background script...');

      const response = await chrome.runtime.sendMessage({
        action: 'compileLatex',
        latex: latexContent
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'LaTeX compilation failed');
      }

      console.log('[LaTeX] Compilation successful! PDF size:', response.pdfDataUrl.length, 'bytes');
      return response.pdfDataUrl;
    } catch (error) {
      console.error('[LaTeX] Compilation error:', error);
      throw new Error(`LaTeX compilation failed: ${error.message || 'Unknown error'}`);
    }
  }

  showResumePreview(pdfUrl, resumeData) {
    const frame = document.getElementById('resumePreviewFrame');
    frame.src = pdfUrl;
    document.getElementById('resumePreviewContainer').style.display = 'flex';
    document.getElementById('downloadResumeButton').disabled = false;
    this.updateResumeInsights(resumeData);
  }

  showLatexDownloadOption(latexContent) {
    const container = document.getElementById('resumePreviewContainer');
    if (container) {
      container.style.display = 'block';
      container.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h3>LaTeX Resume Generated</h3>
          <p>Compile this with Overleaf or your local LaTeX installation.</p>
          <button id="downloadLatexButton" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
            Download .tex File
          </button>
        </div>
      `;

      document.getElementById('downloadLatexButton').onclick = () => {
        const blob = new Blob([latexContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.getLatexFileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      };
    }
  }

  getLatexFileName() {
    const company = (this.jobDetails.company || 'company').replace(/\s+/g, '_');
    const title = (this.jobDetails.title || 'role').replace(/\s+/g, '_');
    return `AutoFiller_${company}_${title}_resume.tex`;
  }

  showResumeInsights(resumeData) {
    document.getElementById('resumePreviewContainer').style.display = 'block';
    this.updateResumeInsights(resumeData);
  }

  clearResumePreview() {
    const container = document.getElementById('resumePreviewContainer');
    if (container) {
      container.style.display = 'none';
    }
    document.getElementById('downloadResumeButton').disabled = true;
    this.generatedResume = null;
  }

  updateResumeInsights(resumeData = {}) {
    this.renderList(
      'skillsHighlightsList',
      resumeData.highlights,
      (item) => {
        const score = typeof item.matchScore === 'number' ? `${Math.round(item.matchScore)}%` : '';
        return {
          score,
          title: item.skill || 'Skill',
          detail: item.justification || ''
        };
      },
      'No highlights yet'
    );

    this.renderList(
      'keywordGapList',
      resumeData.keywordGaps,
      (item) => ({
        title: item.keyword || 'Keyword',
        detail: item.reason || ''
      }),
      'No missing keywords 🎉'
    );

    this.renderList(
      'bulletSuggestionsList',
      resumeData.bulletSuggestions,
      (item) => ({
        title: item.section ? `${item.section} suggestion` : 'Suggestion',
        detail: item.text || '',
        meta: item.reason || ''
      }),
      'Click generate to see ideas'
    );
  }

  renderList(elementId, items, buildItem, emptyText) {
    const list = document.getElementById(elementId);
    list.innerHTML = '';

    if (!items || items.length === 0) {
      list.classList.add('empty');
      const li = document.createElement('li');
      li.textContent = emptyText;
      list.appendChild(li);
      return;
    }

    list.classList.remove('empty');
    items.forEach((item) => {
      const data = buildItem(item);
      const li = document.createElement('li');
      if (data.score) {
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = data.score;
        li.appendChild(scoreSpan);
      }
      const title = document.createElement('span');
      title.className = 'item-title';
      title.textContent = data.title || '';
      li.appendChild(title);

      if (data.detail) {
        const detail = document.createElement('div');
        detail.className = 'item-detail';
        detail.textContent = data.detail;
        li.appendChild(detail);
      }

      if (data.meta) {
        const meta = document.createElement('div');
        meta.className = 'item-meta';
        meta.textContent = data.meta;
        li.appendChild(meta);
      }

      list.appendChild(li);
    });
  }

  downloadTailoredResume() {
    if (!this.generatedResume?.pdfDataUrl) {
      this.showMessage('No tailored resume to download', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = this.generatedResume.pdfDataUrl;
    link.download = this.getDownloadFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  getDownloadFileName() {
    const company = (this.jobDetails.company || 'company').replace(/\s+/g, '_');
    const title = (this.jobDetails.title || 'role').replace(/\s+/g, '_');
    return `AutoFiller_${company}_${title}_resume.pdf`;
  }

  showPreview(coverLetter) {
    document.getElementById('coverLetterPreview').value = coverLetter;
    document.getElementById('previewSection').style.display = 'block';
    
    // Scroll to preview
    document.getElementById('previewSection').scrollIntoView({ 
      behavior: 'smooth', 
      block: 'nearest' 
    });
  }

  enableEditing() {
    const preview = document.getElementById('coverLetterPreview');
    preview.readOnly = false;
    preview.focus();
    
    document.getElementById('editButton').textContent = '💾 Save Changes';
    document.getElementById('editButton').onclick = () => this.saveEdits();
  }

  async saveEdits() {
    const preview = document.getElementById('coverLetterPreview');
    this.generatedCoverLetter = preview.value;
    preview.readOnly = true;
    
    // Save edited cover letter to storage
    try {
      await chrome.runtime.sendMessage({ 
        action: 'saveCoverLetter', 
        coverLetter: this.generatedCoverLetter 
      });
    } catch (error) {
      console.error('Error saving edited cover letter:', error);
    }
    
    document.getElementById('editButton').textContent = '✏️ Edit';
    document.getElementById('editButton').onclick = () => this.enableEditing();
    
    this.showMessage('Changes saved!', 'success');
  }

  async fillCoverLetter() {
    if (!this.generatedCoverLetter) {
      this.showMessage('No cover letter to fill', 'error');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'fillCoverLetter',
        coverLetter: this.generatedCoverLetter
      });

      if (response.success) {
        this.showMessage('Cover letter filled successfully!', 'success');
      } else {
        throw new Error(response.error || 'Failed to fill cover letter');
      }
    } catch (error) {
      console.error('Error filling cover letter:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    }
  }

  async clearCoverLetter() {
    if (!this.generatedCoverLetter) {
      this.showMessage('No cover letter to clear', 'error');
      return;
    }

    // Confirm before clearing
    if (!confirm('Are you sure you want to clear the generated cover letter? This action cannot be undone.')) {
      return;
    }

    try {
      // Clear from storage
      await chrome.runtime.sendMessage({ action: 'clearCoverLetter' });
      
      // Clear from memory and UI
      this.generatedCoverLetter = '';
      document.getElementById('coverLetterPreview').value = '';
      document.getElementById('previewSection').style.display = 'none';
      
      this.showMessage('Cover letter cleared successfully!', 'success');
    } catch (error) {
      console.error('Error clearing cover letter:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    }
  }

  async persistTailoredResume(resumeData) {
    if (!resumeData?.pdfDataUrl) return;
    const payload = {
      jobKey: resumeData.jobKey || this.getJobKey(),
      company: this.jobDetails.company || '',
      title: this.jobDetails.title || '',
      generatedAt: resumeData.generatedAt || Date.now(),
      latex: resumeData.latex,
      pdfBase64: this.extractBase64(resumeData.pdfDataUrl),
      highlights: resumeData.highlights || [],
      keywordGaps: resumeData.keywordGaps || [],
      bulletSuggestions: resumeData.bulletSuggestions || []
    };

    try {
      await chrome.runtime.sendMessage({
        action: 'saveTailoredResume',
        resume: payload
      });
    } catch (error) {
      console.error('Failed to store tailored resume:', error);
    }
  }

  async loadStoredResumeForJob() {
    if (!this.currentJobKey) return;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getTailoredResume',
        jobKey: this.currentJobKey
      });
      if (response?.success && response.resume) {
        const dataUrl = this.buildDataUrl(response.resume.pdfBase64);
        this.generatedResume = {
          latex: response.resume.latex || '',
          highlights: response.resume.highlights || [],
          keywordGaps: response.resume.keywordGaps || [],
          bulletSuggestions: response.resume.bulletSuggestions || [],
          pdfDataUrl: dataUrl,
          jobKey: this.currentJobKey,
          generatedAt: response.resume.generatedAt
        };
        this.showResumePreview(dataUrl, this.generatedResume);
        this.showMessage('Loaded your last tailored resume for this job', 'info');
      }
    } catch (error) {
      console.error('Error loading stored resume:', error);
    }
  }

  extractBase64(dataUrl) {
    if (!dataUrl) return '';
    const parts = dataUrl.split(',');
    return parts.length > 1 ? parts[1] : '';
  }

  buildDataUrl(base64) {
    if (!base64) return '';
    return `data:application/pdf;base64,${base64}`;
  }


  showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
  }

  showMessage(message, type = 'info') {
    // Create temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 15px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      max-width: 300px;
      text-align: center;
      ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
      ${type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
      ${type === 'warning' ? 'background: #fff3cd; color: #856404; border: 1px solid #ffeeba;' : ''}
      ${type === 'info' ? 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
    `;
    messageDiv.textContent = message;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }

  shouldAttemptContentInjection(error) {
    const message = error?.message || '';
    return (
      message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist')
    );
  }

  async ensureContentScriptsInjected() {
    if (!this.currentTab?.id) {
      return false;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        files: ['config/config.js']
      });
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        files: ['content/content.js']
      });
      this.injectedTabs.add(this.currentTab.id);
      // Give the script a moment to register listeners
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (error) {
      console.error('Failed to inject content scripts:', error);
      this.showMessage('Allow AutoFiller to run on this site and reload the page.', 'error');
      return false;
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popup = new AutoFillerPopup();

  // Expose for debugging in console
  window.autofillerDebug = {
    popup,
    testCompile: async (latex) => {
      if (!latex) {
        latex = `\\documentclass{article}
\\begin{document}
Hello from LaTeX.Online API test!
\\end{document}`;
      }
      console.log('[Debug] Testing LaTeX.Online API compilation...');
      try {
        const result = await popup.compileLatex(latex);
        console.log('[Debug] ✅ Success! PDF URL length:', result.length);
        console.log('[Debug] PDF preview:', result.substring(0, 100) + '...');
        return result;
      } catch (error) {
        console.error('[Debug] ❌ Failed:', error);
        throw error;
      }
    },
    getStatus: () => ({
      compilationMethod: 'LaTeX.Online API (server-side)',
      apiEndpoint: 'https://latexonline.cc/compile',
      internetRequired: true
    })
  };

  console.log('[AutoFiller] Debug tools available via window.autofillerDebug');
  console.log('[AutoFiller] Try: autofillerDebug.testCompile() or autofillerDebug.getStatus()');
});
