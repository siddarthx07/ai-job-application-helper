// Popup script for AutoFiller Extension
// Handles UI interactions and communication with content/background scripts

class AutoFillerPopup {
  constructor() {
    this.jobDetails = {};
    this.currentTab = null;
    this.generatedCoverLetter = '';
    this.init();
  }

  async init() {
    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tabs[0];

    // Initialize UI
    this.setupEventListeners();
    await this.loadSavedData();
    await this.checkPageStatus();
    this.checkApiConfiguration();
  }

  setupEventListeners() {
    // Resume management
    document.getElementById('saveResume').addEventListener('click', () => this.saveResume());
    document.getElementById('resumeText').addEventListener('input', () => this.onResumeChange());

    // Job details
    document.getElementById('refreshJobDetails').addEventListener('click', () => this.refreshJobDetails());

    // Preferences
    document.getElementById('toneSelect').addEventListener('change', () => this.savePreferences());
    document.getElementById('lengthSelect').addEventListener('change', () => this.savePreferences());

    // Main actions
    document.getElementById('generateButton').addEventListener('click', () => this.generateCoverLetter());
    document.getElementById('downloadButton').addEventListener('click', () => this.downloadCoverLetter());

    // Preview actions
    document.getElementById('editButton').addEventListener('click', () => this.enableEditing());
    document.getElementById('fillButton').addEventListener('click', () => this.fillCoverLetter());
    document.getElementById('downloadFinalButton').addEventListener('click', () => this.downloadCoverLetter());
  }

  async loadSavedData() {
    try {
      // Load saved resume
      const resumeResponse = await chrome.runtime.sendMessage({ action: 'getResume' });
      if (resumeResponse.success && resumeResponse.resume) {
        document.getElementById('resumeText').value = resumeResponse.resume;
      }

      // Load saved preferences
      const prefResponse = await chrome.runtime.sendMessage({ action: 'getPreferences' });
      if (prefResponse.success && prefResponse.preferences) {
        const prefs = prefResponse.preferences;
        document.getElementById('toneSelect').value = prefs.tone || 'professional';
        document.getElementById('lengthSelect').value = prefs.length || 'medium';
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }

  async checkPageStatus() {
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
        this.jobDetails = response.jobDetails;
        this.updateJobDetailsUI(response.jobDetails, response.hasCoverLetterField);
        this.updateStatus('active', `Ready (${siteName})`);
      } else {
        this.updateStatus('error', 'Page not ready');
      }
    } catch (error) {
      console.error('Error checking page status:', error);
      this.updateStatus('error', 'Connection failed');
    }
  }

  isSupportedPage() {
    const url = this.currentTab?.url || '';
    return url.includes('glassdoor.com') || url.includes('greenhouse.io');
  }

  getSiteName() {
    const url = this.currentTab?.url || '';
    if (url.includes('glassdoor.com')) return 'Glassdoor';
    if (url.includes('greenhouse.io')) return 'Greenhouse';
    return 'Unknown';
  }

  showPageWarning() {
    this.updateStatus('error', 'Unsupported site');
    document.getElementById('jobInfo').innerHTML = `
      <div style="text-align: center; color: #dc3545; padding: 20px;">
        <p><strong>⚠️ Please navigate to a supported job page</strong></p>
        <p style="font-size: 12px; margin-top: 8px;">
          This extension works on Glassdoor and Greenhouse job application pages.
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
      statusElement.textContent = '📥 Not found (Download)';
      statusElement.className = 'text-warning';
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

  async saveResume() {
    const resumeText = document.getElementById('resumeText').value.trim();
    if (!resumeText) {
      this.showMessage('Please enter your resume text', 'error');
      return;
    }

    try {
      await chrome.runtime.sendMessage({ 
        action: 'saveResume', 
        resume: resumeText 
      });
      
      document.getElementById('resumeSaveStatus').textContent = '✅ Saved';
      setTimeout(() => {
        document.getElementById('resumeSaveStatus').textContent = '';
      }, 2000);
    } catch (error) {
      console.error('Error saving resume:', error);
      this.showMessage('Failed to save resume', 'error');
    }
  }

  onResumeChange() {
    document.getElementById('resumeSaveStatus').textContent = '';
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
    const resumeText = document.getElementById('resumeText').value.trim();
    if (!resumeText) {
      this.showMessage('Please enter your resume text first', 'error');
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
        resumeText: resumeText,
        preferences: preferences
      });

      if (response.success) {
        this.generatedCoverLetter = response.coverLetter;
        this.showPreview(response.coverLetter);
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

  saveEdits() {
    const preview = document.getElementById('coverLetterPreview');
    this.generatedCoverLetter = preview.value;
    preview.readOnly = true;
    
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
        if (response.action === 'filled') {
          this.showMessage('Cover letter filled successfully!', 'success');
        } else if (response.action === 'downloaded') {
          this.showMessage('Cover letter downloaded to your computer!', 'success');
        }
      } else {
        throw new Error(response.error || 'Failed to fill cover letter');
      }
    } catch (error) {
      console.error('Error filling cover letter:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    }
  }

  async downloadCoverLetter() {
    if (!this.generatedCoverLetter) {
      this.showMessage('No cover letter to download', 'error');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'downloadPDF',
        content: this.generatedCoverLetter,
        filename: `cover-letter-${this.jobDetails.company || 'job'}-${Date.now()}.html`
      });
      
      this.showMessage('Cover letter downloaded!', 'success');
    } catch (error) {
      console.error('Error downloading cover letter:', error);
      this.showMessage('Failed to download cover letter', 'error');
    }
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
      ${type === 'info' ? 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;' : ''}
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AutoFillerPopup();
});
