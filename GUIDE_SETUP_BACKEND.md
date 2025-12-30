# Backend Setup Guide for DataVector

This guide explains how to set up the Google Apps Script backend which handles reliable file conversions.

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
    else if (data.action === "sanity_check") {
      var testBlob = Utilities.newBlob("Hello World", "application/msword", "test.doc");
      var data = { fileData: Utilities.base64Encode(testBlob.getBytes()), fileName: "SanityCheck.doc" };
      return convertFile(data, "document");
    }
    else {
       return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function convertFile(data, type) {
  var convertedId;
  
  if (typeof Drive === 'undefined') {
      throw new Error("CRITICAL ERROR: 'Drive API' Service is NOT enabled. Please click 'Services +' on the left and add 'Drive API'.");
  }

  try {
    var detectedMime = "application/octet-stream";
    var cleanBase64 = data.fileData.replace(/\s/g, ''); 
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, "application/octet-stream", data.fileName);
    
    // Determine Target
    var targetMime = (type === "presentation" ? "application/vnd.google-apps.presentation" : "application/vnd.google-apps.document");
    
    // SMART STRATEGY: Detect V2 vs V3
    var file;
    
    if (Drive.Files.insert) {
       // Drive API v2 (The 'insert' method)
       var resource = { title: data.fileName, mimeType: targetMime };
       file = Drive.Files.insert(resource, blob, { convert: true });
    } 
    else if (Drive.Files.create) {
       // Drive API v3 (The 'create' method)
       // V3 uses 'name' instead of 'title'
       var resource = { name: data.fileName, mimeType: targetMime }; 
       file = Drive.Files.create(resource, blob); 
    }
    else {
       throw new Error("Unknown Drive API version. Methods 'insert' and 'create' are missing.");
    }
    
    convertedId = file.id;

    // Export
    var pdfBlob = DriveApp.getFileById(convertedId).getAs('application/pdf');
    var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      pdf: pdfBase64, 
      name: data.fileName.replace(/\.(pptx|docx|doc)$/i, '.pdf')
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    throw new Error("Advanced Service Error: " + e.toString());
  } finally {
     if (convertedId) try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e){}
  }
}

function testBackend() {
  try {
    var blob = Utilities.newBlob("Hello World", "application/msword", "TEST_DOC.doc");
    var data = { 
       fileData: Utilities.base64Encode(blob.getBytes()), 
       fileName: "TEST_DOC.doc" 
    };
    var result = convertFile(data, "document");
    Logger.log("Test Success! PDF Length: " + result.getContent().length);
  } catch(e) {
    Logger.log("Test Failed: " + e.toString());
  }
}

function forceAuth() {
  UrlFetchApp.fetch("https://www.google.com");
  DriveApp.getRootFolder();
}
```

## 2. Enable Advanced Services (Critical!)
1.  In the Script Editor, click **Services +** (on the left sidebar).
2.  Select **Drive API**.
3.  Click **Add**.

## 3. Run Self-Test
1.  Select the **`testBackend`** function from the dropdown.
2.  Click **Run**.
3.  Check the **Execution Log**.
    *   If it says **"Test Success!"**, the backend is ready.
    *   If it says **"Drive API Service is NOT enabled"**, repeast Step 2.

## 4. Deploy
1.  Click **Deploy** > **Manage Deployments**.
2.  Click **Edit** (pencil icon).
3.  **New Version**.
4.  **Deploy**.
