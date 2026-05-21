const SPREADSHEET_ID = '1xmgrvnGgZA71YPOOHQET9hyY0A1PMqz1Z0tXOv6RjcE';
const LOGIN_SHEET_NAME = 'login';
const SAVE_SHEET_NAME = 'save';
const PALM_SHEET_NAME = 'palm';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = body.action;

    if (action === 'createAccount') return jsonResponse(createAccount_(body));
    if (action === 'login') return jsonResponse(login_(body));
    if (action === 'save') return jsonResponse(save_(body));

    return jsonResponse({ ok: false, message: '알 수 없는 요청입니다.' });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || String(error) });
  }
}

function doGet() {
  return jsonResponse({ ok: true, message: 'Circle Battle Tower Rebuild save API is running.' });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getBook_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet_(name, headers) {
  const book = getBook_();
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const values = range.getValues()[0];
  let needsUpdate = false;

  headers.forEach((header, index) => {
    if (values[index] !== header) needsUpdate = true;
  });

  if (needsUpdate) range.setValues([headers]);
}

function getLoginSheet_() {
  return getSheet_(LOGIN_SHEET_NAME, ['id', 'pw', 'role', 'createdAt', 'lastLoginAt']);
}

function getSaveSheet_() {
  return getSheet_(SAVE_SHEET_NAME, ['id', 'saveData', 'updatedAt', 'version']);
}

function getPalmSheet_() {
  return getSheet_(PALM_SHEET_NAME, ['id', 'farmData', 'updatedAt', 'version']);
}

function readRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues().map((values, index) => {
    const item = { rowNumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      item[header] = values[headerIndex];
    });
    return item;
  });
}

function findLogin_(id) {
  const sheet = getLoginSheet_();
  const rows = readRows_(sheet);
  return rows.find((row) => String(row.id) === String(id)) || null;
}

function findSave_(id) {
  const sheet = getSaveSheet_();
  const rows = readRows_(sheet);
  return rows.find((row) => String(row.id) === String(id)) || null;
}

function findPalm_(id) {
  const sheet = getPalmSheet_();
  const rows = readRows_(sheet);
  return rows.find((row) => String(row.id) === String(id)) || null;
}

function parseJsonSafe_(text) {
  if (!text) return null;
  try {
    return JSON.parse(String(text));
  } catch (error) {
    return null;
  }
}

function normalizeRole_(role) {
  return String(role || 'player').toLowerCase() === 'admin' ? 'admin' : 'player';
}

function validateAccount_(id, pw) {
  if (!id) throw new Error('아이디가 없습니다.');
  if (!pw) throw new Error('비밀번호가 없습니다.');

  const account = findLogin_(id);
  if (!account) throw new Error('존재하지 않는 아이디입니다.');
  if (String(account.pw) !== String(pw)) throw new Error('비밀번호가 일치하지 않습니다.');

  return {
    id: String(account.id),
    role: normalizeRole_(account.role),
    rowNumber: account.rowNumber
  };
}

function createAccount_(body) {
  const id = String(body.id || '').trim();
  const pw = String(body.pw || '');
  if (!id) return { ok: false, message: '아이디를 입력하세요.' };
  if (!pw) return { ok: false, message: '비밀번호를 입력하세요.' };
  if (findLogin_(id)) return { ok: false, message: '이미 존재하는 아이디입니다.' };

  const now = new Date().toISOString();
  const loginSheet = getLoginSheet_();
  loginSheet.appendRow([id, pw, 'player', now, now]);

  const saveData = body.saveData || null;
  if (saveData) {
    upsertSave_(id, saveData, body.version || '');
    upsertPalm_(id, saveData.farmData || saveData.farm || null, body.version || '');
  }

  return {
    ok: true,
    id,
    role: 'player',
    saveData: saveData || null,
    farmData: saveData ? (saveData.farmData || saveData.farm || null) : null,
    message: '아이디를 생성했습니다.'
  };
}

function login_(body) {
  const account = validateAccount_(String(body.id || '').trim(), String(body.pw || ''));
  const now = new Date().toISOString();
  getLoginSheet_().getRange(account.rowNumber, 5).setValue(now);

  const saved = findSave_(account.id);
  let saveData = null;
  if (saved && saved.saveData) saveData = parseJsonSafe_(saved.saveData);

  const palm = findPalm_(account.id);
  let farmData = null;
  if (palm && palm.farmData) farmData = parseJsonSafe_(palm.farmData);
  if (!farmData && saveData && (saveData.farmData || saveData.farm)) {
    farmData = saveData.farmData || saveData.farm;
    upsertPalm_(account.id, farmData, saved ? saved.version : '');
  }
  if (saveData && farmData) saveData.farmData = farmData;

  return {
    ok: true,
    id: account.id,
    role: account.role,
    saveData,
    farmData,
    message: '로그인 성공'
  };
}

function save_(body) {
  const account = validateAccount_(String(body.id || '').trim(), String(body.pw || ''));
  const saveData = body.saveData || null;
  if (!saveData) return { ok: false, message: '저장 데이터가 없습니다.' };

  upsertSave_(account.id, saveData, body.version || '');
  upsertPalm_(account.id, saveData.farmData || saveData.farm || null, body.version || '');

  return {
    ok: true,
    id: account.id,
    role: account.role,
    message: '저장 완료'
  };
}

function upsertSave_(id, saveData, version) {
  const sheet = getSaveSheet_();
  const saved = findSave_(id);
  const now = new Date().toISOString();
  const dataText = JSON.stringify(saveData);

  if (saved) {
    sheet.getRange(saved.rowNumber, 2, 1, 3).setValues([[dataText, now, version || '']]);
    return;
  }

  sheet.appendRow([id, dataText, now, version || '']);
}

function upsertPalm_(id, farmData, version) {
  if (!farmData) return;
  const sheet = getPalmSheet_();
  const saved = findPalm_(id);
  const now = new Date().toISOString();
  const dataText = JSON.stringify(farmData);

  if (saved) {
    sheet.getRange(saved.rowNumber, 2, 1, 3).setValues([[dataText, now, version || '']]);
    return;
  }

  sheet.appendRow([id, dataText, now, version || '']);
}
