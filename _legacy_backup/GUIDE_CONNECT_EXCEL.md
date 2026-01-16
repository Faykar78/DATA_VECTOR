# How to Connect Your Feedback Form to Excel (Google Sheets)

Since your website is static (hosted on Cloudflare), it cannot write directly to a file on your computer. The professional way to store data is to use a **Google Sheet** as your database.

Follow these steps to connect your "Excel ID":

## Step 1: Create the Sheet
1.  Go to [Google Sheets](https://sheets.google.com).
2.  Create a **New Spreadsheet**.
3.  Name it **"DataVector Feedback"**.
4.  In the first row, add these headers:
    *   **Column A**: `Timestamp`
    *   **Column B**: `Type`
    *   **Column C**: `Message`

## Step 2: Create the Script
1.  In the spreadsheet, click **Extensions** > **Apps Script**.
2.  Delete any code in the `Code.gs` file and paste this EXACT code:

```javascript
/* RECEIVE DATA AND SAVE TO SHEET (ROBUST VERSION) */
var SHEET_NAME = "Sheet1"; // Change if your sheet has a different name

/* HANDLE BROWSER VISITS (GET REQUESTS) */
function doGet(e) {
  return ContentService.createTextOutput("✅ API is Live! Use POST requests to submit data.").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait 10s for other users

  try {
    // FIX: getActiveSheet() can be unreliable in background scripts. Use the first sheet.
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    
    // 1. PARSE DATA (Handle Form Data OR JSON)
    var params = {};
    
    if (e.parameter && Object.keys(e.parameter).length > 0) {
      params = e.parameter; // Form Data
    } else if (e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents); // JSON
      } catch(err) {
        // Failed to parse JSON, maybe it's raw text
        params = { message: e.postData.contents };
      }
    }
    
    // 2. SAVE TO SHEET
    var timestamp = new Date();
    var type = params.type || "General";
    var message = params.message || "No message content";
    
    sheet.appendRow([timestamp, type, message]);
    
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
    
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
    
  } finally {
    lock.releaseLock();
  }
}
```

3.  Click the **Save** icon (disk).

## Step 3: Deploy as Web API
1.  Click the blue **Deploy** button (top right) > **New deployment**.
2.  Click the **Gear Icon** (Select type) > **Web app**.
3.  **Description**: `Feedback API`.
4.  **Execute as**: `Me`.
5.  **Who has access**: **Anyone** (IMPORTANT! Must be "Anyone" or the form won't work).
6.  Click **Deploy**.
7.  Copy the **Web app URL** (it ends in `/exec`).

## Step 4: Connect to Your Website
1.  Open `d:/works/DATAVECTOR/js/app.js`.
2.  Find line 6: `const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';`
3.  Paste your copied URL inside the quotes.

**Done!** Now every time someone submits the form on your homepage, it will instantly appear in your Google Sheet (which you can export to Excel anytime).
