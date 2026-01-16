# Backend Setup Guide for DataVector

This guide explains how to set up the Google Apps Script backend for file conversions.

## 1. Create the Script
1.  Go to [script.google.com](https://script.google.com/) and create a **New Project**.
2.  Name it "DataVector Backend".
3.  Delete any code in `Code.gs` and paste the code from `backend/Code.gs`.

## 2. Enable Advanced Services
1.  Click **Services +** (left sidebar).
2.  Select **Drive API**.
3.  Click **Add**.

## 3. Run Diagnostic Test
**CRITICAL STEP**: Before deploying, verify the system works:

1.  Select **`testBackend`** from the function dropdown. 2.  Click **Run**.
3.  Check **Execution log** (View → Logs):
    *   ✅ **"TEST SUCCESS"**: System works! Any errors are file-specific.
    *   ❌ **"TEST FAILED"**: Account/permission issue.

## 4. Deploy
1.  Click **Deploy** > **Manage Deployments**.
2.  Click **Edit** (pencil icon).
3.  **New Version**.
4.  **Deploy**.

## Troubleshooting

If conversion fails with **"FILE REJECTED"**:
- Your specific file cannot be converted by Google Drive
- Common causes: Password-protected, corrupted, incompatible features
- **Solutions:**
  1. Try a different DOCX file
  2. Open in Word and Save As a new file
  3. Create a simple test file with just "Hello World" text
  4. Remove password protection if present
