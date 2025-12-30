# 🛠️ Setup Backend for High-Quality Conversion

Since client-side conversion is limited, we will use **Google Apps Script** (Free & Robust) to handle PPTX-to-PDF conversion.

## 1. Create the Script
1. Go to [script.google.com](https://script.google.com/).
2. Click **New Project**.
3. Replace the `Code.gs` content with the following:

```javascript
function doPost(e) {
  DriveApp.getRootFolder(); // Scope trigger
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
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
  } finally {
    lock.releaseLock();
  }
}

function convertFile(data, type) {
  var tempId, convertedId;
  try {
    // 1. Determine Source MimeType
    var sourceMime = "application/octet-stream";
    if (type === "presentation") sourceMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (type === "document") {
       if (data.fileName.toLowerCase().endsWith(".doc")) sourceMime = "application/msword";
       else sourceMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    // 2. Upload using Standard DriveApp
    var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), sourceMime, data.fileName);
    var tempFile = DriveApp.createFile(blob);
    tempId = tempFile.getId();
    
    // 3. Convert using Drive API V2 REST (Explicit convert=true is more reliable than V3)
    var token = ScriptApp.getOAuthToken();
    var url = "https://www.googleapis.com/drive/v2/files/" + tempId + "/copy?convert=true";
    
    var response = UrlFetchApp.fetch(url, {
       method: 'post',
       headers: {
         'Authorization': 'Bearer ' + token,
         'Content-Type': 'application/json'
       },
       payload: JSON.stringify({
         title: data.fileName.replace(/\.[^/.]+$/, "") // Remove extension for Google Doc title
       }),
       muteHttpExceptions: true
    });
    
    if (response.getResponseCode() >= 400) {
        throw new Error("Drive API v2 Error: " + response.getContentText());
    }
    
    var json = JSON.parse(response.getContentText());
    convertedId = json.id;
    
    // 4. Export as PDF
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
    // Cleanup
    if (tempId) try { DriveApp.getFileById(tempId).setTrashed(true); } catch(e){}
    if (convertedId) try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e){}
  }
}
```

## 2. Enable Drive API service
1. On the left sidebar, click the **"+"** next to **Services**.
2. Select **Drive API**.
3. Click **Add**.

## 3. Deploy
1. Click **Deploy** (Top Right) > **New Deployment**.
2. Select type: **Web app**.
3. Description: `PPTX Backend`.
4. Execute as: **Me**.
5. Who has access: **Anyone** (Critical!).
6. Click **Deploy**.
7. **Copy the Web App URL** (ends in `/exec`).

## 4. Connect to DataVector
1. Open `js/app.js` in your project.
2. Replace `const GOOGLE_SCRIPT_URL` with your **NEW** URL.
