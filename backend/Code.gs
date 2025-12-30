// Google Apps Script Code for DataVector Backend
// Deploy this as a Web App (Execute as: Me, Who has access: Anyone)

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
    
    // 1. PPTX to PDF
    if (data.action === "convert_pptx") {
      return convertFile(data, "presentation", MimeType.GOOGLE_SLIDES);
    } 
    // 2. Word to PDF (New)
    else if (data.action === "convert_word") {
      return convertFile(data, "document", MimeType.GOOGLE_DOCS);
    }
    
    // 3. Feedback / General
    else {
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
       sheet.appendRow([new Date(), data.type || "General", data.message || JSON.stringify(data), data.contact || ""]);
       return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
    }
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function convertFile(data, type, targetMimeType) {
  try {
    // Determine Source MimeType
    var sourceMime = "application/octet-stream";
    if (type === "presentation") sourceMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (type === "document") {
       if (data.fileName.toLowerCase().endsWith(".doc")) sourceMime = "application/msword";
       else sourceMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    // 1. Decode Base64
    var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), sourceMime, data.fileName);
    
    // 2. Save & Convert (Support v2 and v3)
    var file;
    if (Drive.Files.insert) {
      // v2
      var resource = { title: data.fileName, mimeType: targetMimeType };
      file = Drive.Files.insert(resource, blob);
    } else if (Drive.Files.create) {
      // v3
      var resource = { name: data.fileName, mimeType: targetMimeType };
      file = Drive.Files.create(resource, blob);
    } else {
      throw new Error("Drive API not found. Please add 'Drive API' in Services.");
    }
    
    // 3. Export as PDF
    var fileId = file.id;
    var pdfBlob = DriveApp.getFileById(fileId).getAs('application/pdf');
    var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
    
    // 4. Cleanup
    DriveApp.getFileById(fileId).setTrashed(true);
    
    // 5. Return
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      pdf: pdfBase64, 
      name: data.fileName.replace(/\.(pptx|docx|doc)$/i, '.pdf')
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (e) {
    throw new Error("Conversion Failed: " + e.toString());
  }
}

function doGet(e) {
  return ContentService.createTextOutput("DataVector Backend is Running.");
}
