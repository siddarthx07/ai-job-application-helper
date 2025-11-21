# LaTeX Compilation Server

A local server for compiling LaTeX documents to PDF for the AutoFiller Chrome extension.

## Prerequisites

### 1. Node.js
Make sure you have Node.js installed:
```bash
node --version
```

If not installed, download from: https://nodejs.org/

### 2. LaTeX Distribution

You need a LaTeX distribution installed with `pdflatex` command available.

**macOS:**
```bash
brew install --cask mactex
# OR for a smaller installation
brew install --cask basictex
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install texlive-full
# OR for minimal installation
sudo apt-get install texlive-latex-base texlive-fonts-recommended
```

**Windows:**
Download and install MiKTeX from: https://miktex.org/download

**Verify installation:**
```bash
pdflatex --version
```

## Setup

1. **Install dependencies:**
```bash
cd latex-server
npm install
```

2. **Start the server:**
```bash
npm start
```

You should see:
```
🚀 LaTeX Compilation Server Running
📍 URL: http://localhost:3000
```

## Usage

The server exposes a single endpoint:

**POST /compile**

Request body:
```json
{
  "latex": "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}"
}
```

Response (success):
```json
{
  "success": true,
  "pdfDataUrl": "data:application/pdf;base64,...",
  "size": 12345
}
```

Response (error):
```json
{
  "success": false,
  "error": "Compilation error message",
  "log": "LaTeX compilation log..."
}
```

## Testing

**Test with curl:**
```bash
curl -X POST http://localhost:3000/compile \
  -H "Content-Type: application/json" \
  -d '{"latex":"\\documentclass{article}\\begin{document}Hello World\\end{document}"}'
```

**Test with browser console:**
```javascript
fetch('http://localhost:3000/compile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    latex: '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}'
  })
})
.then(r => r.json())
.then(data => console.log(data));
```

## Configuration

Edit `server.js` to change:
- **Port:** Change `const PORT = 3000;` to your preferred port
- **Temp directory:** Change `const TEMP_DIR` path
- **Request size limit:** Change `limit: '10mb'` in middleware

## Troubleshooting

### "pdflatex not found"
Make sure LaTeX is installed and in your PATH. Restart your terminal/server after installation.

### "Permission denied" errors
Make sure the temp directory has write permissions:
```bash
chmod 755 temp/
```

### Port already in use
Change the PORT in server.js or kill the process using port 3000:
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### LaTeX compilation errors
Check the error log in the response. Common issues:
- Missing LaTeX packages - install with `tlmgr install <package>`
- Syntax errors in LaTeX source
- Special characters not escaped

## Development

**Run with auto-reload:**
```bash
npm run dev
```

Uses nodemon to automatically restart the server when files change.

## Security Notes

⚠️ **This server is for LOCAL DEVELOPMENT ONLY**

- CORS is wide open (`*`)
- No authentication
- No rate limiting
- Executes arbitrary LaTeX code

**DO NOT expose this server to the internet without:**
- Adding authentication
- Implementing rate limiting
- Sandboxing LaTeX execution
- Validating and sanitizing input
- Using HTTPS

## Production Deployment

For production, consider:
1. Deploy to a cloud service (AWS, Google Cloud, Heroku)
2. Add authentication (API keys)
3. Use Docker for isolation
4. Add monitoring and logging
5. Implement request queuing
6. Set up proper error handling

Example Dockerfile:
```dockerfile
FROM ubuntu:latest
RUN apt-get update && apt-get install -y texlive-full nodejs npm
COPY . /app
WORKDIR /app
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
```
