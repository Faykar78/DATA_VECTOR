// Google Apps Script Code for DataVector Backend
// Deploy this as a Web App (Execute as: Me, Who has access: Anyone)

function doPost(e) {
  DriveApp.getRootFolder(); // Scope trigger
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
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
  } finally {
    lock.releaseLock();
  }
}

function convertFile(data, type) {
  var convertedId;
  try {
    // 1. Determine Source MimeType Correctly
    var sourceMime = "application/octet-stream";
    if (type === "presentation") sourceMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (type === "document") {
       if (data.fileName.toLowerCase().endsWith(".doc")) sourceMime = "application/msword";
       else sourceMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    // 2. Prepare Blob
    // Ensure Base64 is clean
    var cleanBase64 = data.fileData.replace(/\s/g, ''); 
    var blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), sourceMime, data.fileName);
    var token = ScriptApp.getOAuthToken();

    // STRATEGY: Simple Media Upload V2 (Raw Binary + Convert Flag)
    // Minimizes metadata errors.
    var url = "https://www.googleapis.com/upload/drive/v2/files?uploadType=media&convert=true";
    
    var response = UrlFetchApp.fetch(url, {
       method: 'post',
       headers: { 
          'Authorization': 'Bearer ' + token, 
          'Content-Type': sourceMime // Tells Google what we are sending
       },
       payload: blob, // Send raw body
       muteHttpExceptions: true
    });
    
    if (response.getResponseCode() >= 400) throw new Error("Upload Error: " + response.getContentText());
    
    var json = JSON.parse(response.getContentText());
    convertedId = json.id;
    
    // 3. Rename (Optional, but good for debugging in Drive)
    try { DriveApp.getFileById(convertedId).setName(data.fileName); } catch(e){}
    
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
    if (convertedId) try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e){}
  }
}
function doGet(e) {
  return ContentService.createTextOutput("DataVector Backend is Running.");
}
function forceAuth() {
  UrlFetchApp.fetch("https://www.google.com");
  DriveApp.getRootFolder();
}
