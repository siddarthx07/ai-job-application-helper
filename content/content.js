

class JobSiteAutofiller {
  constructor() {
    this.jobDetails = {};
    this.coverLetterField = null;
    this.isProcessing = false;
    this.currentSite = this.detectSite();
    this.init();
  }

  detectSite() {
    const hostname = window.location.hostname;
    if (hostname.includes('glassdoor.com')) {
      return 'glassdoor';
    } else if (hostname.includes('greenhouse.io')) {
      return 'greenhouse';
    }
    return 'unknown';
  }

  init() {
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    try {
      console.log(`🤖 AutoFiller initializing on ${this.currentSite} site`);
      
      // Add visual indicator when extension is active
      this.addExtensionIndicator();
      
      // Extract job details
      this.extractJobDetails();
      
      // Find cover letter field
      this.findCoverLetterField();
      
      console.log('✅ AutoFiller setup complete:', {
        site: this.currentSite,
        jobDetails: this.jobDetails,
        hasCoverLetterField: !!this.coverLetterField
      });
      
      // Listen for messages from popup
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          if (request.action === 'fillCoverLetter') {
            this.handleFillRequest(request, sendResponse);
            return true; // Keep message channel open
          }
          
          if (request.action === 'getJobDetails') {
            sendResponse({ 
              success: true, 
              jobDetails: this.jobDetails,
              hasCoverLetterField: !!this.coverLetterField,
              site: this.currentSite
            });
          }
        } catch (error) {
          console.error('❌ Error handling message:', error);
          sendResponse({ 
            success: false, 
            error: error.message 
          });
        }
      });
    } catch (error) {
      console.error('❌ Error in AutoFiller setup:', error);
    }
  }

  addExtensionIndicator() {
    // Add a small indicator to show extension is active
    const indicator = document.createElement('div');
    indicator.id = 'autofiller-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: #4CAF50;
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
      ">
        🤖 AutoFiller Active
      </div>
    `;
    document.body.appendChild(indicator);
    
    // Remove indicator after 3 seconds
    setTimeout(() => {
      const elem = document.getElementById('autofiller-indicator');
      if (elem) elem.remove();
    }, 3000);
  }

  extractJobDetails() {
    // Get selectors based on current site
    let selectors;
    try {
      if (this.currentSite === 'greenhouse') {
        selectors = (typeof CONFIG !== 'undefined' && CONFIG.GREENHOUSE_SELECTORS) 
          ? CONFIG.GREENHOUSE_SELECTORS 
          : this.getDefaultGreenhouseSelectors();
      } else {
        selectors = (typeof CONFIG !== 'undefined' && CONFIG.GLASSDOOR_SELECTORS) 
          ? CONFIG.GLASSDOOR_SELECTORS 
          : this.getDefaultGlassdoorSelectors();
      }
    } catch (error) {
      console.error('Error accessing CONFIG:', error);
      selectors = this.currentSite === 'greenhouse' 
        ? this.getDefaultGreenhouseSelectors() 
        : this.getDefaultGlassdoorSelectors();
    }

    // Extract job details using site-specific selectors
    this.jobDetails.title = this.extractTextFromSelectors(selectors.jobTitle);
    this.jobDetails.company = this.extractTextFromSelectors(selectors.companyName);
    this.jobDetails.description = this.extractTextFromSelectors(selectors.jobDescription);
    
    // Site-specific fallbacks
    if (this.currentSite === 'greenhouse') {
      this.extractGreenhouseFallbacks();
    } else {
      this.extractGlassdoorFallbacks();
    }

    console.log(`Extracted job details from ${this.currentSite}:`, this.jobDetails);
  }

  getDefaultGlassdoorSelectors() {
    return {
      jobTitle: [
        '[data-test="job-title"]',
        '.jobTitle',
        'h1[data-test="job-title"]',
        '.css-17x2pwl',
        '[class*="JobDetails_jobTitle"]',
        'h1'
      ],
      companyName: [
        '[data-test="employer-name"]',
        '.employerName',
        '[class*="EmployerProfile_employerName"]',
        'a[data-test="employer-name"]',
        '[data-test="employer-name"] span'
      ],
      jobDescription: [
        '[data-test="job-description"]',
        '.jobDescriptionContent',
        '[class*="JobDetails_jobDescription"]',
        '.desc',
        '[class*="jobDescription"]'
      ]
    };
  }

  getDefaultGreenhouseSelectors() {
    return {
      jobTitle: [
        'h1[data-qa="job-name"]',
        '.job-name',
        'h1.job-title',
        '[data-qa="job-name"]',
        '.header-job-title',
        'h1[class*="job"]',
        '.job-post-title'
      ],
      companyName: [
        '[data-qa="company-name"]',
        '.company-name',
        'a[data-qa="company-name"]',
        '.header-company-name',
        '[class*="company-name"]',
        '.job-company'
      ],
      jobDescription: [
        '[data-qa="job-description"]',
        '.job-description',
        '.job-post-description',
        '[class*="job-description"]',
        '.description-content',
        '.job-details'
      ]
    };
  }

  getDefaultGlassdoorCoverLetterSelectors() {
    return [
      'textarea[name="coverLetter"]',
      'textarea[placeholder*="cover letter"]',
      'textarea[placeholder*="Cover Letter"]',
      'textarea[id*="coverLetter"]',
      'textarea[class*="coverLetter"]',
      'textarea[data-test*="cover"]',
      'textarea[aria-label*="cover"]',
      'textarea[aria-label*="Cover"]'
    ];
  }

  getDefaultGreenhouseCoverLetterSelectors() {
    return [
      'textarea[name="cover_letter"]',
      'textarea[id*="cover_letter"]',
      'textarea[placeholder*="cover letter"]',
      'textarea[placeholder*="Cover Letter"]',
      'textarea[aria-label*="cover letter"]',
      'textarea[aria-label*="Cover Letter"]',
      'textarea[data-qa*="cover-letter"]',
      'textarea[class*="cover-letter"]',
      'textarea[name*="additional_information"]',
      'textarea[placeholder*="Why are you interested"]',
      'textarea[placeholder*="Tell us about yourself"]',
      'textarea[placeholder*="additional information"]',
      // Specific to Greenhouse "Enter manually" sections
      'textarea[data-provides="typeahead"]',
      'div[data-provides="typeahead"] textarea'
    ];
  }

  extractGlassdoorFallbacks() {
    // Fallback: try to get from page title or URL
    if (!this.jobDetails.title) {
      const titleMatch = document.title.match(/(.+?)\s*-\s*(.+?)\s*-\s*Glassdoor/);
      if (titleMatch) {
        this.jobDetails.title = titleMatch[1].trim();
        if (!this.jobDetails.company) {
          this.jobDetails.company = titleMatch[2].trim();
        }
      }
    }
  }

  extractGreenhouseFallbacks() {
    // Primary method: Parse title tag for job title and company
    // Format: "Job Application for [JOB TITLE] at [COMPANY]"
    const pageTitle = document.title;
    console.log('Page title:', pageTitle);
    
    // Pattern for "Job Application for X at Y"
    const jobAppPattern = /Job Application for (.+?) at (.+?)$/;
    const jobAppMatch = pageTitle.match(jobAppPattern);
    
    console.log('🔍 Parsing page title:', pageTitle);
    console.log('🔍 Regex match result:', jobAppMatch);
    
    if (jobAppMatch) {
      // Always override with parsed values for Greenhouse
      this.jobDetails.title = jobAppMatch[1].trim();
      this.jobDetails.company = jobAppMatch[2].trim();
      console.log('✅ Extracted job title from page title:', this.jobDetails.title);
      console.log('✅ Extracted company from page title:', this.jobDetails.company);
    } else {
      // If parsing fails, try to extract from URL path
      const urlPath = window.location.pathname;
      console.log('URL path:', urlPath);
      
      // Extract company from URL like /company-name/jobs/123456
      const urlMatch = urlPath.match(/\/([^\/]+)\/jobs\//);
      if (urlMatch && !this.jobDetails.company) {
        this.jobDetails.company = urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        console.log('Extracted company from URL path:', this.jobDetails.company);
      }
    }
    
    // Fallback: try other title patterns if still no data
    if (!this.jobDetails.title || !this.jobDetails.company) {
      const titlePatterns = [
        /^(.+?)\s*-\s*(.+?)(?:\s*-\s*Greenhouse)?$/,
        /^(.+?)\s*\|\s*(.+?)$/,
        /^(.+?)\s*at\s*(.+?)$/
      ];
      
      for (const pattern of titlePatterns) {
        const titleMatch = pageTitle.match(pattern);
        if (titleMatch) {
          if (!this.jobDetails.title) {
            this.jobDetails.title = titleMatch[1].trim();
          }
          if (!this.jobDetails.company && titleMatch[2]) {
            this.jobDetails.company = titleMatch[2].trim();
          }
          break;
        }
      }
    }
    
    // Fallback: Extract company from URL path for job-boards.greenhouse.io
    if (!this.jobDetails.company && window.location.hostname === 'job-boards.greenhouse.io') {
      const pathMatch = window.location.pathname.match(/\/([^\/]+)\/jobs/);
      if (pathMatch) {
        let companyName = pathMatch[1];
        companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
        this.jobDetails.company = companyName;
        console.log('Extracted company from URL path:', this.jobDetails.company);
      }
    }
    
    // Additional fallback: subdomain extraction
    if (!this.jobDetails.company) {
      const urlMatch = window.location.hostname.match(/([^.]+)\.greenhouse\.io/);
      if (urlMatch && urlMatch[1] !== 'job-boards') {
        let companyName = urlMatch[1];
        companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
        this.jobDetails.company = companyName;
      }
    }
  }

  extractTextFromSelectors(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        let text = element.textContent?.trim();
        if (text && text.length > 0) {
          // Clean up common text artifacts
          text = text.replace(/\s+/g, ' '); // Normalize whitespace
          text = text.replace(/^\s*-\s*/, ''); // Remove leading dash
          text = text.replace(/\s*-\s*$/, ''); // Remove trailing dash
          
          // For job titles, ensure we get the full text
          if (selector === 'h1' || selector.includes('h1')) {
            console.log(`Found job title with selector "${selector}": "${text}"`);
          }
          
          return text;
        }
      }
    }
    return '';
  }

  findCoverLetterField() {
    console.log('🔍 Starting cover letter field detection...');
    console.log('Current site:', this.currentSite);
    
    // Get cover letter selectors based on current site
    let selectors;
    try {
      if (this.currentSite === 'greenhouse') {
        selectors = (typeof CONFIG !== 'undefined' && CONFIG.GREENHOUSE_SELECTORS?.coverLetterTextarea) 
          ? CONFIG.GREENHOUSE_SELECTORS.coverLetterTextarea 
          : this.getDefaultGreenhouseCoverLetterSelectors();
        console.log('Using Greenhouse selectors:', selectors.length, 'selectors');
      } else {
        selectors = (typeof CONFIG !== 'undefined' && CONFIG.GLASSDOOR_SELECTORS?.coverLetterTextarea) 
          ? CONFIG.GLASSDOOR_SELECTORS.coverLetterTextarea 
          : this.getDefaultGlassdoorCoverLetterSelectors();
        console.log('Using Glassdoor selectors:', selectors.length, 'selectors');
      }
    } catch (error) {
      console.error('Error accessing cover letter selectors:', error);
      selectors = this.currentSite === 'greenhouse' 
        ? this.getDefaultGreenhouseCoverLetterSelectors() 
        : this.getDefaultGlassdoorCoverLetterSelectors();
    }

    console.log('Testing selectors:', selectors);

    for (const selector of selectors) {
      console.log('Testing selector:', selector);
      const field = document.querySelector(selector);
      if (field) {
        console.log('✅ Found element with selector:', selector, field);
        // Special handling for "Enter manually" button
        if (field.tagName === 'BUTTON' && field.textContent?.includes('Enter manually')) {
          console.log('🎯 Found "Enter manually" button for cover letter');
          this.coverLetterField = field;
          this.highlightCoverLetterField(field);
          return;
        }
        // Regular textarea handling
        else if (field.tagName === 'TEXTAREA') {
          this.coverLetterField = field;
          this.highlightCoverLetterField(field);
          console.log('🎯 Found cover letter textarea:', selector);
          return;
        }
        else {
          console.log('Found element but wrong type:', field.tagName, field.textContent?.substring(0, 50));
        }
      } else {
        console.log('❌ No element found for selector:', selector);
      }
    }

    // Fallback: look for any textarea that might be a cover letter field
    const textareas = document.querySelectorAll('textarea');
    for (const textarea of textareas) {
      const placeholder = textarea.placeholder?.toLowerCase() || '';
      const name = textarea.name?.toLowerCase() || '';
      const id = textarea.id?.toLowerCase() || '';
      const ariaLabel = textarea.getAttribute('aria-label')?.toLowerCase() || '';
      
      if (placeholder.includes('cover') || 
          name.includes('cover') || 
          id.includes('cover') ||
          ariaLabel.includes('cover') ||
          placeholder.includes('letter') ||
          placeholder.includes('message') ||
          placeholder.includes('why')) {
        this.coverLetterField = textarea;
        this.highlightCoverLetterField(textarea);
        console.log('Found potential cover letter field via fallback');
        return;
      }
    }

    console.log('No cover letter field found');
  }

  highlightCoverLetterField(field) {
    // Add subtle highlight to indicate the field was detected
    field.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';
    field.style.border = '2px solid rgba(76, 175, 80, 0.3)';
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      field.style.boxShadow = '';
      field.style.border = '';
    }, 2000);
  }

  async handleFillRequest(request, sendResponse) {
    if (this.isProcessing) {
      sendResponse({ success: false, error: 'Already processing a request' });
      return;
    }

    this.isProcessing = true;

    try {
      console.log('🔍 Checking cover letter field detection...');
      console.log('Current site:', this.currentSite);
      console.log('Cover letter field found:', !!this.coverLetterField);
      
      if (this.coverLetterField) {
        console.log('Cover letter field type:', this.coverLetterField.tagName);
        console.log('Cover letter field details:', {
          id: this.coverLetterField.id,
          className: this.coverLetterField.className,
          textContent: this.coverLetterField.textContent?.substring(0, 50)
        });
      }
      
      // Try to re-detect cover letter field if not found
      if (!this.coverLetterField) {
        console.log('🔄 Re-attempting to find cover letter field...');
        this.findCoverLetterField();
      }
      
      if (this.coverLetterField) {
        // Auto-fill scenario
        console.log('✅ Using auto-fill mode');
        await this.fillCoverLetter(request.coverLetter);
        sendResponse({ success: true, action: 'filled' });
      } else {
        // Download scenario
        console.log('📥 Using download mode (no cover letter field found)');
        await this.downloadCoverLetter(request.coverLetter);
        sendResponse({ success: true, action: 'downloaded' });
      }
    } catch (error) {
      console.error('Error handling fill request:', error);
      sendResponse({ success: false, error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  async fillCoverLetter(coverLetterText) {
    if (!this.coverLetterField) {
      throw new Error('No cover letter field found');
    }

    // Handle "Enter manually" button
    if (this.coverLetterField.tagName === 'BUTTON' && 
        this.coverLetterField.textContent?.includes('Enter manually')) {
      console.log('Clicking "Enter manually" button...');
      console.log('Button element:', this.coverLetterField);
      console.log('Button disabled?', this.coverLetterField.disabled);
      
      // Ensure button is in view
      try {
        this.coverLetterField.scrollIntoView({ block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for scroll
      } catch (_) {}

      // Use the reliable data-testid approach (Method 5 - the one that works!)
      console.log('Clicking "Enter manually" button using data-testid...');
      try {
        // Find the button using the most reliable selector
        const buttonByTestId = document.querySelector('button[data-testid="cover_letter-text"]');
        if (buttonByTestId) {
          console.log('Found button by data-testid, clicking...');
          
          // Try multiple click approaches on the fresh element
          buttonByTestId.click();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          buttonByTestId.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Try focus and click
          buttonByTestId.focus();
          buttonByTestId.click();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('Button click completed successfully');
        } else {
          console.log('Button not found by data-testid');
          throw new Error('Could not find "Enter manually" button');
        }
      } catch (e) {
        console.log('Button click failed:', e);
        throw new Error('Failed to click "Enter manually" button');
      }

      // Wait for textarea to appear after clicking and get it
      console.log('⏳ Waiting for textarea to appear after clicking button...');
      const textarea = await this.waitForTextarea(15000); // Increased timeout to 15 seconds
      if (textarea) {
        this.coverLetterField = textarea;
        console.log('✅ Found textarea after clicking Enter manually:', textarea.id || textarea.name || textarea.className);
      } else {
        throw new Error('No textarea appeared after clicking "Enter manually"');
      }
    }

    if (this.coverLetterField.tagName === 'TEXTAREA') {
      // Focus the textarea before typing
      this.coverLetterField.focus();

      // Insert text
      await this.typeText(this.coverLetterField, coverLetterText);

      // Trigger change events
      this.coverLetterField.dispatchEvent(new Event('input', { bubbles: true }));
      this.coverLetterField.dispatchEvent(new Event('change', { bubbles: true }));

      // Visual feedback
      this.showSuccessMessage('Cover letter filled successfully!');
    } else {
      throw new Error('Cover letter field is not a textarea');
    }
  }

  async waitForTextarea(maxWait = 3000) {
    console.log(`🔍 Starting textarea detection with ${maxWait}ms timeout...`);
    const selectors = [
      'textarea#cover_letter_text',
      'textarea[name="cover_letter"]',
      'textarea[id*="cover_letter"]',
      'textarea[aria-describedby*="cover_letter"]'
    ];

    console.log('🎯 Testing selectors:', selectors);

    const queryForTextarea = () => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          console.log(`✅ Found textarea with selector: ${sel}`, {
            id: el.id,
            name: el.name,
            className: el.className,
            placeholder: el.placeholder,
            ariaLabel: el.getAttribute('aria-label'),
            visible: el.offsetParent !== null,
            display: window.getComputedStyle(el).display
          });
          return el;
        } else {
          console.log(`❌ No element found for selector: ${sel}`);
        }
      }
      return null;
    };

    // Immediate check
    console.log('🔍 Immediate check for textarea...');
    let found = queryForTextarea();
    if (found) {
      console.log('✅ Found textarea (immediate):', found.id || found.name || found.className);
      return found;
    }

    // Debug: Check if any textareas exist on the page
    const allTextareas = document.querySelectorAll('textarea');
    console.log(`🔍 Found ${allTextareas.length} textareas on page:`, 
      Array.from(allTextareas).map(t => ({
        id: t.id,
        name: t.name,
        className: t.className,
        visible: t.offsetParent !== null,
        display: window.getComputedStyle(t).display,
        placeholder: t.placeholder,
        parentElement: t.parentElement?.className,
        value: t.value ? t.value.substring(0, 50) + '...' : ''
      }))
    );

    // If we found textareas, check if any might be the cover letter field
    if (allTextareas.length > 0) {
      console.log('🔍 Checking existing textareas for cover letter field...');
      for (const textarea of allTextareas) {
        const isCoverLetter = textarea.id === 'cover_letter_text' || 
                             textarea.name === 'cover_letter' ||
                             textarea.id?.includes('cover_letter') ||
                             textarea.name?.includes('cover_letter') ||
                             textarea.className?.includes('cover') ||
                             textarea.parentElement?.className?.includes('cover') ||
                             textarea.parentElement?.className?.includes('file-upload');
        
        if (isCoverLetter) {
          console.log('✅ Found potential cover letter textarea:', {
            id: textarea.id,
            name: textarea.name,
            className: textarea.className,
            parentClass: textarea.parentElement?.className,
            visible: textarea.offsetParent !== null
          });
          return textarea;
        }
      }
    }

    // Observe DOM mutations for faster detection
    const start = Date.now();
    console.log('🔍 Setting up MutationObserver and polling...');
    return await new Promise((resolve, reject) => {
      let checkCount = 0;
      
      const observer = new MutationObserver((mutations) => {
        checkCount++;
        console.log(`🔍 MutationObserver check #${checkCount}, mutations: ${mutations.length}`);
        const el = queryForTextarea();
        if (el) {
          observer.disconnect();
          console.log('✅ Found textarea via MutationObserver:', el.id || el.name || el.className);
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Poll as a backup (handles attribute changes)
      const interval = setInterval(() => {
        checkCount++;
        const elapsed = Date.now() - start;
        console.log(`🔍 Polling check #${checkCount}, elapsed: ${elapsed}ms`);
        
        const el = queryForTextarea();
        if (el) {
          clearInterval(interval);
          observer.disconnect();
          console.log('✅ Found textarea via polling:', el.id || el.name || el.className);
          resolve(el);
        }
        
        if (elapsed >= maxWait) {
          clearInterval(interval);
          observer.disconnect();
          console.log(`❌ Timeout reached after ${elapsed}ms`);
          reject(new Error(`Textarea did not appear within ${maxWait}ms timeout`));
        }
      }, 200); // Increased polling interval to 200ms
    });
  }

  async typeText(element, text) {
    // Set the value directly (faster for long text)
    element.value = text;
    
    // For React/modern frameworks, also set the internal value
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ).set;
    nativeInputValueSetter.call(element, text);

    // Trigger React-style events
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async downloadCoverLetter(coverLetterText) {
    // Send message to background script to handle download
    chrome.runtime.sendMessage({
      action: 'downloadPDF',
      content: coverLetterText,
      filename: `cover-letter-${this.jobDetails.company || 'job'}-${Date.now()}.html`
    });

    this.showSuccessMessage('Cover letter downloaded! Check your downloads folder.');
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #4CAF50;
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        font-size: 16px;
        font-weight: bold;
        z-index: 10001;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        text-align: center;
      ">
        ✅ ${message}
      </div>
    `;
    document.body.appendChild(successDiv);

    // Remove after 3 seconds
    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }
}

// Initialize when script loads
const autofiller = new JobSiteAutofiller();
