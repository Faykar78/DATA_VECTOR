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
    var data = JSON.parse(e.postData.contents);
    
    // --- Router ---
    if (data.action === "convert_pptx") {
      return convertPPTX(data);
    } 
    // Fallback for simple feedback
    else {
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
       sheet.appendRow([new Date(), data.type || "General", data.message || JSON.stringify(data)]);
       return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
    }
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function convertPPTX(data) {
  // 1. Decode File
  var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), "application/vnd.openxmlformats-officedocument.presentationml.presentation", data.fileName);
  
  // 2. Save to Drive & Convert
  // Support both Drive API v2 (insert) and v3 (create)
  var file;
  if (Drive.Files.insert) {
    // API v2
    var resource = { title: data.fileName, mimeType: MimeType.GOOGLE_SLIDES };
    file = Drive.Files.insert(resource, blob);
  } else if (Drive.Files.create) {
    // API v3
    var resource = { name: data.fileName, mimeType: MimeType.GOOGLE_SLIDES };
    file = Drive.Files.create(resource, blob);
  } else {
    throw new Error("Drive API not found. Please add 'Drive API' in Services.");
  }
  
  // 3. Export as PDF
  var fileId = file.id;
  var pdfBlob = DriveApp.getFileById(fileId).getAs('application/pdf');
  var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
  
  // 4. Cleanup (Delete temp file)
  DriveApp.getFileById(fileId).setTrashed(true);
  
  // 5. Return Request
  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'success', 
    pdf: pdfBase64,
    name: data.fileName.replace('.pptx', '.pdf')
  })).setMimeType(ContentService.MimeType.JSON);
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
