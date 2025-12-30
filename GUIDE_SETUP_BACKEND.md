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
  var tempId;
  
  try {
    var detectedMime = "application/octet-stream";
    var token = ScriptApp.getOAuthToken();
    var cleanBase64 = data.fileData.replace(/\s/g, ''); 
    var decoded = Utilities.base64Decode(cleanBase64);
    
    // Determine Target
    var targetMime = (type === "presentation" ? "application/vnd.google-apps.presentation" : "application/vnd.google-apps.document");
    
    // Strategy: Drive.Files.insert (Advanced Service)
    // This is the most reliable method if the service is enabled.
    try {
       if (typeof Drive !== 'undefined') {
          var blob = Utilities.newBlob(decoded, "application/octet-stream", data.fileName);
          var resource = { title: data.fileName, mimeType: targetMime };
          var file = Drive.Files.insert(resource, blob, { convert: true });
          convertedId = file.id;
       } 
       else {
          throw new Error("Drive Service Not Enabled");
       }
    } catch (advErr) {
       // Fallback: V2 Multipart REST (Manual)
       // Use generic msword/octet to avoid strict validation errors
       var blob = Utilities.newBlob(decoded, "application/msword", data.fileName);
       
       var boundary = "xxxxxxxxxx";
       var metadata = { title: data.fileName, mimeType: targetMime };
       var payload = 
         "--" + boundary + "\r\n" + 
         "Content-Type: application/json; charset=UTF-8\r\n\r\n" + 
         JSON.stringify(metadata) + "\r\n" + 
         "--" + boundary + "\r\n" + 
         "Content-Type: application/msword\r\n" + 
         "Content-Transfer-Encoding: base64\r\n\r\n" + 
         cleanBase64 + "\r\n" + 
         "--" + boundary + "--";

       var url = "https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true";
       var res = UrlFetchApp.fetch(url, {
          method: 'post',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': "multipart/related; boundary=" + boundary },
          payload: payload,
          muteHttpExceptions: true
       });
       
       if (res.getResponseCode() >= 400) {
          // If this fails, try uploading NATIVE then COPYING (V3)
          throw new Error("REST Upload Failed: " + res.getContentText());
       }
       convertedId = JSON.parse(res.getContentText()).id;
    }

    // Export
    var pdfBlob = DriveApp.getFileById(convertedId).getAs('application/pdf');
    var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      pdf: pdfBase64, 
      name: data.fileName.replace(/\.(pptx|docx|doc)$/i, '.pdf')
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    throw new Error("Conversion Failed: " + e.toString());
  } finally {
     if (convertedId) try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e){}
  }
}

// SELF TEST FUNCTION - Run this in Editor!
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
    *   *This enables the powerful `Drive.Files` tools.*

## 3. Run Self-Test
1.  Select the **`testBackend`** function from the dropdown.
2.  Click **Run**.
3.  Check the **Execution Log**.
    *   If it says **"Test Success!"**, then your backend is perfect. The issue is likely your specific DOCX file.
    *   If it fails, then there is a permissions/account issue.

## 4. Deploy
1.  Click **Deploy** > **Manage Deployments**.
2.  Click **Edit** (pencil icon).
3.  **New Version**.
4.  **Deploy**.
