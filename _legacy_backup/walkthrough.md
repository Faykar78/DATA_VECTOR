# PPTX to PDF Conversion: Implementation Walkthrough

We have successfully implemented PPTX to PDF conversion. Initially attempted as a client-side feature using `PPTXjs`, we moved to a robust **Backend Architecture** using Google Apps Script (Drive API) to ensure high-quality, reliable results.

## 1. Architecture Overview
- **Frontend (`pdf-lib.js`)**: 
    - Reads the PPTX file as Base64.
    - Sends a `POST` request to the Google Apps Script Web App.
    - Receives a Base64 PDF response.
    - Creates a Blob and downloads it.
- **Backend (`backend/Code.gs`)**:
    - Hosted on Google Apps Script (Serverless).
    - Decodes the Base64 file.
    - Uses `Drive.Files.insert` to upload and convert to Google Slides.
    - Uses `DriveApp` to export the slides as PDF.
    - Returns the PDF data to the frontend.

## 2. Key Files
- `js/tools/pdf-lib.js`: Contains the client-side fetch logic.
- `js/app.js`: Contains the global configuration `window.GOOGLE_SCRIPT_URL`.
- `backend/Code.gs`: The server-side code (for reference/deployment).
- `GUIDE_SETUP_BACKEND.md`: Instructions for setting up the backend.

## 3. How to Update Backend
If you need to change logic (e.g., file naming, storage folder):
1. Edit `backend/Code.gs` locally.
2. Copy content to script.google.com project.
3. **Deploy -> New Deployment**.
4. (If URL changes) Update `js/app.js`.

## 4. Verification
- **Test Case**: Convert a PPTX file.
- **Expected Result**: 
    1. UI says "Converting on Server...".
    2. After ~5-10 seconds, a PDF downloads.
    3. The PDF matches the original layout (fonts/images preserved).
