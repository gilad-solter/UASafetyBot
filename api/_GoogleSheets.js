import {
    GOOGLE_SERVICE_KEY,
    SHEET_DOC_ID,
    SHEET_SUBSCRIBERS_DOC_ID,
    SUBSCRIBERS_SHEET_NAME,
    TEMPLATE_SHEET_ID
} from './_config.js';
import { google } from 'googleapis';

const COLUMN_MAPPING = {
    ID: 'A',
    NAME: 'B',
    IS_SAFE: 'C',
    LOCATION: 'D',
    NEED_ASSISTANCE: 'E',
};

const getSheetName = () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return `${year}-${month}-${day}`;
}

const scopes = ['https://www.googleapis.com/auth/spreadsheets',];

const credential = JSON.parse(Buffer.from(GOOGLE_SERVICE_KEY, "base64").toString());
const { client_email, private_key } = credential;

const auth = new google.auth.GoogleAuth({
    scopes,
    credentials: {
        client_email,
        private_key
    },
});

// Acquire an auth client, and bind it to all future calls
const authClient = await auth.getClient();
google.options({ auth: authClient });

// Create Sheets instance
const sheets = google.sheets('v4');

const getExistingRowIndex = async (sheetName, id, spreadsheetId = SHEET_DOC_ID) => {
    const column = COLUMN_MAPPING.ID;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!${column}:${column}` // Only search the ID column
    });

    let existingRowIndex;
    response?.data?.values?.some((row, index) => {
        if (row[0] === id.toString()) {
            existingRowIndex = index + 1; // Convert to sheets index which starts at 1
        }
    });

    return existingRowIndex;
};

const generateRange = (sheetName, existingRowIndex, specificColumn) => {
    let range = sheetName;
    if (existingRowIndex) {
        range += '!' + (specificColumn || 'A') + existingRowIndex;
    }
    return range;
};

const commonParams = {
    spreadsheetId: SHEET_DOC_ID,
    valueInputOption: 'USER_ENTERED',
}

const addOrUpdate = async ({ id, name, answers }) => {
    const sheet = getSheetName();
    const existingRowIndex = await getExistingRowIndex(sheet, id);
    let range = generateRange(sheet, existingRowIndex);

    const updateMethod = existingRowIndex ? 'update' : 'append';
    const updateParams = {
        ...commonParams,
        range,
        requestBody: {
            values: [[id, name, ...answers]]
        }
    }
    await sheets.spreadsheets.values[updateMethod](updateParams);
}

const addOrUpdateSingle = async ({ id, column, value }) => {
    if(value === null || value === undefined) {
        console.warn('Empty value, not overwriting remote data.')
    }
    if(column === COLUMN_MAPPING.ID) {
        console.error('Cannot override ID, did you mean to pass a column mapping for a proper answer?')
    }

    const sheet = getSheetName();
    let existingRowIndex = await getExistingRowIndex(sheet, id);

    if(!existingRowIndex) {
        await addOrUpdate({ id, name: '', answers: ['', '', ''] });
        existingRowIndex = await getExistingRowIndex(sheet, id);
    }

    let range = generateRange(sheet, existingRowIndex, column);

    const updateParams = {
        ...commonParams,
        range,
        requestBody: {
            values: [[value]]
        }
    }
    await sheets.spreadsheets.values.update(updateParams);
}

const getOrCreateSheet = async () => {
    const sheetName = getSheetName();
    const response = await sheets.spreadsheets.get({ spreadsheetId: SHEET_DOC_ID });
    const existingSheet = response.data?.sheets.filter(sheet => sheet?.properties?.title === sheetName);
    if(existingSheet.length) {
        return existingSheet.sheetId;
    }

    const duplicationParams = {
        spreadsheetId: SHEET_DOC_ID,
        sheetId: TEMPLATE_SHEET_ID,
        resource: {
            destinationSpreadsheetId: SHEET_DOC_ID
        }
    };

    const duplicationResponse = await sheets.spreadsheets.sheets.copyTo(duplicationParams)
    const newSheetId = duplicationResponse?.data?.sheetId;

    const renameParams = {
        spreadsheetId: SHEET_DOC_ID,
        resource: {
            requests: [
                {
                    updateSheetProperties: {
                        properties: {
                            sheetId: newSheetId,
                            title: sheetName
                        },
                        fields: 'title'
                    }
                }
            ],
        }
    };

    await sheets.spreadsheets.batchUpdate(renameParams)
    return newSheetId;
}

const addSubscribedId = async (id) => {
    if(!id) {
        console.warn('Cannot subscribe; parameter \'id\' is missing. Did you forget to send it?');
        return;
    }
    let existingRowIndex = await getExistingRowIndex(SUBSCRIBERS_SHEET_NAME, id, SHEET_SUBSCRIBERS_DOC_ID);
    if(existingRowIndex) {
        return;
    }

    const appendParams = {
        spreadsheetId: SHEET_SUBSCRIBERS_DOC_ID,
        valueInputOption: 'USER_ENTERED',
        range: SUBSCRIBERS_SHEET_NAME,
        requestBody: {
            values: [[id]]
        }
    }
    await sheets.spreadsheets.values.append(appendParams);
}

const getSubscribedIds = async () => {
    const column = COLUMN_MAPPING.ID;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_SUBSCRIBERS_DOC_ID,
        range: `${SUBSCRIBERS_SHEET_NAME}!${column}:${column}` // Only search the ID column
    });

    return Array.from(new Set(response?.data?.values?.flat() || []));
};

const addOrUpdateUserResponses = async (params) => {
    try {
        await addSubscribedId(params?.id);
        await getOrCreateSheet();
        await addOrUpdate(params)
    }
    catch (exception) {
        console.error(exception);
    }
}

const addOrUpdateSingleResponse = async (params) => {
    try {
        await addSubscribedId(params?.id);
        await getOrCreateSheet();
        await addOrUpdateSingle(params)
    }
    catch (exception) {
        console.error(exception);
    }
}

const getSubscribers = async () => {
    try {
        return await getSubscribedIds();
    }
    catch (exception) {
        console.error(exception);
    }
}

export {
    addOrUpdateUserResponses,
    addOrUpdateSingleResponse,
    getSubscribers,
    COLUMN_MAPPING
}
