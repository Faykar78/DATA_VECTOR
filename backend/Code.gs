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
    if (type === "presentation") {
       sourceMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }
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

function doGet(e) {
  return ContentService.createTextOutput("DataVector Backend is Running.");
}
