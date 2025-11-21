// Build script to load .env and create config for Chrome extension
const fs = require('fs');
const path = require('path');

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const envConfig = {};
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // Remove quotes if present
          envConfig[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      }
    });
  }
  
  return envConfig;
}

// Generate config.js with environment variables
function generateConfig() {
  const env = loadEnv();
  
  const configContent = `// Configuration for AutoFiller Extension
// Auto-generated from .env file - DO NOT EDIT MANUALLY

const CONFIG = {
  // Gemini API Configuration
  GEMINI_API_KEY: '${env.GEMINI_API_KEY || 'not_configured'}',
  GEMINI_MODEL: 'gemini-2.5-flash', // Using 2.5 Flash - latest version
  GEMINI_TEMPERATURE: 0.7,
  GEMINI_MAX_TOKENS: 10000, // Allow longer outputs for tailored resumes and letters
  
  // API Endpoints
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
  
  // Extension Settings
  DEFAULT_TONE: 'professional', // professional, enthusiastic, technical, creative
  DEFAULT_LENGTH: 'medium', // short, medium, long
  // Greenhouse Selectors - CRITICAL FOR GREENHOUSE FUNCTIONALITY
  GREENHOUSE_SELECTORS: {
    coverLetterTextarea: [
      // MOST IMPORTANT: The "Enter manually" button that must be detected first
      'button[data-testid="cover_letter-text"]', // This is the button from HTML!
      'button[class*="btn-pill"][data-testid*="cover"]',
      // The textarea that appears after clicking the button - ONLY cover letter specific
      'textarea[id="cover_letter_text"]',
      'textarea[name="cover_letter"]',
      'textarea[id*="cover_letter"]',
      'textarea[aria-describedby*="cover_letter"]'
    ],
    jobTitle: [
      'h1[class*="job-title"]',
      'h1[class*="title"]',
      '.job-title',
      '.job_title',
      '[data-qa="job-title"]',
      'h1',
      'title'
    ],
    companyName: [
      '[class*="company-name"]',
      '[class*="company_name"]',
      '.company-name',
      '.company_name',
      '[data-qa="company-name"]',
      '[class*="organization"]',
      'title'
    ],
    jobDescription: [
      '.job_description_body',
      '[class*="job_description"]',
      '.job-description',
      '[data-qa="job-description"]',
      '.job-post-description',
      '[class*="job-description"]',
      '.description-content',
      '.job-details',
      '.content'
    ]
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}`;

  const configPath = path.join(__dirname, '..', 'config', 'config.js');
  fs.writeFileSync(configPath, configContent);
console.log('✅ Config generated successfully with API key from .env');
console.log('🤖 Using Gemini 2.5 Flash for reliable cover letter generation');
}

// Run the build
try {
  generateConfig();
} catch (error) {
  console.error('❌ Error generating config:', error.message);
  process.exit(1);
}
