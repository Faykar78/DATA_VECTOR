// Google Apps Script Code for DataVector Backend
// Deploy this as a Web App (Execute as: Me, Who has access: Anyone)

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s for lock

  try {
    var data = {};
    
    // Parse Input
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }

    // --- ROUTER ---
    
    // 1. PPTX to PDF Conversion
    if (data.action === "convert_pptx") {
      return convertPPTX(data);
    } 
    
    // 2. Feedback / Contact Form (Append to Sheet)
    else {
       // Default to Sheet 1
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
       sheet.appendRow([
         new Date(), 
         data.type || "General", 
         data.message || JSON.stringify(data),
         data.contact || ""
       ]);
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
  try {
    // 1. Decode Base64 File
    var blob = Utilities.newBlob(
      Utilities.base64Decode(data.fileData), 
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", 
      data.fileName
    );
    
    // 2. Save to Drive (converts to Google Slides automatically? No, need to specify MimeType)
    // Actually, inserting with MimeType.GOOGLE_SLIDES triggers conversion
    var resource = { 
      title: data.fileName, 
      mimeType: MimeType.GOOGLE_SLIDES 
    };
    
    // Enable Drive API in Services!
    var file = Drive.Files.insert(resource, blob);
    
    // 3. Export as PDF
    var fileId = file.id;
    var pdfBlob = DriveApp.getFileById(fileId).getAs('application/pdf');
    var pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());
    
    // 4. Cleanup (Delete temp file)
    DriveApp.getFileById(fileId).setTrashed(true);
    
    // 5. Return Result
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      pdf: pdfBase64,
      name: data.fileName.replace('.pptx', '.pdf')
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (e) {
    throw new Error("Conversion Failed: " + e.toString());
  }
}

function doGet(e) {
  return ContentService.createTextOutput("DataVector Backend is Running.");
}
