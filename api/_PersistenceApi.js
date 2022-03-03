import { addOrUpdateSingleResponse, COLUMN_MAPPING, getSubscribers } from './_GoogleSheets.js';

const createUpdater = (column) => (id, value) => addOrUpdateSingleResponse({ id, column ,value })

export const storeName = createUpdater(COLUMN_MAPPING.NAME);
export const storeIsSafe = createUpdater(COLUMN_MAPPING.IS_SAFE);
export const storeLocation = createUpdater(COLUMN_MAPPING.LOCATION);
export const storeNeedAssistance = createUpdater(COLUMN_MAPPING.NEED_ASSISTANCE);

export {
    getSubscribers
}
