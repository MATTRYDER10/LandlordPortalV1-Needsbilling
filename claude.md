# Claude Development Notes

## Starting Dev Servers

The project has both frontend and backend in separate directories:
- **Frontend**: `/frontend` directory (Vue 3 + Vite + TypeScript)
- **Backend**: `/backend` directory (Express + Node + TypeScript)

### Correct way to start both servers:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
This starts the backend on port 3001.

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
This starts the frontend on port 5173.

### Important Notes:
- **MUST open separate terminal windows** - Claude Code has issues starting frontend in background mode
- Frontend dev command `npm run dev` works fine in a regular terminal but exits immediately when run in background by Claude
- Backend runs fine in background mode with Claude
- Frontend URL: http://localhost:5173/
- Backend URL: http://localhost:3001/

### Backend
- Port: 3001
- Directory: `/backend`
- Command: `npm run dev`
- Uses nodemon with ts-node
- Can be started in background by Claude

### Frontend
- Port: 5173
- Directory: `/frontend`
- Command: `npm run dev`
- Vue 3 + Vite + TypeScript
- **Must be started manually in a new terminal** - does NOT work in Claude's background mode

## Email Templates

All emails MUST use the styled HTML template format located in `/backend/email-templates/`.

### Email Template Guidelines:
1. **Use the existing template structure** - Copy from `tenant-reference-request.html` or other templates
2. **Consistent branding** - PropertyGoose logo, orange accent color (#f97316), professional styling
3. **HTML table layout** - For maximum email client compatibility
4. **Include these elements**:
   - Header with PropertyGoose logo and branding
   - Clear subject/title
   - Main content with proper spacing
   - Footer with copyright and automated message notice
5. **Template variables** - Use `{{ VariableName }}` format for dynamic content
6. **Load templates** - Use `loadEmailTemplate('template-name', { Variables })` in emailService.ts
7. **Never use inline HTML** - Always create a separate .html template file

### Example Template Structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Subject - PropertyGoose</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <!-- See existing templates for full structure -->
</body>
</html>
```

All new email templates must follow this pattern for consistency and professional appearance.
