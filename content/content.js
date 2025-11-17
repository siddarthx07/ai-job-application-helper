

class JobSiteAutofiller {
  constructor() {
    this.jobDetails = {};
    this.coverLetterField = null;
    this.isProcessing = false;
    this.currentSite = this.detectSite();
    this.coverLetterObserver = null;
    this.jobDetailObserver = null;
    this.jobDetailObserverTimeout = null;
    this.jobDetailObserverPending = false;
    this.init();
  }

  detectSite() {
    const hostname = (window.location.hostname || '').toLowerCase();
    if (hostname.includes('greenhouse.io')) {
      return 'greenhouse';
    }
    if (hostname.includes('lever.co')) {
      return 'lever';
    }
    if (hostname.includes('workday') || hostname.includes('myworkdayjobs')) {
      return 'workday';
    }
    return 'generic';
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
      if (!this.hasBasicJobDetails()) {
        this.startJobDetailObserver();
      }
      
      // Find cover letter field
      this.coverLetterField = this.findCoverLetterField();
      if (!this.coverLetterField) {
        this.startCoverLetterObserver();
      }
      
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
    const structuredData = this.extractJobDetailsFromStructuredData();
    if (structuredData) {
      this.jobDetails = structuredData;
      console.log('Extracted job details from structured data:', this.jobDetails);
      return;
    }

    const openGraphData = this.extractJobDetailsFromOpenGraph();
    if (openGraphData) {
      this.jobDetails = openGraphData;
      console.log('Extracted job details from Open Graph metadata:', this.jobDetails);
      return;
    }

    this.jobDetails = this.extractJobDetailsFromDom();

    switch (this.currentSite) {
      case 'greenhouse':
        this.applyGreenhouseFallbacks();
        break;
      case 'workday':
        this.applyWorkdayFallbacks();
        break;
      case 'lever':
        this.applyLeverFallbacks();
        break;
      default:
        break;
    }

    console.log(`Extracted job details from ${this.currentSite}:`, this.jobDetails);
  }

  hasBasicJobDetails() {
    const { title, company } = this.jobDetails || {};
    return Boolean(title && company && title.length > 1 && company.length > 1);
  }

  extractJobDetailsFromStructuredData() {
    try {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        const jsonText = script.textContent?.trim();
        if (!jsonText) continue;
        let data;
        try {
          data = JSON.parse(jsonText);
        } catch (error) {
          continue;
        }
        const entries = Array.isArray(data) ? data : [data];
        for (const entry of entries) {
          if (!this.isJobPostingEntry(entry)) continue;
          const descriptionText = this.sanitizeHtmlText(entry.description || entry.responsibilities || '');
          return {
            title: entry.title || entry.name || '',
            company: entry.hiringOrganization?.name || entry.hiringOrganization?.company || entry.organization?.name || '',
            description: this.normalizeText(descriptionText).slice(0, 6000),
            detectionMeta: { source: 'structured-data' }
          };
        }
      }
    } catch (error) {
      console.warn('Structured data extraction failed:', error);
    }
    return null;
  }

  extractJobDetailsFromOpenGraph() {
    try {
      const ogTitle = this.getMetaContent([
        'meta[property="og:title"]',
        'meta[name="og:title"]',
        'meta[property="twitter:title"]',
        'meta[name="twitter:title"]'
      ]);
      if (!ogTitle) return null;

      const ogDescription = this.getMetaContent([
        'meta[property="og:description"]',
        'meta[name="og:description"]',
        'meta[property="twitter:description"]',
        'meta[name="twitter:description"]'
      ]);

      const { title, company } = this.parseOgTitle(ogTitle);
      if (!title) return null;

      return {
        title,
        company: company || this.deriveCompanyFromHostname() || '',
        description: this.normalizeText(ogDescription || '').slice(0, 3000),
        detectionMeta: { source: 'open-graph' }
      };
    } catch (error) {
      console.warn('Open Graph extraction failed:', error);
      return null;
    }
  }

  parseOgTitle(ogTitle = '') {
    const separators = [' - ', ' – ', ' — ', ' | ', ' · '];
    let title = this.normalizeText(ogTitle) || '';
    let company = '';

    for (const separator of separators) {
      if (!title.includes(separator)) continue;
      const [left, right] = title.split(separator).map(part => this.normalizeText(part));
      if (!left || !right) continue;
      if (!company && !this.isGenericCompanyName(right)) {
        title = left;
        company = right;
        break;
      }
    }

    if (!company) {
      const atPattern = title.match(/(.+?)\s+at\s+(.+)/i);
      if (atPattern) {
        title = this.normalizeText(atPattern[1]);
        company = this.normalizeText(atPattern[2]);
      }
    }

    if (company && this.isGenericCompanyName(company)) {
      company = '';
    }

    return { title, company };
  }

  isJobPostingEntry(entry) {
    if (!entry) return false;
    const type = entry['@type'];
    if (!type) return false;
    const normalizedTypes = Array.isArray(type) ? type : [type];
    return normalizedTypes.some(value => typeof value === 'string' && value.toLowerCase() === 'jobposting');
  }

  extractJobDetailsFromDom() {
    const titleCandidate = this.detectJobTitleFromDom();
    const company = this.detectCompanyNameFromDom(titleCandidate?.text || '');
    const description = this.detectJobDescriptionFromDom();
    return {
      title: titleCandidate?.text || '',
      company,
      description,
      detectionMeta: {
        source: 'dom-heuristics',
        titleScore: titleCandidate?.score || 0
      }
    };
  }

  detectJobTitleFromDom() {
    const selectors = [
      'h1',
      'h2',
      '[role="heading"]',
      '[data-testid*="title"]',
      '[data-test*="title"]',
      '[class*="job-title"]',
      '[class*="posting-title"]',
      '[class*="position-title"]',
      '[itemprop="title"]'
    ];

    const candidates = [];
    const seen = new Set();

    selectors.forEach((selector, selectorIndex) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, elementIndex) => {
        if (!this.isElementVisible(element)) return;
        const text = this.normalizeText(element.textContent || '');
        if (!text || text.length < 3 || text.length > 120) return;
        const key = `${selector}|${text}`;
        if (seen.has(key)) return;
        seen.add(key);
        const score = this.scoreTitleCandidate(text, element.tagName, elementIndex + selectorIndex);
        if (score > 0) {
          candidates.push({ element, text, score, source: selector });
        }
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  scoreTitleCandidate(text, tagName = '', order = 0) {
    let score = 0;
    const normalizedTag = (tagName || '').toLowerCase();
    if (normalizedTag === 'h1') score += 5;
    else if (normalizedTag === 'h2') score += 3;
    else score += 1;

    const wordCount = text.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 12) score += 3;
    else if (wordCount > 16) score -= 2;

    const jobKeywords = ['engineer', 'developer', 'manager', 'designer', 'scientist', 'specialist', 'analyst', 'consultant', 'lead', 'architect', 'director', 'intern', 'associate'];
    if (jobKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(text))) {
      score += 2;
    }

    const negativeKeywords = ['career', 'company', 'team', 'benefits', 'culture', 'values', 'jobs', 'careers', 'about'];
    if (negativeKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      score -= 3;
    }

    if (order === 0) score += 1;
    return score;
  }

  detectCompanyNameFromDom(titleText = '') {
    const metaCandidate = this.getMetaContent([
      'meta[property="og:site_name"]',
      'meta[name="og:site_name"]',
      'meta[name="application-name"]'
    ]);
    if (metaCandidate && !this.isGenericCompanyName(metaCandidate)) {
      return metaCandidate;
    }

    const parsedFromTitle = this.parseCompanyFromTitleTag(document.title || '', titleText);
    if (parsedFromTitle) {
      return parsedFromTitle;
    }

    const dataAttrCandidate = document.querySelector('[data-company-name], [data-company], [itemprop="hiringOrganization"]');
    if (dataAttrCandidate) {
      const attrText = dataAttrCandidate.getAttribute('data-company-name') || 
                      dataAttrCandidate.getAttribute('data-company') ||
                      this.normalizeText(dataAttrCandidate.textContent || '');
      if (attrText && attrText.length < 120 && !this.isGenericCompanyName(attrText)) {
        return attrText;
      }
    }

    const labeledCompany = this.findLabeledValue(/company|employer|organization/i);
    if (labeledCompany) {
      return labeledCompany;
    }

    const pathCandidate = this.extractCompanyFromPath();
    if (pathCandidate) {
      return pathCandidate;
    }

    const hostnameCandidate = this.deriveCompanyFromHostname();
    if (hostnameCandidate && !this.isGenericCompanyName(hostnameCandidate)) {
      return hostnameCandidate;
    }

    return '';
  }

  parseCompanyFromTitleTag(pageTitle = '', fallbackTitle = '') {
    if (!pageTitle) return '';
    const separators = [' - ', ' – ', ' — ', ' · ', ' | '];
    for (const separator of separators) {
      if (pageTitle.includes(separator)) {
        const [leftPart, rightPart] = pageTitle.split(separator);
        const cleanedRight = this.normalizeText(rightPart);
        if (cleanedRight && cleanedRight.length < 140 && !this.isGenericCompanyName(cleanedRight)) {
          const cleanedLeft = this.normalizeText(leftPart);
          if (!fallbackTitle || cleanedLeft.toLowerCase().includes(fallbackTitle.toLowerCase())) {
            return cleanedRight;
          }
        }
      }
    }

    const atPattern = pageTitle.match(/(.+?)\s+at\s+(.+)/i);
    if (atPattern) {
      const company = this.normalizeText(atPattern[2]);
      if (company && !this.isGenericCompanyName(company)) {
        return company;
      }
    }

    // Final fallback: choose a segment that looks like a company name
    const separatorKeywords = /\b(job|jobs|career|careers|team|teams|apply|join)\b/i;
    for (const separator of separators) {
      if (!pageTitle.includes(separator)) continue;
      const parts = pageTitle
        .split(separator)
        .map(part => this.normalizeText(part))
        .filter(Boolean);
      for (const part of parts) {
        if (fallbackTitle && part.toLowerCase().includes(fallbackTitle.toLowerCase())) continue;
        if (separatorKeywords.test(part)) continue;
        if (!this.isGenericCompanyName(part)) {
          return part;
        }
      }
    }

    return '';
  }

  deriveCompanyFromHostname() {
    const hostname = (window.location.hostname || '').replace(/^www\./, '');
    if (!hostname) return '';
    const genericHosts = ['greenhouse.io', 'lever.co', 'myworkdayjobs.com', 'workday.com', 'icims.com', 'smartrecruiters.com', 'ashbyhq.com', 'jobvite.com', 'bamboohr.com'];
    for (const genericHost of genericHosts) {
      if (hostname.endsWith(genericHost)) {
        const prefix = hostname.replace(`.${genericHost}`, '');
        if (prefix && !['boards', 'job-boards', 'jobs', 'careers', 'apply'].includes(prefix)) {
          return this.toTitleCase(prefix.replace(/-/g, ' '));
        }
        return '';
      }
    }

    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      if (candidate && candidate.length < 50) {
        return this.toTitleCase(candidate.replace(/-/g, ' '));
      }
    }
    return '';
  }

  detectJobDescriptionFromDom() {
    const candidates = this.gatherDescriptionCandidates();
    const keywordPattern = /(responsibil|requirement|qualification|job description|you will|what you|who you|about the role|preferred)/i;
    let bestCandidate = { text: '', score: 0 };

    for (const candidate of candidates) {
      const text = this.normalizeText(candidate.text || candidate.element?.innerText || '');
      if (!text || text.length < 120) continue;
      let score = candidate.baseScore || 0;
      const matchCount = (text.match(keywordPattern) || []).length;
      score += matchCount * 3;
      score += Math.min(text.length / 500, 6);
      if (candidate.element) {
        const bulletCount = candidate.element.querySelectorAll ? candidate.element.querySelectorAll('li').length : 0;
        score += Math.min(bulletCount, 5);
      }
      if (score > bestCandidate.score) {
        bestCandidate = { text, score };
      }
    }

    if (bestCandidate.text) {
      return bestCandidate.text.slice(0, 6000);
    }

    const fallbackContainer = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    const fallbackText = this.normalizeText(fallbackContainer?.innerText || '');
    return fallbackText.slice(0, 6000);
  }

  gatherDescriptionCandidates() {
    const selectors = [
      '[data-qa*="description"]',
      '[class*="description"]',
      '[class*="job-details"]',
      '[class*="posting-body"]',
      'section',
      'article',
      'main'
    ];

    const candidates = [];
    const seen = new Set();

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (!this.isElementVisible(element)) return;
        const text = this.normalizeText(element.textContent || '');
        if (!text || text.length < 80) return;
        const hash = `${selector}|${text.slice(0, 80)}`;
        if (seen.has(hash)) return;
        seen.add(hash);
        let baseScore = 0;
        if (/description|responsib|requirement|posting|job/i.test(selector) || /description|about|responsib|role|qualification/i.test(element.className)) {
          baseScore += 3;
        }
        candidates.push({ element, text, baseScore });
      });
    });

    return candidates;
  }

  sanitizeHtmlText(value) {
    if (!value) return '';
    const temp = document.createElement('div');
    temp.innerHTML = value;
    return temp.textContent || temp.innerText || '';
  }

  normalizeText(text = '') {
    if (!text) return '';
    return text
      .replace(/\r/g, '')
      .replace(/\t+/g, ' ')
      .replace(/ {2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  isElementVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    if (element.offsetWidth === 0 && element.offsetHeight === 0) {
      return false;
    }
    return true;
  }

  toTitleCase(value = '') {
    return value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  getMetaContent(selectors = []) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const content = element?.getAttribute('content')?.trim();
      if (content) {
        return content;
      }
    }
    return '';
  }

  isGenericCompanyName(name = '') {
    const trimmed = (name || '').trim().toLowerCase();
    if (!trimmed) return true;
    if (trimmed === 'company' || trimmed === 'company name') {
      return true;
    }
    return ['greenhouse', 'lever', 'workday', 'myworkdayjobs', 'smartrecruiters', 'ashby', 'jobvite', 'bamboohr'].some(keyword => trimmed.includes(keyword));
  }

  extractCompanyFromPath() {
    const path = window.location.pathname || '';
    const match = path.match(/\/([^\/]+)\/jobs?/i);
    if (match && match[1]) {
      const candidate = match[1].replace(/-/g, ' ');
      if (candidate && candidate.length < 80) {
        return this.toTitleCase(candidate);
      }
    }
    return '';
  }

  findLabeledValue(pattern) {
    const labelSelectors = ['label', 'strong', 'span', 'p', 'dt'];
    for (const selector of labelSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = this.normalizeText(element.textContent || '');
        if (!text || !pattern.test(text)) continue;
        const valueElement = element.nextElementSibling;
        if (valueElement) {
          const valueText = this.normalizeText(valueElement.textContent || '');
          if (valueText && valueText.toLowerCase() !== text.toLowerCase() && !this.isGenericCompanyName(valueText)) {
            return valueText;
          }
        }
      }
    }
    return '';
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
      'textarea[data-provides="typeahead"]',
      'div[data-provides="typeahead"] textarea'
    ];
  }

  getDefaultWorkdaySelectors() {
    return {
      jobTitle: [
        '[data-automation-id="jobPostingHeader"] h1',
        '[data-automation-id="jobPostingHeader"] h2',
        '[data-automation-id="jobPostingHeader"]',
        '[data-automation-id="jobPostingTitle"]',
        '[data-automation-id="jobPostingInfoSection"] h2',
        '.jobPostingHeader h1'
      ],
      companyName: [
        '[data-automation-id="companyName"]',
        '[data-automation-id="jobPostingCompanyName"]',
        '.jobPostingCompanyName',
        '.company-name',
        '.jobPostingCompany'
      ],
      jobDescription: [
        '[data-automation-id="jobPostingDescription"]',
        '[data-automation-id="jobReqDescription"]',
        '[data-automation-id="jobReqQualifications"]',
        '[data-automation-id="job-detail-content"]',
        '.job-description',
        '.job-posting-brief',
        '.GWTCKEditor-Disabled'
      ]
    };
  }

  getDefaultWorkdayCoverLetterSelectors() {
    return [
      '[data-automation-id*="coverLetter"] textarea',
      '[data-automation-id*="CoverLetter"] textarea',
      '[data-automation-id*="coverLetter"] [role="textbox"]',
      'textarea[data-automation-id*="cover"]',
      'textarea[name*="cover"]',
      'textarea[id*="cover"]',
      '[data-automation-id="textInputBox"][role="textbox"]',
      'div[data-automation-id="textInputBox"] textarea'
    ];
  }

  getDefaultLeverSelectors() {
    return {
      jobTitle: [
        '.posting-headline h2',
        '.posting-headline h1',
        '.posting-headline .title',
        'h1[data-qa="posting-name"]',
        '.main-header h2',
        'h1'
      ],
      companyName: [
        '.posting-headline .company',
        '.posting-headline h3',
        '.posting-headline .posting-category',
        '.posting-headline .company-name',
        '[data-qa="company-name"]'
      ],
      jobDescription: [
        '.section[data-qa="posting-section-description"]',
        '.section-wrapper .section',
        '.posting-section',
        '.posting-description',
        '.content .section',
        '.content .section-wrapper'
      ]
    };
  }

  getDefaultLeverCoverLetterSelectors() {
    return [
      '#cover_letter_text',
      '#cover_letter',
      'textarea[name="cover_letter"]',
      'textarea[name*="coverLetter"]',
      'textarea[id*="coverLetter"]',
      '[data-qa="cover-letter"] textarea',
      '.application-question textarea',
      '.application-question [contenteditable="true"]'
    ];
  }

  getSiteSelectorConfig(site) {
    const providers = {
      greenhouse: () => ({
        ...this.getDefaultGreenhouseSelectors(),
        coverLetterTextarea: this.getDefaultGreenhouseCoverLetterSelectors()
      }),
      workday: () => ({
        ...this.getDefaultWorkdaySelectors(),
        coverLetterTextarea: this.getDefaultWorkdayCoverLetterSelectors()
      }),
      lever: () => ({
        ...this.getDefaultLeverSelectors(),
        coverLetterTextarea: this.getDefaultLeverCoverLetterSelectors()
      })
    };

    const provider = providers[site];
    if (!provider) return null;
    const defaults = provider();
    const configKey = `${site?.toUpperCase()}_SELECTORS`;
    try {
      if (typeof CONFIG !== 'undefined' && CONFIG[configKey]) {
        const configSelectors = CONFIG[configKey];
        return {
          ...defaults,
          ...configSelectors,
          coverLetterTextarea: configSelectors.coverLetterTextarea || defaults.coverLetterTextarea
        };
      }
    } catch (error) {
      console.warn(`Error loading selector config for ${site}:`, error);
    }
    return defaults;
  }

  applySelectorFallbacks(selectors = null) {
    if (!selectors) return;
    if (!this.jobDetails.title && selectors.jobTitle) {
      this.jobDetails.title = this.extractTextFromSelectors(selectors.jobTitle);
    }
    if (!this.jobDetails.company && selectors.companyName) {
      this.jobDetails.company = this.extractTextFromSelectors(selectors.companyName);
    }
    if (!this.jobDetails.description && selectors.jobDescription) {
      this.jobDetails.description = this.extractTextFromSelectors(selectors.jobDescription);
    }
  }

  applyGreenhouseFallbacks() {
    const selectors = this.getSiteSelectorConfig('greenhouse');
    this.applySelectorFallbacks(selectors);

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

  applyWorkdayFallbacks() {
    const selectors = this.getSiteSelectorConfig('workday');
    this.applySelectorFallbacks(selectors);

    if (!this.jobDetails.description) {
      const description = this.extractWorkdayJobDescription();
      if (description) {
        this.jobDetails.description = description;
      }
    }

    if (!this.jobDetails.company) {
      const companyElement = document.querySelector('[data-automation-id="companyName"], [data-automation-id="jobPostingCompanyName"], .jobPostingCompanyName, .company-name');
      const companyText = this.normalizeText(companyElement?.textContent || '');
      if (companyText) {
        this.jobDetails.company = companyText;
      }
    }
  }

  applyLeverFallbacks() {
    const selectors = this.getSiteSelectorConfig('lever');
    this.applySelectorFallbacks(selectors);

    if (!this.jobDetails.description) {
      const description = this.extractLeverJobDescription();
      if (description) {
        this.jobDetails.description = description;
      }
    }

    if (!this.jobDetails.company) {
      const companyElement = document.querySelector('.posting-headline .company, .posting-headline h3, .posting-headline .posting-categories, [data-qa="company-name"]');
      const companyText = this.normalizeText(companyElement?.textContent || '');
      if (companyText) {
        this.jobDetails.company = companyText;
      }
    }
  }

  extractWorkdayJobDescription() {
    const primary = document.querySelector('[data-automation-id="jobPostingDescription"]');
    if (primary) {
      return this.extractSectionedText([primary]);
    }

    const detailSections = document.querySelectorAll('[data-automation-id="jobReqDescription"], [data-automation-id="jobReqQualifications"]');
    if (detailSections.length) {
      return this.extractSectionedText(Array.from(detailSections));
    }

    const fallback = document.querySelector('[data-automation-id="job-detail-content"], .job-description, .job-posting-brief, .GWTCKEditor-Disabled');
    if (fallback) {
      return this.normalizeText(fallback.innerText || '').slice(0, 6000);
    }
    return '';
  }

  extractLeverJobDescription() {
    const leverSections = document.querySelectorAll('.section[data-qa="posting-section-description"], .section-wrapper .section, .posting-section, .posting-description');
    if (leverSections.length) {
      return this.extractSectionedText(Array.from(leverSections));
    }

    const fallback = document.querySelector('.content .section-wrapper, .content .section, .content .description');
    if (fallback) {
      return this.normalizeText(fallback.innerText || '').slice(0, 6000);
    }
    return '';
  }

  extractSectionedText(elements = []) {
    if (!elements || !elements.length) return '';
    const parts = [];
    const addText = (value) => {
      const text = this.normalizeText(value || '');
      if (text && !parts.includes(text)) {
        parts.push(text);
      }
    };

    elements.forEach(element => {
      if (!element) return;
      const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(heading => addText(heading.textContent));

      const lists = element.querySelectorAll('ul, ol');
      lists.forEach(list => {
        const bullets = Array.from(list.querySelectorAll('li'))
          .map(li => this.normalizeText(li.textContent || ''))
          .filter(Boolean)
          .map(text => `• ${text}`);
        if (bullets.length) {
          addText(bullets.join('\n'));
        }
      });

      const paragraphs = element.querySelectorAll('p');
      if (paragraphs.length) {
        addText(Array.from(paragraphs).map(p => p.textContent).join('\n\n'));
      } else {
        addText(element.innerText);
      }
    });

    return parts.join('\n\n').slice(0, 6000);
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

  startJobDetailObserver(maxDuration = 15000) {
    if (!document.body || this.jobDetailObserver) return;
    console.log('⏳ Waiting for async job details to load...');

    const reExtractDetails = (reason) => {
      const previousSnapshot = JSON.stringify(this.jobDetails || {});
      this.extractJobDetails();
      const updatedSnapshot = JSON.stringify(this.jobDetails || {});
      if (previousSnapshot !== updatedSnapshot) {
        console.log(`🔁 Job details updated after ${reason}:`, this.jobDetails);
      }
      if (this.hasBasicJobDetails()) {
        this.stopJobDetailObserver();
      }
    };

    this.jobDetailObserver = new MutationObserver(() => {
      if (this.jobDetailObserverPending) return;
      this.jobDetailObserverPending = true;
      setTimeout(() => {
        this.jobDetailObserverPending = false;
        reExtractDetails('DOM mutation');
      }, 200);
    });

    this.jobDetailObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    setTimeout(() => {
      if (!this.hasBasicJobDetails()) {
        reExtractDetails('delayed re-check');
      }
    }, 400);

    this.jobDetailObserverTimeout = setTimeout(() => {
      this.stopJobDetailObserver();
    }, maxDuration);
  }

  stopJobDetailObserver() {
    if (this.jobDetailObserver) {
      this.jobDetailObserver.disconnect();
      this.jobDetailObserver = null;
    }
    if (this.jobDetailObserverTimeout) {
      clearTimeout(this.jobDetailObserverTimeout);
      this.jobDetailObserverTimeout = null;
    }
    this.jobDetailObserverPending = false;
  }

  startCoverLetterObserver() {
    if (!document.body) return;
    this.stopCoverLetterObserver();
    this.coverLetterObserver = new MutationObserver(() => {
      if (this.coverLetterField) {
        this.stopCoverLetterObserver();
        return;
      }
      const field = this.findCoverLetterField();
      if (field) {
        this.coverLetterField = field;
        this.stopCoverLetterObserver();
      }
    });

    this.coverLetterObserver.observe(document.body, { childList: true, subtree: true });
  }

  stopCoverLetterObserver() {
    if (this.coverLetterObserver) {
      this.coverLetterObserver.disconnect();
      this.coverLetterObserver = null;
    }
  }

  findGenericCoverLetterField() {
    const selectors = [
      'textarea',
      '[contenteditable="true"]',
      '[role="textbox"]',
      'div[aria-multiline="true"]',
      'input[type="text"]',
      'input[type="search"]',
      'input[type="url"]',
      'input:not([type])'
    ];

    let bestCandidate = { element: null, score: 0 };
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const score = this.scoreCoverLetterCandidate(element);
        if (score > bestCandidate.score) {
          bestCandidate = { element, score };
        }
      });
    });

    if (bestCandidate.element && bestCandidate.score >= 6) {
      return bestCandidate.element;
    }
    return null;
  }

  scoreCoverLetterCandidate(element) {
    if (!element || !this.isElementVisible(element)) return 0;
    let score = 0;
    const tag = (element.tagName || '').toLowerCase();
    if (tag === 'textarea') score += 4;
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox') score += 3;
    const rows = parseInt(element.getAttribute('rows'), 10);
    if (!isNaN(rows) && rows >= 5) score += 1;
    const maxLength = parseInt(element.getAttribute('maxlength'), 10);
    if (!isNaN(maxLength)) {
      if (maxLength > 1000) score += 1;
      if (maxLength < 300) score -= 1;
    }

    const context = this.getFieldContextText(element);
    if (!context) return score;

    const keywordWeights = [
      { pattern: /cover\s+letter/, weight: 6 },
      { pattern: /motivation/, weight: 3 },
      { pattern: /personal statement/, weight: 3 },
      { pattern: /statement of interest/, weight: 3 },
      { pattern: /tell us/, weight: 2 },
      { pattern: /why.*(company|role|team)/, weight: 2 },
      { pattern: /anything else/, weight: 2 },
      { pattern: /additional information/, weight: 2 },
      { pattern: /introduce|about yourself/, weight: 2 }
    ];

    keywordWeights.forEach(({ pattern, weight }) => {
      if (pattern.test(context)) {
        score += weight;
      }
    });

    return score;
  }

  getFieldContextText(element) {
    if (!element) return '';
    const parts = [];
    const placeholder = element.getAttribute?.('placeholder');
    if (placeholder) parts.push(placeholder);
    const ariaLabel = element.getAttribute?.('aria-label');
    if (ariaLabel) parts.push(ariaLabel);
    const labelText = this.getAssociatedLabelText(element);
    if (labelText) parts.push(labelText);
    const describedText = this.getDescribedByText(element);
    if (describedText) parts.push(describedText);
    const siblingText = this.getSiblingContextText(element);
    if (siblingText) parts.push(siblingText);
    return parts.join(' ').toLowerCase();
  }

  getAssociatedLabelText(element) {
    if (!element) return '';
    if (element.id) {
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.htmlFor === element.id) {
          const text = this.normalizeText(label.textContent || '');
          if (text) return text;
        }
      }
    }
    const ancestorLabel = element.closest && element.closest('label');
    if (ancestorLabel) {
      const text = this.normalizeText(ancestorLabel.textContent || '');
      if (text) return text;
    }
    return '';
  }

  getSiblingContextText(element) {
    if (!element) return '';
    const texts = [];
    let sibling = element.previousElementSibling;
    while (sibling && texts.join(' ').length < 200) {
      const text = this.normalizeText(sibling.textContent || '');
      if (text) {
        texts.push(text);
        if (/cover letter/i.test(text)) break;
      }
      sibling = sibling.previousElementSibling;
    }
    if (!texts.length && element.parentElement) {
      const parentText = this.normalizeText(element.parentElement.textContent || '');
      if (parentText && parentText.length < 400) {
        texts.push(parentText);
      }
    }
    return texts.join(' ');
  }

  getDescribedByText(element) {
    if (!element) return '';
    const describedBy = element.getAttribute('aria-describedby');
    if (!describedBy) return '';
    const ids = describedBy.split(' ').map(id => id.trim()).filter(Boolean);
    const texts = ids.map(id => document.getElementById(id)?.innerText?.trim()).filter(Boolean);
    return texts.join(' ');
  }

  findCoverLetterField() {
    const heuristicField = this.findGenericCoverLetterField();
    if (heuristicField) {
      console.log('🎯 Found cover letter field via heuristics');
      this.coverLetterField = heuristicField;
      this.highlightCoverLetterField(heuristicField);
      this.stopCoverLetterObserver();
      return heuristicField;
    }

    if (this.currentSite === 'greenhouse') {
      const previousField = this.coverLetterField;
      this.coverLetterField = null;
      this.findGreenhouseCoverLetterField();
      if (this.coverLetterField) {
        this.stopCoverLetterObserver();
        return this.coverLetterField;
      }
      this.coverLetterField = previousField;
    }

    if (this.currentSite === 'workday') {
      const previousField = this.coverLetterField;
      this.coverLetterField = null;
      this.findWorkdayCoverLetterField();
      if (this.coverLetterField) {
        this.stopCoverLetterObserver();
        return this.coverLetterField;
      }
      this.coverLetterField = previousField;
    }

    if (this.currentSite === 'lever') {
      const previousField = this.coverLetterField;
      this.coverLetterField = null;
      this.findLeverCoverLetterField();
      if (this.coverLetterField) {
        this.stopCoverLetterObserver();
        return this.coverLetterField;
      }
      this.coverLetterField = previousField;
    }

    return null;
  }

  findGreenhouseCoverLetterField() {
    console.log('🔍 Starting cover letter field detection...');
    console.log('Current site:', this.currentSite);
    
    const selectors = this.getSiteSelectorConfig('greenhouse')?.coverLetterTextarea 
      || this.getDefaultGreenhouseCoverLetterSelectors();
    console.log('Using Greenhouse selectors:', selectors.length, 'selectors');

    console.log('Testing selectors:', selectors);

    for (const selector of selectors) {
      console.log('Testing selector:', selector);
      const field = document.querySelector(selector);
      if (field) {
        console.log('✅ Found element with selector:', selector, field);
        if (field.tagName === 'BUTTON' && field.textContent?.includes('Enter manually')) {
          console.log('🎯 Found "Enter manually" button for cover letter');
          this.coverLetterField = field;
          this.highlightCoverLetterField(field);
          return;
        }

        const normalizedField = this.resolveFillableField(field);
        if (normalizedField) {
          this.coverLetterField = normalizedField;
          this.highlightCoverLetterField(normalizedField);
          console.log('🎯 Found cover letter field:', selector);
          return;
        }
        console.log('Found element but wrong type:', field.tagName, field.textContent?.substring(0, 50));
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

  findWorkdayCoverLetterField() {
    console.log('🔍 Starting Workday cover letter detection');
    const selectors = this.getSiteSelectorConfig('workday')?.coverLetterTextarea 
      || this.getDefaultWorkdayCoverLetterSelectors();
    const field = this.locateCoverLetterCandidateFromSelectors(selectors);
    if (field) {
      this.coverLetterField = field;
      this.highlightCoverLetterField(field);
      console.log('🎯 Found Workday cover letter field via selectors');
      return;
    }

    const promptSelectors = ['[data-automation-id="promptOption"]', 'label', 'legend'];
    const keywordPattern = /(cover letter|statement|motivation|why.*company|additional information)/i;
    for (const selector of promptSelectors) {
      const prompts = document.querySelectorAll(selector);
      for (const prompt of prompts) {
        const text = this.normalizeText(prompt.textContent || '');
        if (!text || !keywordPattern.test(text)) continue;
        const container = prompt.closest('[data-automation-id="questionItem"]') || prompt.parentElement;
        const candidate = container?.querySelector('textarea, [contenteditable="true"], [role="textbox"], input[type="text"], div[data-automation-id="textInputBox"]');
        const normalized = this.resolveFillableField(candidate);
        if (normalized) {
          this.coverLetterField = normalized;
          this.highlightCoverLetterField(normalized);
          console.log('🎯 Found Workday cover letter field near prompt text');
          return;
        }
      }
    }

    console.log('No Workday-specific cover letter field detected');
  }

  findLeverCoverLetterField() {
    console.log('🔍 Starting Lever cover letter detection');
    const selectors = this.getSiteSelectorConfig('lever')?.coverLetterTextarea 
      || this.getDefaultLeverCoverLetterSelectors();
    const field = this.locateCoverLetterCandidateFromSelectors(selectors);
    if (field) {
      this.coverLetterField = field;
      this.highlightCoverLetterField(field);
      console.log('🎯 Found Lever cover letter field via selectors');
      return;
    }

    const questionBlocks = document.querySelectorAll('.application-question, .application-additional, .question');
    const keywordPattern = /(cover letter|statement|why.*role|why.*company|additional information)/i;
    for (const block of questionBlocks) {
      if (!block) continue;
      const label = this.normalizeText(block.textContent || '');
      if (!label || !keywordPattern.test(label)) continue;
      const candidate = block.querySelector('textarea, [contenteditable="true"], [role="textbox"], input[type="text"]');
      const normalized = this.resolveFillableField(candidate);
      if (normalized) {
        this.coverLetterField = normalized;
        this.highlightCoverLetterField(normalized);
        console.log('🎯 Found Lever cover letter field in question block');
        return;
      }
    }

    console.log('No Lever-specific cover letter field detected');
  }

  locateCoverLetterCandidateFromSelectors(selectors = []) {
    if (!selectors || !selectors.length) return null;
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const normalized = this.resolveFillableField(element);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  resolveFillableField(element) {
    if (!element) return null;
    if (this.isFillableField(element)) {
      return element;
    }
    if (typeof element.querySelector === 'function') {
      const nested = element.querySelector('textarea, [contenteditable="true"], [role="textbox"], input[type="text"], input:not([type])');
      if (nested && this.isFillableField(nested)) {
        return nested;
      }
    }
    return null;
  }

  isFillableField(element) {
    if (!element) return false;
    const tag = (element.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') {
      return true;
    }
    if (element.isContentEditable || element.getAttribute?.('contenteditable') === 'true') {
      return true;
    }
    if (element.getAttribute?.('role') === 'textbox') {
      return true;
    }
    return false;
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
        this.coverLetterField = this.findCoverLetterField();
      }
      
      if (this.coverLetterField) {
        // Auto-fill scenario
        console.log('✅ Using auto-fill mode');
        await this.fillCoverLetter(request.coverLetter);
        sendResponse({ success: true, action: 'filled' });
      } else {
        // No cover letter field found
        console.log('❌ No cover letter field found');
        sendResponse({ success: false, error: 'No cover letter field found on this page' });
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
        this.highlightCoverLetterField(textarea);
        this.stopCoverLetterObserver();
        console.log('✅ Found textarea after clicking Enter manually:', textarea.id || textarea.name || textarea.className);
      } else {
        throw new Error('No textarea appeared after clicking "Enter manually"');
      }
    }

    const targetField = this.coverLetterField;
    const isContentEditable = targetField.isContentEditable || targetField.getAttribute?.('contenteditable') === 'true' || targetField.getAttribute?.('role') === 'textbox';

    if (targetField.tagName === 'TEXTAREA' || targetField.tagName === 'INPUT') {
      targetField.focus();
      await this.typeText(targetField, coverLetterText);
    } else if (isContentEditable) {
      this.fillContentEditableField(targetField, coverLetterText);
    } else {
      throw new Error('Cover letter field is not fillable');
    }

    this.showSuccessMessage('Cover letter filled successfully!');
  }

  fillContentEditableField(element, text) {
    if (!element) return;
    element.focus();
    element.innerHTML = '';
    element.textContent = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
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
    if (!element) return;
    const tagName = (element.tagName || '').toLowerCase();
    const proto = tagName === 'textarea'
      ? window.HTMLTextAreaElement?.prototype
      : window.HTMLInputElement?.prototype;
    const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;

    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(element, text);
    } else {
      element.value = text;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
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
