# 🛠️ Setup Backend for High-Quality Conversion

Since client-side conversion is limited, we will use **Google Apps Script** (Free & Robust) to handle PPTX-to-PDF conversion.

## 1. Create the Script
1. Go to [script.google.com](https://script.google.com/).
2. Click **New Project**.
3. Replace the `Code.gs` content with the following:

```javascript
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }

    // --- ROUTER ---
    if (data.action === "convert_pptx") {
      return convertFile(data, "presentation", MimeType.GOOGLE_SLIDES);
    } 
    else if (data.action === "convert_word") {
      return convertFile(data, "document", MimeType.GOOGLE_DOCS);
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

function convertFile(data, type, targetMimeType) {
  var tempId, convertedId;
  try {
    // Determine Source MimeType
    var sourceMime = "application/octet-stream";
    if (type === "presentation") sourceMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (type === "document") {
       if (data.fileName.toLowerCase().endsWith(".doc")) sourceMime = "application/msword";
       else sourceMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), sourceMime, data.fileName);
    
    // STRATEGY: 2-Step (Upload Native -> Copy to Google Format) to avoid V3 creation errors
    
    // 1. Upload Native File
    var tempFile;
    if (Drive.Files.insert) {
      tempFile = Drive.Files.insert({title: data.fileName, mimeType: sourceMime}, blob);
    } else {
      tempFile = Drive.Files.create({name: data.fileName, mimeType: sourceMime}, blob);
    }
    tempId = tempFile.id;
    
    // 2. Convert via Copy
    var copyResource = { 
      name: data.fileName, 
      mimeType: targetMimeType // Use Google MIME type to force conversion
    };
    if (Drive.Files.insert) copyResource.title = copyResource.name; // V2 compat
    
    var convertedFile = Drive.Files.copy(copyResource, tempId);
    convertedId = convertedFile.id;
    
    // 3. Export as PDF
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
    // Cleanup BOTH files
    if (tempId) DriveApp.getFileById(tempId).setTrashed(true);
    if (convertedId) DriveApp.getFileById(convertedId).setTrashed(true);
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
