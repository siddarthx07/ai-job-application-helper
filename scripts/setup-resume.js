// Script to pre-populate resume in extension storage
// This will be automatically loaded when the extension starts

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

// Function to initialize resume in extension storage
async function initializeResume() {
  try {
    await chrome.storage.local.set({ resume: RESUME_TEXT });
    console.log('✅ Resume pre-loaded successfully');
  } catch (error) {
    console.error('❌ Error pre-loading resume:', error);
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RESUME_TEXT, initializeResume };
}
