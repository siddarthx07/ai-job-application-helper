// Background script for AutoFiller Extension
// Handles API calls and storage management

// Import configuration
importScripts('../config/config.js');

const LATEX_RESUME_TEMPLATE = String.raw`
%-------------------------
% Resume in LaTeX
% Compiled server-side via LaTeX.Online with full package support
%------------------------

\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage{array}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-0.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

%-------------------------
% Custom commands
\newcommand{\resumeItem}[2]{
  \item\small{
    \textbf{#1}{: #2 \vspace{-2pt}}
  }
}

\newcommand{\resumeItemNH}[1]{
  \item\small{
    {#1 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-1pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-5pt}
}

\newcommand{\resumeSubItem}[2]{\resumeItem{#1}{#2}\vspace{-4pt}}

\renewcommand{\labelitemii}{$\circ$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=*,label={}]}
\newcommand{\resumeSubHeadingListStartBullets}{\begin{itemize}[leftmargin=*]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

% Custom font sizes
\makeatletter
\newcommand\HUGE{\@setfontsize\Huge{28}{35}}
\makeatother

%-------------------------------------------
%%%%%%  CV STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

\begin{document}

%----------HEADER----------
\begin{center}
  {\HUGE \textbf{Your Name}} \\ \vspace{2pt}
  \small \href{mailto:your@email.com}{your@email.com} $|$
  \href{https://linkedin.com/in/yourprofile}{linkedin.com/in/yourprofile} $|$
  \href{https://github.com/yourusername}{github.com/yourusername}
\end{center}

%-----------EDUCATION-----------------
\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {University Name}{City, State}
      {Degree in Major, GPA: X.XX}{Month Year -- Present}
    \resumeSubheading
      {University Name}{City, State}
      {Degree in Major, GPA: X.XX}{Month Year -- Month Year}
  \resumeSubHeadingListEnd

%-----------EXPERIENCE-----------------
\section{Experience}
  \resumeSubHeadingListStart

    \resumeSubheading
      {Company Name}{City, State}
      {Job Title}{Month Year -- Present}
      \resumeItemListStart
        \resumeItemNH{Write your achievement or responsibility here with metrics.}
        \resumeItemNH{Another impactful contribution showing your skills.}
        \resumeItemNH{Mention technologies, improvements, or business impact.}
      \resumeItemListEnd

    \resumeSubheading
      {Company Name}{City, State}
      {Job Title}{Month Year -- Month Year}
      \resumeItemListStart
        \resumeItemNH{Concise bullet describing your work and impact.}
        \resumeItemNH{Quantifiable results when possible.}
      \resumeItemListEnd

  \resumeSubHeadingListEnd

%-----------PROJECTS-----------------
\section{Projects}
  \resumeSubHeadingListStartBullets

    \resumeSubItem{Project Name $|$ \href{https://github.com/yourrepo}{GitHub}}
      {Description with tech stack and outcomes.}

    \resumeSubItem{Project Name $|$ \href{https://demo.com}{Live Demo}}
      {What the project does and your contribution.}

  \resumeSubHeadingListEnd

%-----------SKILLS-----------------
\section{Technical Skills}
  \resumeSubHeadingListStart
    \resumeSubItem{Languages}
      {Python, Java, JavaScript, C++, SQL}
    \resumeSubItem{Frameworks}
      {React, Node.js, Django, Spring Boot}
    \resumeSubItem{Tools}
      {Git, Docker, AWS, Jenkins, MongoDB}
  \resumeSubHeadingListEnd

\end{document}
`;
function encodeToBase64(str) {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(str)));
  }
  return Buffer.from(str, 'utf-8').toString('base64');
}

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log(`🚀 AutoFiller Extension installed at ${new Date().toLocaleString()}`);
  }

  if (chrome.sidePanel) {
    try {
      await chrome.sidePanel.setOptions({
        path: 'popup/popup.html',
        enabled: true
      });
    } catch (error) {
      console.error('❌ Failed to configure side panel default path:', error);
    }
  }
});

class GeminiAPI {
  constructor() {
    this.apiKey = CONFIG.GEMINI_API_KEY;
    this.model = CONFIG.GEMINI_MODEL;
    this.baseUrl = CONFIG.GEMINI_API_URL;
  }

  async generateCoverLetter(jobDetails, resumeInput = {}, preferences = {}) {
    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      throw new Error('Please configure your Gemini API key in config/config.js');
    }

    const resumeText = resumeInput?.text || resumeInput?.file?.text;
    if (!resumeText?.trim()) {
      throw new Error('Resume text unavailable. Re-upload a text-based PDF before generating content.');
    }

    const prompt = this.buildCoverLetterPrompt(jobDetails, preferences, false, resumeText);

    const parts = [
      { text: prompt },
      { text: `CANDIDATE RESUME TEXT:\n${resumeText}` }
    ];
    
    try {
      const response = await fetch(`${this.baseUrl}${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts
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

  buildCoverLetterPrompt(jobDetails, preferences, hasResumeAttachment, resumeText) {
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

${hasResumeAttachment ? 'The candidate\'s most recent resume PDF is attached. Carefully extract accomplishments, roles, and context from the document.' : `CANDIDATE'S RESUME:\n${resumeText || '[Not provided]'}`}

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

  extractTextFromResponse(data) {
    const candidates = data?.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      const text = parts
        .filter(part => typeof part.text === 'string' && part.text.trim().length)
        .map(part => part.text.trim())
        .join('\n')
        .trim();

      if (candidate.finishReason === 'MAX_TOKENS') {
        const usage = data?.usageMetadata;
        const thinking = usage?.thoughtsTokenCount || 0;
        const output = usage?.candidatesTokenCount || 0;
        console.warn(`⚠️ Gemini hit token limit (thinking: ${thinking}, output: ${output}, total: ${usage.totalTokenCount}). Attempting to parse partial response...`);
        // Don't throw - try to parse what we got
      }

      if (text) return text;
    }
    return '';
  }

  parseJsonPayload(modelText) {
    if (!modelText) {
      throw new Error('Model response was empty');
    }
    const cleaned = modelText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const tryParse = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    let parsed = tryParse(cleaned);
    if (parsed) {
      return parsed;
    }

    const sanitized = this.sanitizeJsonString(cleaned);
    parsed = tryParse(sanitized);
    if (parsed) {
      return parsed;
    }

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const sliced = cleaned.slice(start, end + 1);
      parsed = tryParse(sliced) || tryParse(this.sanitizeJsonString(sliced));
      if (parsed) {
        return parsed;
      }
    }

    const repaired = this.repairJsonString(cleaned);
    if (repaired) {
      parsed = tryParse(repaired);
      if (parsed) {
        console.warn('✅ Gemini output required JSON repair before parsing.');
        return parsed;
      }
    }

    // Last resort: Check if we have resumeLatex field even if incomplete
    if (cleaned.includes('"resumeLatex"')) {
      console.warn('⚠️ Attempting emergency partial JSON extraction...');
      const emergencyParsed = this.extractPartialResume(cleaned);
      if (emergencyParsed) {
        return emergencyParsed;
      }
    }

    console.error('Failed to parse JSON payload:', cleaned.substring(0, 500));
    throw new Error('Model response could not be parsed. The resume may be too complex - try a simpler job description.');
  }

  extractPartialResume(text) {
    try {
      // Try to extract resumeLatex even from incomplete JSON
      const latexMatch = text.match(/"resumeLatex":\s*"((?:[^"\\]|\\.)*)"/);
      if (latexMatch) {
        return {
          resumeLatex: latexMatch[1].replace(/\\n/g, '\n').replace(/\\\\/g, '\\'),
          skillsHighlights: [],
          keywordGaps: [],
          addedBulletSuggestions: []
        };
      }
    } catch (e) {
      console.error('Emergency extraction failed:', e);
    }
    return null;
  }

  sanitizeJsonString(text) {
    if (typeof text !== 'string') {
      return text;
    }
    return text
      .replace(/\\u(?![0-9a-fA-F]{4})/g, '\\\\u')
      .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  }

  repairJsonString(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return text;
    }
    let result = '';
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      result += char;

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}' || char === ']') {
        if (stack.length && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }

    if (inString) {
      result += '"';
    }
    while (stack.length) {
      result += stack.pop();
    }

    return result.replace(/,(\s*[}\]])/g, '$1');
  }

  buildResumePrompt(jobDetails = {}, options = {}) {
    return `You are an elite technical recruiter and ATS expert. Tailor the attached resume PDF to the job description while keeping every fact truthful.

JOB:
- Company: ${jobDetails.company || 'Not provided'}
- Role: ${jobDetails.title || 'Not provided'}
- Description: ${jobDetails.description || 'Not provided'}

RULES:
1. Rewrite existing bullets so they naturally include high-priority job keywords, action verbs, and metrics that already appear in the resume. Do not invent facts; you may extrapolate context but stay truthful.
2. Keep the section order exactly: Header, Education, Experience, Projects, Leadership & Awards, Skills Summary. Maintain chronological ordering within each section. Only reorder the Skills list to surface the most relevant skills first.
3. Highlight JD-aligned skills in the Skills section by moving them to the top and wrapping the key term with \\textbf{}.
4. Add missing but relevant keywords as suggestions ONLY via the "keywordGaps" or "addedBulletSuggestions" arrays. Never delete user content; instead de-emphasize by shortening details if needed.
5. Every bullet should start with a strong verb, mention technologies, and quantify impact where the resume gives data (percentages, counts, time saved, etc.).
6. Ensure formatting matches the provided LaTeX template exactly. Keep it one page unless the original resume clearly reflects 10+ years of experience.

OUTPUT JSON ONLY:
{
  "resumeLatex": "string",
  "skillsHighlights": [
    { "skill": "string", "matchScore": 0-100, "justification": "Tie to resume + JD" }
  ],
  "keywordGaps": [
    { "keyword": "string", "reason": "Why it's missing + valuable" }
  ],
  "addedBulletSuggestions": [
    { "section": "Experience|Projects|Leadership", "text": "string", "reason": "Why it helps" }
  ]
}

NOTES:
- Use the attached resume PDF plus template to extract real facts.
- You may add clarifying details only if they are implied by the resume.
- Never output prose outside the JSON.`;
  }

  async generateTailoredResume(jobDetails, resumeFile, options = {}) {
    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      throw new Error('Please configure your Gemini API key in config/config.js');
    }
    if (!resumeFile?.text?.trim()) {
      throw new Error('Resume text unavailable. Re-upload a text-based PDF before tailoring.');
    }
    const resumeText = resumeFile.text;

    const prompt = this.buildResumePrompt(jobDetails, options);
    const parts = [
      { text: prompt },
      { text: `CANDIDATE RESUME TEXT:\n${resumeText}` },
      {
        inline_data: {
          mime_type: 'text/plain',
          data: encodeToBase64(LATEX_RESUME_TEMPLATE)
        }
      }
    ];

    const contents = [{
      role: 'user',
      parts
    }];

    try {
      const response = await fetch(`${this.baseUrl}${this.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: options.temperature ?? 1.5,  // Even higher temp to disable thinking
            maxOutputTokens: options.maxTokens || 32000,  // Gemini Flash max is 8192, but total can be 32k
            stopSequences: options.stopSequences || []
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
      const text = this.extractTextFromResponse(data);
      const parsed = this.parseJsonPayload(text);
      if (!parsed?.resumeLatex) {
        throw new Error('Model response did not include a LaTeX document.');
      }

      return parsed;
    } catch (error) {
      console.error('Error generating tailored resume:', error);
      throw error;
    }
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
    storage.getResumeFile()
      .then(resumeFile => {
        const resumeText = request.resumeText || resumeFile?.text;
        return gemini.generateCoverLetter(
          request.jobDetails, 
          { text: resumeText, file: resumeFile }, 
          request.preferences
        );
      })
      .then(coverLetter => {
        sendResponse({ success: true, coverLetter });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'generateTailoredResume') {
    const gemini = new GeminiAPI();
    storage.getResumeFile()
      .then(resumeFile => gemini.generateTailoredResume(
        request.jobDetails,
        resumeFile,
        request.preferences || {}
      ))
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

});

// Open the side panel when the user clicks the toolbar icon
chrome.action.onClicked.addListener(async (tab) => {
  if (!chrome.sidePanel || !tab?.id) {
    return;
  }

  if (tab.url && (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('edge://') ||
    tab.url.startsWith('about:')
  )) {
    console.warn('Side panel cannot be opened on this page type:', tab.url);
    return;
  }

  try {
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'popup/popup.html',
      enabled: true
    });
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('❌ Failed to open side panel:', error);
  }
});


// Storage helpers
const storage = {
  async saveResumeFile(resumeFile) {
    try {
      await chrome.storage.local.set({ resumeFile });
    } catch (error) {
      if (error.message && error.message.includes('QUOTA_EXCEEDED')) {
        throw new Error('Resume file too large. Chrome storage limit is ~5MB. Try a smaller PDF or remove images.');
      }
      throw error;
    }
  },
  
  async getResumeFile() {
    const result = await chrome.storage.local.get(['resumeFile']);
    return result.resumeFile || null;
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
  },
  
  async saveTailoredResume(resumeEntry) {
    if (!resumeEntry?.jobKey) return;
    const result = await chrome.storage.local.get(['tailoredResumes']);
    const resumes = result.tailoredResumes || {};
    resumes[resumeEntry.jobKey] = resumeEntry;
    await chrome.storage.local.set({ tailoredResumes: resumes });
  },
  
  async getTailoredResume(jobKey) {
    if (!jobKey) return null;
    const result = await chrome.storage.local.get(['tailoredResumes']);
    return result.tailoredResumes?.[jobKey] || null;
  }
};

// Export storage for use in other scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveResumeFile') {
    storage.saveResumeFile(request.resumeFile)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error saving resume file:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'getResumeFile') {
    storage.getResumeFile().then(resumeFile => {
      sendResponse({ success: true, resumeFile });
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
  
  if (request.action === 'saveTailoredResume') {
    storage.saveTailoredResume(request.resume).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'getTailoredResume') {
    storage.getTailoredResume(request.jobKey).then(resume => {
      sendResponse({ success: true, resume });
    });
    return true;
  }
});
