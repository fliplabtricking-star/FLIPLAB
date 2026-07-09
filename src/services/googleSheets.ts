import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Define the path to the credentials JSON file
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// Replace this with the actual Spreadsheet ID after the user creates it
// It can also be loaded from process.env
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || 'YOUR_SPREADSHEET_ID_HERE';

export async function appendSubscriberToSheet(subscriberData: {
  date: string;
  id: string;
  fullName: string;
  age: number;
  gender: string;
  whatsappNumber: string;
  classType: string;
  packageType: string;
}) {
  try {
    // Check if credentials file exists
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.warn('Google Sheets Integration skipped: credentials.json not found in project root.');
      return;
    }

    if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
      console.warn('Google Sheets Integration skipped: SPREADSHEET_ID is not configured in src/services/googleSheets.ts.');
      return;
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client as any });

    const values = [
      [
        subscriberData.date,
        subscriberData.id,
        subscriberData.fullName,
        subscriberData.age,
        subscriberData.gender,
        subscriberData.whatsappNumber,
        subscriberData.classType,
        subscriberData.packageType,
      ]
    ];

    const resource = {
      values,
    };

    // We assume the sheet is named "Sheet1" and we append to it
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:H', // A to H columns
      valueInputOption: 'USER_ENTERED',
      requestBody: resource,
    });

    console.log('Appended row to Google Sheet:', result.data.updates?.updatedRange);
  } catch (error) {
    console.error('Error appending to Google Sheet:', error);
  }
}
