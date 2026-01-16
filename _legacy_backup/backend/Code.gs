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
       return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function convertFile(data, type) {
  var convertedId;
  
  if (typeof Drive === 'undefined') {
      throw new Error("CRITICAL: Drive API Service NOT enabled. Click 'Services +' and add 'Drive API'.");
  }

  try {
    var cleanBase64 = data.fileData.replace(/\s/g, ''); 
    var decoded = Utilities.base64Decode(cleanBase64);
    
    // Determine MIME types
    var ext = data.fileName.split('.').pop().toLowerCase();
    var sourceMime = "application/octet-stream";
    if (ext === "docx") sourceMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (ext === "doc") sourceMime = "application/msword";
    else if (ext === "pptx") sourceMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    var blob = Utilities.newBlob(decoded, sourceMime, data.fileName);
    var targetMime = (type === "presentation" ? "application/vnd.google-apps.presentation" : "application/vnd.google-apps.document");
    
    // Try conversion based on API version
    var file;
    
    if (Drive.Files.insert) {
       // V2 API
       file = Drive.Files.insert({ title: data.fileName, mimeType: targetMime }, blob, { convert: true });
    } 
    else if (Drive.Files.create) {
       // V3 API - Direct conversion during create
       file = Drive.Files.create({ name: data.fileName, mimeType: targetMime }, blob);
    }
    else {
       throw new Error("Unknown Drive API version.");
    }
    
    convertedId = file.id;

    // Export to PDF
    var pdfBlob = DriveApp.getFileById(convertedId).getAs('application/pdf');
    var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      pdf: pdfBase64, 
      name: data.fileName.replace(/\.(pptx|docx|doc)$/i, '.pdf')
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    var errMsg = e.toString();
    if (errMsg.indexOf("Bad Request") > -1 || errMsg.indexOf("Conversion") > -1) {
       throw new Error("FILE REJECTED: Google Drive refuses to convert '" + data.fileName + "'. This file may be password-protected, corrupted, or use unsupported features. Try: (1) Run testBackend() to verify system works (2) Use a different/simpler DOCX file (3) Open in Word and Save As new file.");
    }
    throw new Error("Conversion Error: " + errMsg);
  } finally {
     if (convertedId) try { DriveApp.getFileById(convertedId).setTrashed(true); } catch(e){}
  }
}

// DIAGNOSTIC: Run this in the editor to test if conversion works at all
function testBackend() {
  try {
    // Create simple test doc
    var blob = Utilities.newBlob("Hello World Test Document", "application/msword", "TEST.doc");
    var data = { 
       fileData: Utilities.base64Encode(blob.getBytes()), 
       fileName: "TEST.doc" 
    };
    var result = convertFile(data, "document");
    Logger.log("✅ TEST SUCCESS! System CAN convert files. Your uploaded file is the issue.");
    Logger.log("PDF Length: " + result.getContent().length + " bytes");
    return "SUCCESS";
  } catch(e) {
    Logger.log("❌ TEST FAILED: " + e.toString());
    Logger.log("This means your Google account/setup has an issue, not just the file.");
    return "FAILED";
  }
}

function forceAuth() {
  UrlFetchApp.fetch("https://www.google.com");
  DriveApp.getRootFolder();
}
