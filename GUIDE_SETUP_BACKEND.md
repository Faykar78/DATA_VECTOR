# Backend Setup Guide for DataVector

This guide explains how to set up the Google Apps Script backend which handles reliable file conversions (PPTX/Word to PDF).

## 1. Create the Script
1.  Go to [script.google.com](https://script.google.com/) and create a **New Project**.
2.  Name it "DataVector Backend".
3.  Delete any code in `Code.gs` and paste the following:

```javascript
// Google Apps Script Code for DataVector Backend
// Deploy this as a Web App (Execute as: Me, Who has access: Anyone)

function doPost(e) {
  try {
    DriveApp.getRootFolder(); // Scope trigger
    
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } 

    if (data.action === "convert_pptx") {
      return convertFile(data, "presentation");
    } 
    else if (data.action === "convert_word") {
      return convertFile(data, "document");
    }
    else {
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
       sheet.appendRow([new Date(), data.type || "General", data.message || JSON.stringify(data), data.contact || ""]);
       return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function convertFile(data, type) {
  var tempId;
  try {
    // 1. Strict MIME Mapping
    var ext = data.fileName.split('.').pop().toLowerCase();
    var sourceMime = "application/octet-stream";
    
    // Strict mimes help DriveApp understand the file
    if (ext === "docx") sourceMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (ext === "doc") sourceMime = "application/msword";
    else if (ext === "pptx") sourceMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    // 2. Create Temp File via DriveApp (Native Upload)
    var cleanBase64 = data.fileData.replace(/\s/g, ''); 
    var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), sourceMime, data.fileName);
    var tempFile = DriveApp.createFile(blob);
    tempId = tempFile.getId();
    
    // 3. Direct PDF Export via DriveApp
    // This attempts to use Drive's internal export engine without explicit API calls
    try {
      var pdfBlob = tempFile.getAs('application/pdf');
      var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        pdf: pdfBase64, 
        name: data.fileName.replace(/\.(pptx|docx|doc)$/i, '.pdf')
      })).setMimeType(ContentService.MimeType.JSON);
      
    } catch (exportErr) {
       // If Direct Export fails, throw specific error with MIME info
       throw new Error("Direct Export Failed: " + exportErr.toString() + " (Mime: " + tempFile.getMimeType() + ")");
    }
    
  } catch (e) {
    throw new Error("Conversion Failed: " + e.toString());
  } finally {
    if (tempId) try { DriveApp.getFileById(tempId).setTrashed(true); } catch(e){}
  }
}

function doGet(e) {
  return ContentService.createTextOutput("DataVector Backend is Running.");
}
function forceAuth() {
  UrlFetchApp.fetch("https://www.google.com");
  DriveApp.getRootFolder();
}
```

## 2. Authorization
1.  **Save** the file.
2.  Select `forceAuth` function in the dropdown.
3.  Click **Run**.
4.  Accept permissions.

## 3. Enable Drive API Service (Still Recommended)
Although this script uses `UrlFetchApp`, it's best practice to:
1.  Click **Services +** on the left.
2.  Add **Drive API**.

## 4. Deploy
1.  Click **Deploy** > **Manage Deployments**.
2.  Click **Edit** (pencil icon).
3.  **New Version**.
4.  **Deploy**.
