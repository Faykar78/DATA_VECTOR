// Google Apps Script Code for DataVector Backend
// Deploy this as a Web App (Execute as: Me, Who has access: Anyone)

function doPost(e) {
  // Ensure DriveApp is used to trigger scope
  DriveApp.getRootFolder(); 
  
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
      return convertFile(data, "presentation", "application/vnd.google-apps.presentation");
    } 
    else if (data.action === "convert_word") {
      return convertFile(data, "document", "application/vnd.google-apps.document");
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
    // 1. Determine Source MimeType
    var sourceMime = "application/octet-stream";
    if (type === "presentation") sourceMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (type === "document") {
       if (data.fileName.toLowerCase().endsWith(".doc")) sourceMime = "application/msword";
       else sourceMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    // 2. Upload using Standard DriveApp (No Advanced Service needed)
    var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), sourceMime, data.fileName);
    var tempFile = DriveApp.createFile(blob);
    tempId = tempFile.getId();
    
    // 3. Convert using Direct REST API (Bypassing GAS Wrapper confusion)
    var token = ScriptApp.getOAuthToken();
    var url = "https://www.googleapis.com/drive/v3/files/" + tempId + "/copy";
    
    var response = UrlFetchApp.fetch(url, {
       method: 'post',
       headers: {
         'Authorization': 'Bearer ' + token,
         'Content-Type': 'application/json'
       },
       payload: JSON.stringify({
         name: data.fileName,
         mimeType: targetMimeType // Trigger conversion
       }),
       muteHttpExceptions: true
    });
    
    if (response.getResponseCode() >= 400) {
        throw new Error("Drive API Error: " + response.getContentText());
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
    if (tempId) DriveApp.getFileById(tempId).setTrashed(true);
    if (convertedId) DriveApp.getFileById(convertedId).setTrashed(true);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("DataVector Backend is Running.");
}
