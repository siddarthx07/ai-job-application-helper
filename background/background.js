// Background script for AutoFiller Extension
// Handles API calls and storage management

// Import configuration and resume setup
importScripts('../config/config.js');
importScripts('../scripts/setup-resume.js');

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log(`🚀 AutoFiller Extension installed at ${new Date().toLocaleString()}`);
    // Pre-load resume template
    const RESUME_TEXT = `[Your Name]
[Your Email]
[Your Phone Number]
[Your LinkedIn Profile]

Education
[Your University] [Location]
[Degree] [CGPA] [Dates]

Experience
[Company Name] [Location]
[Job Title] [Dates]
• [Achievement 1]
• [Achievement 2]

Projects
• [Project Name]: [Description]

Skills Summary
Languages: [Your Languages]
Tools: [Your Tools]
Frameworks: [Your Frameworks]`;
    
    await chrome.storage.local.set({ resume: RESUME_TEXT });
    console.log('✅ Resume pre-loaded successfully');
  }
});

class GeminiAPI {
  constructor() {
    this.apiKey = CONFIG.GEMINI_API_KEY;
    this.model = CONFIG.GEMINI_MODEL;
    this.baseUrl = CONFIG.GEMINI_API_URL;
  }

  async generateCoverLetter(jobDetails, resumeText, preferences = {}) {
    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      throw new Error('Please configure your Gemini API key in config/config.js');
    }

    const prompt = this.buildPrompt(jobDetails, resumeText, preferences);
    
    try {
      const response = await fetch(`${this.baseUrl}${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: preferences.temperature || CONFIG.GEMINI_TEMPERATURE,
            maxOutputTokens: preferences.maxTokens || CONFIG.GEMINI_MAX_TOKENS,
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || response.statusText;
        console.error('Gemini API Error Details:', errorData);
        throw new Error(`API Error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();
      return data.candidates[0]?.content?.parts[0]?.text || 'Failed to generate cover letter';
    } catch (error) {
      console.error('Error generating cover letter:', error);
      throw error;
    }
  }

  buildPrompt(jobDetails, resumeText, preferences) {
    const tone = preferences.tone || CONFIG.DEFAULT_TONE;
    const length = preferences.length || CONFIG.DEFAULT_LENGTH;
    
    const lengthInstructions = {
      'short': 'Keep it concise, 2-3 paragraphs, around 200-300 words',
      'medium': 'Write 3-4 paragraphs, around 350-500 words',
      'long': 'Write 4-5 detailed paragraphs, around 450-550 words'
    };
    
    const toneInstructions = {
      'professional': 'Use formal, business-appropriate language with confidence',
      'enthusiastic': 'Show genuine excitement and passion for the role and company',
      'technical': 'Focus on technical skills, methodologies, and specific expertise',
      'creative': 'Use engaging language that showcases personality and innovation'
    };
    
    return `You are an expert career counselor and professional writer. Create a compelling, tailored cover letter that will make this candidate stand out.

JOB INFORMATION:
Company: ${jobDetails.company || 'Not specified'}
Position: ${jobDetails.title || 'Not specified'}
Job Description: ${jobDetails.description || 'Not specified'}

CANDIDATE'S RESUME:
${resumeText}

WRITING REQUIREMENTS:
• Tone: ${tone} - ${toneInstructions[tone] || toneInstructions.professional}
• Length: ${length} - ${lengthInstructions[length] || lengthInstructions.medium}
• Format: Professional cover letter with proper addressing

LETTER FORMAT STRUCTURE:
1. TO ADDRESS (at top):
   Siddarth Bandi
   siddarthbandi2025@gmail.com
   Virginia, USA

2. FROM ADDRESS (below TO):
   ${jobDetails.company || 'Hiring Manager'}
   [City, State] (use only city and state, no specific address)

3. LETTER CONTENT:
   - Professional greeting (Dear Hiring Manager,)
   - Opening paragraph with strong hook
   - 2-3 body paragraphs matching qualifications
   - Closing paragraph with clear next steps
   - Professional sign-off (Regards, Siddarth Bandi)

• No placeholders - use actual information provided
• Start with the TO address, then FROM address, then letter content

CONTENT STRATEGY:
1. Opening: Hook the reader with a strong opening that shows knowledge of the company/role
2. Body: Match 2-3 key qualifications from the resume to specific job requirements
3. Value Proposition: Highlight unique achievements with quantifiable results when possible
4. Company Connection: Show genuine interest in the company's mission/values/recent news
5. Closing: Professional close with clear next steps

ANALYSIS INSTRUCTIONS:
- Carefully analyze the job description to identify key requirements
- Match the candidate's experience to these requirements specifically
- Use keywords from the job posting naturally
- Show understanding of the company's industry and challenges
- Demonstrate how the candidate can solve their problems

Generate a cover letter that hiring managers will want to read completely:`;
  }
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkApiKey') {
    const configured = CONFIG.GEMINI_API_KEY && 
                     CONFIG.GEMINI_API_KEY !== 'not_configured' && 
                     CONFIG.GEMINI_API_KEY !== 'your_gemini_api_key_here';
    sendResponse({ configured });
    return;
  }
  
  if (request.action === 'generateCoverLetter') {
    const gemini = new GeminiAPI();
    
    gemini.generateCoverLetter(request.jobDetails, request.resumeText, request.preferences)
      .then(coverLetter => {
        sendResponse({ success: true, coverLetter });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
  
});


// Storage helpers
const storage = {
  async saveResume(resumeText) {
    await chrome.storage.local.set({ resume: resumeText });
  },
  
  async getResume() {
    const result = await chrome.storage.local.get(['resume']);
    return result.resume || '';
  },
  
  async savePreferences(preferences) {
    await chrome.storage.local.set({ preferences });
  },
  
  async getPreferences() {
    const result = await chrome.storage.local.get(['preferences']);
    return result.preferences || {
      tone: CONFIG.DEFAULT_TONE,
      length: CONFIG.DEFAULT_LENGTH
    };
  },
  
  async saveCoverLetter(coverLetter) {
    await chrome.storage.local.set({ coverLetter });
  },
  
  async getCoverLetter() {
    const result = await chrome.storage.local.get(['coverLetter']);
    return result.coverLetter || '';
  },
  
  async clearCoverLetter() {
    await chrome.storage.local.remove(['coverLetter']);
  }
};

// Export storage for use in other scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveResume') {
    storage.saveResume(request.resume).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getResume') {
    storage.getResume().then(resume => {
      sendResponse({ success: true, resume });
    });
    return true;
  }
  
  if (request.action === 'savePreferences') {
    storage.savePreferences(request.preferences).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getPreferences') {
    storage.getPreferences().then(preferences => {
      sendResponse({ success: true, preferences });
    });
    return true;
  }
  
  if (request.action === 'saveCoverLetter') {
    storage.saveCoverLetter(request.coverLetter).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getCoverLetter') {
    storage.getCoverLetter().then(coverLetter => {
      sendResponse({ success: true, coverLetter });
    });
    return true;
  }
  
  if (request.action === 'clearCoverLetter') {
    storage.clearCoverLetter().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
