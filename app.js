var SD = {
  SHEETS: {
    SETTINGS: 'Settings',
    EMPLOYEES: 'Employees',
    PRODUCTS: 'Products',
    ORDERS: 'Orders',
    ORDER_ITEMS: 'Order Items',
    REWARDS: 'Rewards',
    RAFFLE: 'Raffle',
    RAFFLE_WINNER: 'Raffle Winner',
    PAYROLL: 'Payroll',
    ANNOUNCEMENTS: 'Announcements',
    THEME: 'Theme',
    UI_TEXT: 'UI Text',
    PAYMENT_METHODS: 'Payment Methods'
  },

  DEFAULTS: {
    PORTAL_NAME: "Sean's Donuts",
    PORTAL_SUBTITLE: "Employee Portal",
    BANK_ID: "24596194",
    ORDER_PREFIX: "SD-",
    ANNOUNCEMENT: "Welcome to Sean's Donuts Portal",
    LOGO_EMOJI: "🍩",
    THEME: {
      primary: "#f28c18",
      primaryDark: "#de7c0c",
      secondary: "#6c4330",
      bg: "#fdf4ea",
      card: "#ffffff",
      text: "#4a2e22",
      muted: "#8a6a5a",
      border: "#edc9a5"
    }
  }
};

function sdSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sdTrim_(value) {
  return String(value == null ? '' : value).trim();
}

function sdLower_(value) {
  return sdTrim_(value).toLowerCase();
}

function sdNum_(value) {
  var n = Number(value);
  return isNaN(n) ? 0 : n;
}

function sdBool_(value) {
  var v = sdLower_(value);
  return v === 'yes' || v === 'true' || v === '1' || v === 'active';
}

function sdJson_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sdReadBody_(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return {};
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function sdGetOrCreateSheet_(name, headers) {
  var ss = sdSS_();
  var sh = ss.getSheetByName(name);

  if (!sh) sh = ss.insertSheet(name);

  if (headers && headers.length) {
    var needsHeaders = false;

    if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
      needsHeaders = true;
    } else {
      var current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
      if (current.join('|') !== headers.join('|')) {
        needsHeaders = true;
      }
    }

    if (needsHeaders) {
      sh.clear();
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  }

  return sh;
}

function sdSheetRows_(name) {
  var sh = sdSS_().getSheetByName(name);
  if (!sh) return [];

  var values = sh.getDataRange().getValues();
  if (!values.length) return [];

  var headers = values[0];
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[String(headers[j]).trim()] = values[i][j];
    }
    rows.push(obj);
  }

  return rows;
}

function sdAppendRow_(sheetName, row) {
  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh) throw new Error('Missing sheet: ' + sheetName);
  sh.appendRow(row);
}

function sdSettingsMap_() {
  var rows = sdSheetRows_(SD.SHEETS.SETTINGS);
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var key = sdTrim_(rows[i].Key);
    if (key) map[key] = rows[i].Value;
  }
  return map;
}

function sdSetSetting_(key, value, type) {
  var sh = sdSS_().getSheetByName(SD.SHEETS.SETTINGS);
  if (!sh) throw new Error('Settings sheet missing.');

  var data = sh.getDataRange().getValues();

  if (!data.length) {
    sh.appendRow(['Key', 'Value', 'Type']);
    sh.appendRow([key, value, type || '']);
    return;
  }

  for (var i = 1; i < data.length; i++) {
    if (sdTrim_(data[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(value);
      if (type != null) sh.getRange(i + 1, 3).setValue(type);
      return;
    }
  }

  sh.appendRow([key, value, type || '']);
}

function sdKeyValueMap_(sheetName, keyField, valueField) {
  var rows = sdSheetRows_(sheetName);
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var key = sdTrim_(rows[i][keyField]);
    if (key) map[key] = rows[i][valueField];
  }
  return map;
}

function sdThemeMap_() {
  var map = sdKeyValueMap_(SD.SHEETS.THEME, 'Key', 'Value');
  return {
    primary: sdTrim_(map.primary || SD.DEFAULTS.THEME.primary),
    primaryDark: sdTrim_(map.primaryDark || SD.DEFAULTS.THEME.primaryDark),
    secondary: sdTrim_(map.secondary || SD.DEFAULTS.THEME.secondary),
    bg: sdTrim_(map.bg || SD.DEFAULTS.THEME.bg),
    card: sdTrim_(map.card || SD.DEFAULTS.THEME.card),
    text: sdTrim_(map.text || SD.DEFAULTS.THEME.text),
    muted: sdTrim_(map.muted || SD.DEFAULTS.THEME.muted),
    border: sdTrim_(map.border || SD.DEFAULTS.THEME.border)
  };
}

function sdUITextMap_() {
  var map = sdKeyValueMap_(SD.SHEETS.UI_TEXT, 'Key', 'Value');
  return {
    loginTitle: sdTrim_(map.loginTitle || "Sean's Donuts Portal"),
    loginSubtitle: sdTrim_(map.loginSubtitle || "Sign in with your username or email and PIN."),
    dashboardTitle: sdTrim_(map.dashboardTitle || "Welcome"),
    dashboardSubtitle: sdTrim_(map.dashboardSubtitle || "Portal overview"),
    posTitle: sdTrim_(map.posTitle || "POS"),
    posSubtitle: sdTrim_(map.posSubtitle || "Create a new order"),
    ordersTitle: sdTrim_(map.ordersTitle || "Orders"),
    ordersSubtitle: sdTrim_(map.ordersSubtitle || "Search recent orders"),
    rewardsTitle: sdTrim_(map.rewardsTitle || "Rewards"),
    rewardsSubtitle: sdTrim_(map.rewardsSubtitle || "Lookup customer rewards"),
    raffleTitle: sdTrim_(map.raffleTitle || "Raffle"),
    raffleSubtitle: sdTrim_(map.raffleSubtitle || "Recent raffle entries"),
    payrollTitle: sdTrim_(map.payrollTitle || "Payroll"),
    payrollSubtitle: sdTrim_(map.payrollSubtitle || "View payroll rows"),
    settingsTitle: sdTrim_(map.settingsTitle || "Settings"),
    settingsSubtitle: sdTrim_(map.settingsSubtitle || "Owner/Admin controls"),
    logoEmoji: sdTrim_(map.logoEmoji || SD.DEFAULTS.LOGO_EMOJI)
  };
}

function sdPaymentMethods_() {
  var rows = sdSheetRows_(SD.SHEETS.PAYMENT_METHODS);
  var methods = [];

  for (var i = 0; i < rows.length; i++) {
    if (!sdBool_(rows[i].Active || 'Yes')) continue;
    var name = sdTrim_(rows[i].Name);
    if (name) methods.push(name);
  }

  if (!methods.length) methods = ['Cash', 'Invoice', 'Bank ID'];
  return methods;
}

function sdGetProducts_() {
  var rows = sdSheetRows_(SD.SHEETS.PRODUCTS);
  var products = [];

  for (var i = 0; i < rows.length; i++) {
    if (!sdBool_(rows[i].Active || 'Yes')) continue;

    var name = sdTrim_(rows[i].Name);
    if (!name) continue;

    products.push({
      name: name,
      price: sdNum_(rows[i].Price)
    });
  }

  return products;
}

function sdFindEmployee_(loginValue, pin) {
  var rows = sdSheetRows_(SD.SHEETS.EMPLOYEES);
  var login = sdLower_(loginValue);
  var pinText = sdTrim_(pin);

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!sdBool_(row.Active || 'Yes')) continue;

    var email = sdLower_(row.Email);
    var username = sdLower_(row.Username);
    var savedPin = sdTrim_(row.PIN);

    if (savedPin === pinText && (email === login || username === login)) {
      return row;
    }
  }

  return null;
}

function sdRolePermissions_(roleValue) {
  var role = sdLower_(roleValue);

  var perms = {
    role: roleValue || 'Employee',
    canViewDashboard: true,
    canUsePOS: true,
    canViewOrders: false,
    canViewRewards: false,
    canViewRaffle: false,
    canViewPayroll: false,
    canViewSettings: false,
    canOverrideCheckout: false,
    canSaveSettings: false,
    canManageProducts: false,
    canManageEmployees: false,
    canManageTheme: false,
    canManageUIText: false,
    canManagePaymentMethods: false
  };

  if (role === 'owner') {
    perms.canViewOrders = true;
    perms.canViewRewards = true;
    perms.canViewRaffle = true;
    perms.canViewPayroll = true;
    perms.canViewSettings = true;
    perms.canOverrideCheckout = true;
    perms.canSaveSettings = true;
    perms.canManageProducts = true;
    perms.canManageEmployees = true;
    perms.canManageTheme = true;
    perms.canManageUIText = true;
    perms.canManagePaymentMethods = true;
    return perms;
  }

  if (role === 'admin') {
    perms.canViewOrders = true;
    perms.canViewRewards = true;
    perms.canViewRaffle = true;
    perms.canViewPayroll = true;
    perms.canViewSettings = true;
    perms.canOverrideCheckout = true;
    perms.canSaveSettings = true;
    perms.canManageProducts = true;
    perms.canManageEmployees = true;
    perms.canManageTheme = true;
    perms.canManageUIText = true;
    perms.canManagePaymentMethods = true;
    return perms;
  }

  if (role === 'manager') {
    perms.canViewOrders = true;
    perms.canViewRewards = true;
    perms.canViewRaffle = true;
    perms.canViewPayroll = true;
    return perms;
  }

  if (role === 'senior employee') {
    perms.canViewOrders = true;
    perms.canViewRewards = true;
    perms.canViewRaffle = true;
    return perms;
  }

  if (role === 'employee') {
    perms.canViewRewards = true;
    perms.canViewRaffle = true;
    return perms;
  }

  return perms;
}

function sdRequirePermission_(employee, permissionKey) {
  if (!employee) return { ok: false, message: 'Unauthorized.' };
  var perms = sdRolePermissions_(employee.Role);
  if (!perms[permissionKey]) return { ok: false, message: 'You do not have permission for that.' };
  return { ok: true, permissions: perms };
}

function sdUpsertKeyValue_(sheetName, key, value) {
  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh) throw new Error('Missing sheet: ' + sheetName);

  var data = sh.getDataRange().getValues();
  if (data.length <= 1) {
    sh.appendRow([key, value]);
    return;
  }

  for (var i = 1; i < data.length; i++) {
    if (sdTrim_(data[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }

  sh.appendRow([key, value]);
}

function sdReplaceSheetData_(sheetName, headers, rows) {
  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh) throw new Error('Missing sheet: ' + sheetName);

  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows && rows.length) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sh.setFrozenRows(1);
}
