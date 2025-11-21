/**
 * Local LaTeX Compilation Server
 *
 * This server accepts LaTeX content via POST request and compiles it to PDF
 * using a local LaTeX installation (pdflatex).
 *
 * Prerequisites:
 * - Node.js installed
 * - LaTeX distribution installed (TeX Live, MiKTeX, or MacTeX)
 * - pdflatex command available in PATH
 *
 * Install dependencies:
 *   npm install express cors child_process fs-extra
 *
 * Run server:
 *   node server.js
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Temporary directory for compilation
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
fs.ensureDirSync(TEMP_DIR);

// Middleware
app.use(cors()); // Enable CORS for browser extension
app.use(express.json({ limit: '10mb' })); // Parse JSON with larger limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'LaTeX Compilation Server',
    version: '1.0.0',
    endpoints: {
      compile: 'POST /compile',
      health: 'GET /'
    }
  });
});

// Compile LaTeX to PDF endpoint
app.post('/compile', async (req, res) => {
  console.log('[Server] Received compilation request');

  const { latex } = req.body;

  if (!latex) {
    return res.status(400).json({
      success: false,
      error: 'No LaTeX content provided. Send { "latex": "your content" }'
    });
  }

  console.log('[Server] LaTeX content length:', latex.length);

  // Generate unique ID for this compilation
  const compilationId = crypto.randomBytes(16).toString('hex');
  const workDir = path.join(TEMP_DIR, compilationId);

  try {
    // Create working directory
    await fs.ensureDir(workDir);
    console.log('[Server] Created working directory:', workDir);

    // Write LaTeX file
    const texFilePath = path.join(workDir, 'document.tex');
    await fs.writeFile(texFilePath, latex, 'utf8');
    console.log('[Server] Wrote LaTeX file');

    // Compile LaTeX to PDF
    console.log('[Server] Starting pdflatex compilation...');

    const pdflatexCommand = `pdflatex -interaction=nonstopmode -output-directory="${workDir}" "${texFilePath}"`;

    await new Promise((resolve, reject) => {
      exec(pdflatexCommand, { cwd: workDir }, (error, stdout, stderr) => {
        if (error) {
          console.error('[Server] Compilation error:', error.message);
          console.error('[Server] stdout:', stdout);
          console.error('[Server] stderr:', stderr);

          // Check if PDF was created despite errors (common with LaTeX)
          const pdfPath = path.join(workDir, 'document.pdf');
          if (fs.existsSync(pdfPath)) {
            console.log('[Server] PDF was created despite warnings');
            resolve();
          } else {
            reject(new Error(`pdflatex failed: ${stderr || error.message}`));
          }
        } else {
          console.log('[Server] Compilation successful');
          resolve();
        }
      });
    });

    // Read the generated PDF
    const pdfPath = path.join(workDir, 'document.pdf');
    const pdfBuffer = await fs.readFile(pdfPath);

    console.log('[Server] PDF size:', pdfBuffer.length, 'bytes');

    // Convert to base64
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

    // Cleanup
    await fs.remove(workDir);
    console.log('[Server] Cleaned up working directory');

    // Send response
    res.json({
      success: true,
      pdfDataUrl: pdfDataUrl,
      size: pdfBuffer.length
    });

  } catch (error) {
    console.error('[Server] Compilation failed:', error);

    // Try to get LaTeX log for better error messages
    let logContent = '';
    try {
      const logPath = path.join(workDir, 'document.log');
      if (await fs.pathExists(logPath)) {
        logContent = await fs.readFile(logPath, 'utf8');
        console.error('[Server] LaTeX log:', logContent.substring(0, 500));
      }
    } catch (logError) {
      // Ignore log read errors
    }

    // Cleanup
    try {
      await fs.remove(workDir);
    } catch (cleanupError) {
      console.error('[Server] Cleanup error:', cleanupError);
    }

    res.status(500).json({
      success: false,
      error: error.message,
      log: logContent.substring(0, 1000) // Send first 1000 chars of log
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 LaTeX Compilation Server Running                     ║
║                                                            ║
║   📍 URL: http://localhost:${PORT}                             ║
║   📡 Endpoint: POST /compile                               ║
║                                                            ║
║   ✅ CORS Enabled - Extension can connect                 ║
║   ✅ Ready to compile LaTeX to PDF                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

Prerequisites Check:
- Node.js: ✓ Running
- Express: ✓ Loaded
- CORS: ✓ Enabled

Next steps:
1. Make sure pdflatex is installed (run: pdflatex --version)
2. Update your extension to use http://localhost:${PORT}/compile
3. Send POST request with { "latex": "your content" }

Press Ctrl+C to stop the server
  `);

  // Check if pdflatex is available
  exec('pdflatex --version', (error, stdout) => {
    if (error) {
      console.error(`
⚠️  WARNING: pdflatex not found in PATH!

Please install a LaTeX distribution:
- macOS: brew install --cask mactex
- Linux: sudo apt-get install texlive-full
- Windows: Download MiKTeX from https://miktex.org/

After installation, restart this server.
      `);
    } else {
      console.log('✓ pdflatex found:', stdout.split('\n')[0]);
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n[Server] Shutting down gracefully...');
  // Clean up temp directory
  await fs.remove(TEMP_DIR);
  process.exit(0);
});
