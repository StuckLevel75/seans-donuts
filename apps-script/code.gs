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
    PAYMENT_METHODS: 'Payment Methods',
    ADS: 'Ads'
  },

  DEFAULTS: {
    PORTAL_NAME: "Sean's Donuts",
    PORTAL_SUBTITLE: 'Employee Portal',
    BANK_ID: '24596194',
    ORDER_PREFIX: 'SD-',
    ANNOUNCEMENT: "Welcome to Sean's Donuts Portal",
    LOGO_EMOJI: '🍩',
    MILEAGE_RATE: 0,
    THEME: {
      primary: '#f28c18',
      primaryDark: '#de7c0c',
      secondary: '#6c4330',
      bg: '#fdf4ea',
      card: '#ffffff',
      text: '#4a2e22',
      muted: '#8a6a5a',
      border: '#edc9a5'
    }
  }
};

SD.SETUP_VERSION = '2026-05-02-v2';

var SD_RUNTIME = SD_RUNTIME || {
  ss: null,
  rows: {},
  maps: {}
};

function doGet() {
  sdSetup_();
  return sdJson_({ ok: true, message: "Sean's Donuts API is live" });
}

function doPost(e) {
  sdSetup_();

  try {
    var body = sdReadBody_(e);
    var action = sdTrim_(body.action);
    var payload = body.payload || {};

    if (action === 'login') return sdJson_(sdLogin_(payload));
    if (action === 'getPortalBootstrap') return sdJson_(sdGetPortalBootstrap_(payload));
    if (action === 'submitOrder') return sdJson_(sdSubmitOrder_(payload));
    if (action === 'searchOrders') return sdJson_(sdSearchOrders_(payload));
    if (action === 'lookupRewards') return sdJson_(sdLookupRewards_(payload));
    if (action === 'loadRaffleOverview') return sdJson_(sdLoadRaffleOverview_(payload));
    if (action === 'drawRaffleWinner') return sdJson_(sdDrawRaffleWinner_(payload));
    if (action === 'clearRaffleWinner') return sdJson_(sdClearRaffleWinner_(payload));
    if (action === 'resetRaffle') return sdJson_(sdResetRaffle_(payload));
    if (action === 'loadPayroll') return sdJson_(sdLoadPayroll_(payload));

    if (action === 'saveSettings') return sdJson_(sdSaveSettings_(payload));
    if (action === 'saveRaffleSettings') return sdJson_(sdSaveRaffleSettings_(payload));

    if (action === 'getAdminData') return sdJson_(sdGetAdminData_(payload));
    if (action === 'saveTheme') return sdJson_(sdSaveTheme_(payload));
    if (action === 'saveUIText') return sdJson_(sdSaveUIText_(payload));
    if (action === 'saveProducts') return sdJson_(sdSaveProducts_(payload));
    if (action === 'saveEmployees') return sdJson_(sdSaveEmployees_(payload));
    if (action === 'savePaymentMethods') return sdJson_(sdSavePaymentMethods_(payload));

    if (action === 'loadAds') return sdJson_(sdLoadAds_(payload));
    if (action === 'saveAd') return sdJson_(sdSaveAd_(payload));
    if (action === 'deleteAd') return sdJson_(sdDeleteAd_(payload));

    return sdJson_({ ok: false, message: 'Unknown action.' });
  } catch (err) {
    return sdJson_({
      ok: false,
      message: err && err.message ? err.message : 'Server error.'
    });
  }
}

function sdSetup_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SD_SETUP_VERSION') === SD.SETUP_VERSION) return;

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    if (props.getProperty('SD_SETUP_VERSION') === SD.SETUP_VERSION) return;

    sdGetOrCreateSheet_(SD.SHEETS.SETTINGS, ['Key', 'Value', 'Type']);
    sdGetOrCreateSheet_(SD.SHEETS.EMPLOYEES, ['Name', 'Email', 'Username', 'PIN', 'Role', 'Active']);
    sdGetOrCreateSheet_(SD.SHEETS.PRODUCTS, ['Name', 'Price', 'Active']);
    sdGetOrCreateSheet_(SD.SHEETS.ORDERS, [
      'Order Number',
      'Timestamp',
      'Customer Name',
      'Customer Discord',
      'Phone Number',
      'Subtotal',
      'Discount',
      'Tip',
      'Mileage',
      'Total',
      'Payment Method',
      'Notes',
      'Employee Name',
      'Employee Email'
    ]);
    sdGetOrCreateSheet_(SD.SHEETS.ORDER_ITEMS, ['Order Number', 'Product Name', 'Qty', 'Price', 'Line Total']);
    sdGetOrCreateSheet_(SD.SHEETS.REWARDS, ['Customer Name', 'Visits', 'Rewards Available', 'Last Visit', 'Last Order Number', 'Total Rewards Redeemed']);
    sdGetOrCreateSheet_(SD.SHEETS.RAFFLE, ['Timestamp', 'Customer Name', 'Customer Discord', 'Phone Number', 'Tickets Bought', 'Order Number']);
    sdGetOrCreateSheet_(SD.SHEETS.RAFFLE_WINNER, ['Timestamp', 'Customer Name', 'Customer Discord', 'Phone Number', 'Tickets Bought', 'Order Number']);
    sdGetOrCreateSheet_(SD.SHEETS.PAYROLL, ['Employee', 'Start Date', 'End Date', 'Orders', 'Tips', 'Commission', 'Total Pay']);
    sdGetOrCreateSheet_(SD.SHEETS.ANNOUNCEMENTS, ['Title', 'Message', 'Active']);
    sdGetOrCreateSheet_(SD.SHEETS.THEME, ['Key', 'Value']);
    sdGetOrCreateSheet_(SD.SHEETS.UI_TEXT, ['Key', 'Value']);
    sdGetOrCreateSheet_(SD.SHEETS.PAYMENT_METHODS, ['Name', 'Active']);
    sdGetOrCreateSheet_(SD.SHEETS.ADS, ['ID', 'Created At', 'Title', 'Ad Text', 'Status', 'Posted By']);

    sdSeedDefaults_();
    sdSyncOrderCounter_();

    props.setProperty('SD_SETUP_VERSION', SD.SETUP_VERSION);
  } finally {
    lock.releaseLock();
  }
}

function sdSeedDefaults_() {
  var settings = sdSettingsMap_();
  var settingRows = [];

  if (sdNeedsDefault_(settings, 'portalName')) settingRows.push(['portalName', SD.DEFAULTS.PORTAL_NAME, 'setting']);
  if (sdNeedsDefault_(settings, 'portalSubtitle')) settingRows.push(['portalSubtitle', SD.DEFAULTS.PORTAL_SUBTITLE, 'setting']);
  if (sdNeedsDefault_(settings, 'bankId')) settingRows.push(['bankId', SD.DEFAULTS.BANK_ID, 'setting']);
  if (sdNeedsDefault_(settings, 'announcement')) settingRows.push(['announcement', SD.DEFAULTS.ANNOUNCEMENT, 'setting']);
  if (sdNeedsDefault_(settings, 'mileageRate')) settingRows.push(['mileageRate', SD.DEFAULTS.MILEAGE_RATE, 'setting']);

  if (sdNeedsDefault_(settings, 'raffleEnabled')) settingRows.push(['raffleEnabled', 'Yes', 'setting']);
  if (sdNeedsDefault_(settings, 'raffleMaxOverall')) settingRows.push(['raffleMaxOverall', '0', 'setting']);
  if (sdNeedsDefault_(settings, 'raffleMaxPerPerson')) settingRows.push(['raffleMaxPerPerson', '0', 'setting']);
  if (!sdHasKey_(settings, 'raffleStart')) settingRows.push(['raffleStart', '', 'setting']);
  if (!sdHasKey_(settings, 'raffleEnd')) settingRows.push(['raffleEnd', '', 'setting']);

  if (settingRows.length) sdAppendRows_(SD.SHEETS.SETTINGS, settingRows);

  var productsSh = sdSS_().getSheetByName(SD.SHEETS.PRODUCTS);
  if (productsSh.getLastRow() <= 1) {
    sdAppendRows_(SD.SHEETS.PRODUCTS, [
      ['Glazed Donut', 2.50, 'Yes'],
      ['Chocolate Donut', 2.75, 'Yes'],
      ['Coffee', 3.00, 'Yes'],
      ['Raffle Ticket', 1.00, 'Yes']
    ]);
  }

  var methodsSh = sdSS_().getSheetByName(SD.SHEETS.PAYMENT_METHODS);
  if (methodsSh.getLastRow() <= 1) {
    sdAppendRows_(SD.SHEETS.PAYMENT_METHODS, [
      ['Cash', 'Yes'],
      ['Invoice', 'Yes'],
      ['Bank ID', 'Yes']
    ]);
  }

  var employeesSh = sdSS_().getSheetByName(SD.SHEETS.EMPLOYEES);
  if (employeesSh.getLastRow() <= 1) {
    sdAppendRows_(SD.SHEETS.EMPLOYEES, [
      ['Owner', 'owner@seansdonuts.com', 'owner', '1234', 'Owner', 'Yes']
    ]);
  }

  var announcementsSh = sdSS_().getSheetByName(SD.SHEETS.ANNOUNCEMENTS);
  if (announcementsSh.getLastRow() <= 1) {
    sdAppendRows_(SD.SHEETS.ANNOUNCEMENTS, [
      ['Welcome', 'Portal is ready to use.', 'Yes']
    ]);
  }

  var theme = SD.DEFAULTS.THEME;
  var themeSh = sdSS_().getSheetByName(SD.SHEETS.THEME);
  if (themeSh.getLastRow() <= 1) {
    sdAppendRows_(SD.SHEETS.THEME, [
      ['primary', theme.primary],
      ['primaryDark', theme.primaryDark],
      ['secondary', theme.secondary],
      ['bg', theme.bg],
      ['card', theme.card],
      ['text', theme.text],
      ['muted', theme.muted],
      ['border', theme.border]
    ]);
  }

  var ui = sdSS_().getSheetByName(SD.SHEETS.UI_TEXT);
  if (ui.getLastRow() <= 1) {
    sdAppendRows_(SD.SHEETS.UI_TEXT, [
      ['loginTitle', "Sean's Donuts Portal"],
      ['loginSubtitle', 'Sign in with your username or email and PIN.'],
      ['dashboardTitle', 'Welcome'],
      ['dashboardSubtitle', 'Portal overview'],
      ['posTitle', 'POS'],
      ['posSubtitle', 'Create a new order'],
      ['ordersTitle', 'Orders'],
      ['ordersSubtitle', 'Search recent orders'],
      ['rewardsTitle', 'Rewards'],
      ['rewardsSubtitle', 'Lookup customer rewards'],
      ['raffleTitle', 'Raffle'],
      ['raffleSubtitle', 'Recent raffle entries'],
      ['payrollTitle', 'Payroll'],
      ['payrollSubtitle', 'View payroll rows'],
      ['settingsTitle', 'Settings'],
      ['settingsSubtitle', 'Owner/Admin controls'],
      ['logoEmoji', SD.DEFAULTS.LOGO_EMOJI]
    ]);
  }
}

function sdLogin_(payload) {
  var loginValue = sdTrim_(payload.loginValue || payload.email || payload.username);
  var pin = sdTrim_(payload.pin);

  if (!loginValue || !pin) return { ok: false, message: 'Enter username/email and PIN.' };

  var employee = sdFindEmployee_(loginValue, pin);
  if (!employee) return { ok: false, message: 'Invalid login.' };

  var settings = sdSettingsMap_();
  var perms = sdRolePermissions_(employee.Role);

  return {
    ok: true,
    employee: {
      name: sdTrim_(employee.Name),
      email: sdTrim_(employee.Email),
      username: sdTrim_(employee.Username),
      role: sdTrim_(employee.Role || 'Employee')
    },
    permissions: perms,
    portalPrefs: {
      announcement: sdTrim_(settings.announcement || SD.DEFAULTS.ANNOUNCEMENT),
      bankId: sdTrim_(settings.bankId || SD.DEFAULTS.BANK_ID)
    },
    products: sdGetProducts_()
  };
}

function sdGetPortalBootstrap_() {
  var settings = sdSettingsMap_();
  var orderStats = sdOrderStats_();
  var employees = sdSheetRows_(SD.SHEETS.EMPLOYEES);
  var announcementsRows = sdSheetRows_(SD.SHEETS.ANNOUNCEMENTS);
  var theme = sdThemeMap_();
  var uiText = sdUITextMap_();
  var products = sdGetProducts_();

  var activeEmployees = 0;
  for (var i = 0; i < employees.length; i++) {
    if (sdBool_(employees[i].Active || 'Yes')) activeEmployees++;
  }

  var announcements = [];
  for (var k = 0; k < announcementsRows.length; k++) {
    if (sdBool_(announcementsRows[k].Active || 'Yes')) {
      announcements.push({
        title: sdTrim_(announcementsRows[k].Title),
        message: sdTrim_(announcementsRows[k].Message)
      });
    }
  }

  return {
    ok: true,
    settings: {
      portalName: sdTrim_(settings.portalName || SD.DEFAULTS.PORTAL_NAME),
      portalSubtitle: sdTrim_(settings.portalSubtitle || SD.DEFAULTS.PORTAL_SUBTITLE),
      bankId: sdTrim_(settings.bankId || SD.DEFAULTS.BANK_ID),
      announcement: sdTrim_(settings.announcement || SD.DEFAULTS.ANNOUNCEMENT),
      mileageRate: sdNum_(settings.mileageRate || SD.DEFAULTS.MILEAGE_RATE),
      raffleEnabled: sdTrim_(settings.raffleEnabled || 'Yes'),
      raffleMaxOverall: sdTrim_(settings.raffleMaxOverall || '0'),
      raffleMaxPerPerson: sdTrim_(settings.raffleMaxPerPerson || '0'),
      raffleStart: sdTrim_(settings.raffleStart || ''),
      raffleEnd: sdTrim_(settings.raffleEnd || ''),
      paymentMethods: sdPaymentMethods_(),
      theme: theme,
      uiText: uiText,
      products: products,
      employees: employees
    },
    stats: {
      totalOrders: orderStats.totalOrders,
      totalSales: orderStats.totalSales,
      activeEmployees: activeEmployees,
      raffleEntries: sdDataRowCount_(SD.SHEETS.RAFFLE)
    },
    announcements: announcements,
    products: products
  };
}

function sdSubmitOrder_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canUsePOS');
  if (!access.ok) return access;

  var items = payload.items || [];
  if (!items.length) return { ok: false, message: 'No items in order.' };

  var products = sdGetProducts_();
  var priceMap = {};
  for (var i = 0; i < products.length; i++) {
    priceMap[products[i].name] = sdNum_(products[i].price);
  }

  var normalizedItems = [];
  var subtotal = 0;
  var raffleTicketQty = 0;

  for (var j = 0; j < items.length; j++) {
    var name = sdTrim_(items[j].name || items[j].Name);
    var qty = sdNum_(items[j].qty || items[j].Qty);
    var price = sdNum_(priceMap[name]);
    if (!name || qty <= 0) continue;

    if (sdLower_(name) === 'raffle ticket') raffleTicketQty += qty;

    var lineTotal = qty * price;
    subtotal += lineTotal;
    normalizedItems.push({
      name: name,
      qty: qty,
      price: price,
      lineTotal: lineTotal
    });
  }

  if (!normalizedItems.length) return { ok: false, message: 'No valid items in order.' };

  var customerName = sdTrim_(payload.customerName);
  var customerDiscord = sdTrim_(payload.customerDiscord);
  var phoneNumber = sdTrim_(payload.phoneNumber);

  if (raffleTicketQty > 0 && (!customerName || !customerDiscord || !phoneNumber)) {
    return { ok: false, message: 'Raffle ticket orders require customer name, Discord, and phone number.' };
  }

  var perms = access.permissions;
  var mileage = sdNum_(payload.mileage);
  var amountPaid = sdNum_(payload.amountPaid);
  var baseTotal = subtotal + mileage;

  var discount = perms.canOverrideCheckout ? sdNum_(payload.discount) : Math.max(0, baseTotal - amountPaid);
  var tip = perms.canOverrideCheckout ? sdNum_(payload.tip) : Math.max(0, amountPaid - baseTotal);
  var total = Math.max(0, subtotal - discount + tip + mileage);

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    if (raffleTicketQty > 0) {
      sdInvalidateSheetCache_(SD.SHEETS.RAFFLE);
      var raffleCheck = sdValidateRaffleSale_(customerName, raffleTicketQty);
      if (!raffleCheck.ok) return raffleCheck;
    }

    var orderNumber = sdNextOrderNumber_();
    var now = new Date();

    sdAppendRow_(SD.SHEETS.ORDERS, [
      orderNumber,
      now,
      customerName,
      customerDiscord,
      phoneNumber,
      subtotal,
      discount,
      tip,
      mileage,
      total,
      sdTrim_(payload.paymentMethod),
      sdTrim_(payload.notes),
      sdTrim_(employee.Name),
      sdTrim_(employee.Email)
    ]);

    var itemRows = [];
    for (var k = 0; k < normalizedItems.length; k++) {
      itemRows.push([
        orderNumber,
        normalizedItems[k].name,
        normalizedItems[k].qty,
        normalizedItems[k].price,
        normalizedItems[k].lineTotal
      ]);
    }
    sdAppendRows_(SD.SHEETS.ORDER_ITEMS, itemRows);

    sdUpdateRewardsAfterOrder_(customerName, orderNumber);
    sdAddRaffleEntriesFromOrder_(customerName, customerDiscord, phoneNumber, orderNumber, normalizedItems);

    return {
      ok: true,
      message: 'Order ' + orderNumber + ' submitted.',
      orderNumber: orderNumber
    };
  } finally {
    lock.releaseLock();
  }
}

function sdValidateRaffleSale_(customerName, newQty) {
  var settings = sdSettingsMap_();
  var enabled = sdTrim_(settings.raffleEnabled || 'Yes');
  if (enabled !== 'Yes') return { ok: false, message: 'Raffle ticket sales are currently disabled.' };

  var now = new Date();
  var startStr = sdTrim_(settings.raffleStart || '');
  var endStr = sdTrim_(settings.raffleEnd || '');

  if (startStr) {
    var start = new Date(startStr);
    if (!isNaN(start.getTime()) && now.getTime() < start.getTime()) {
      return { ok: false, message: 'Raffle ticket sales have not started yet.' };
    }
  }

  if (endStr) {
    var end = new Date(endStr);
    if (!isNaN(end.getTime()) && now.getTime() > end.getTime()) {
      return { ok: false, message: 'Raffle ticket sales have ended.' };
    }
  }

  var maxOverall = sdNum_(settings.raffleMaxOverall || 0);
  var maxPerPerson = sdNum_(settings.raffleMaxPerPerson || 0);

  var rows = sdSheetRows_(SD.SHEETS.RAFFLE);
  var totalSold = 0;
  var personBought = 0;

  for (var i = 0; i < rows.length; i++) {
    var qty = sdNum_(rows[i]['Tickets Bought']);
    totalSold += qty;
    if (sdLower_(rows[i]['Customer Name']) === sdLower_(customerName)) {
      personBought += qty;
    }
  }

  if (maxOverall > 0 && totalSold + newQty > maxOverall) {
    return { ok: false, message: 'This sale would go over the raffle overall ticket limit.' };
  }

  if (maxPerPerson > 0 && personBought + newQty > maxPerPerson) {
    return { ok: false, message: 'This customer would go over the raffle per-person ticket limit.' };
  }

  return { ok: true };
}

function sdUpdateRewardsAfterOrder_(customerName, orderNumber) {
  if (!customerName) return;

  var sh = sdSS_().getSheetByName(SD.SHEETS.REWARDS);
  var data = sh.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (sdLower_(data[i][0]) === sdLower_(customerName)) {
      var visits = sdNum_(data[i][1]) + 1;
      var rewardsAvailable = Math.floor(visits / 10);

      sh.getRange(i + 1, 1, 1, 6).setValues([[
        data[i][0],
        visits,
        rewardsAvailable,
        new Date(),
        orderNumber,
        sdNum_(data[i][5])
      ]]);

      sdInvalidateSheetCache_(SD.SHEETS.REWARDS);
      return;
    }
  }

  sdAppendRow_(SD.SHEETS.REWARDS, [customerName, 1, 0, new Date(), orderNumber, 0]);
}

function sdAddRaffleEntriesFromOrder_(customerName, customerDiscord, phoneNumber, orderNumber, items) {
  for (var i = 0; i < items.length; i++) {
    if (sdLower_(items[i].name) === 'raffle ticket' && sdNum_(items[i].qty) > 0) {
      sdAppendRow_(SD.SHEETS.RAFFLE, [
        new Date(),
        customerName,
        customerDiscord,
        phoneNumber,
        sdNum_(items[i].qty),
        orderNumber
      ]);
      return;
    }
  }
}

function sdSearchOrders_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canViewOrders');
  if (!access.ok) return access;

  var q = sdLower_(payload.query);
  var rows = q ? sdSheetRows_(SD.SHEETS.ORDERS) : sdSheetLastRows_(SD.SHEETS.ORDERS, 100);
  var results = [];

  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    if (!q) {
      results.push(row);
    } else {
      var hay = [
        row['Order Number'],
        row['Customer Name'],
        row['Customer Discord'],
        row['Phone Number'],
        row['Employee Name'],
        row['Payment Method'],
        row['Notes']
      ].join(' ').toLowerCase();

      if (hay.indexOf(q) !== -1) results.push(row);
    }

    if (results.length >= 100) break;
  }

  return { ok: true, results: results };
}

function sdLookupRewards_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canViewRewards');
  if (!access.ok) return access;

  var customerName = sdTrim_(payload.customerName);
  if (!customerName) return { ok: false, message: 'Enter customer name.' };

  var rows = sdSheetRows_(SD.SHEETS.REWARDS);
  for (var i = 0; i < rows.length; i++) {
    if (sdLower_(rows[i]['Customer Name']) === sdLower_(customerName)) {
      var visits = sdNum_(rows[i].Visits);
      return {
        ok: true,
        reward: {
          visits: visits,
          visitProgress: visits % 10,
          rewardsAvailable: sdNum_(rows[i]['Rewards Available']),
          totalRewardsRedeemed: sdNum_(rows[i]['Total Rewards Redeemed']),
          lastVisit: rows[i]['Last Visit'] || '-',
          lastOrderNumber: rows[i]['Last Order Number'] || '-'
        }
      };
    }
  }

  return {
    ok: true,
    reward: {
      visits: 0,
      visitProgress: 0,
      rewardsAvailable: 0,
      totalRewardsRedeemed: 0,
      lastVisit: '-',
      lastOrderNumber: '-'
    }
  };
}

function sdLoadRaffleOverview_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canViewRaffle');
  if (!access.ok) return access;

  var rows = sdSheetLastRows_(SD.SHEETS.RAFFLE, 100);
  var results = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    results.push({
      customerName: sdTrim_(rows[i]['Customer Name']),
      customerDiscord: sdTrim_(rows[i]['Customer Discord']),
      phoneNumber: sdTrim_(rows[i]['Phone Number']),
      ticketsBought: sdNum_(rows[i]['Tickets Bought']),
      orderNumber: sdTrim_(rows[i]['Order Number'])
    });
  }

  return {
    ok: true,
    entries: results,
    winner: sdGetSavedRaffleWinner_()
  };
}

function sdDrawRaffleWinner_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canViewRaffle');
  if (!access.ok) return access;

  var settings = sdSettingsMap_();
  if (sdTrim_(settings.raffleEnabled || 'Yes') !== 'Yes') {
    return { ok: false, message: 'Raffle is currently disabled.' };
  }

  var raffleRows = sdSheetRows_(SD.SHEETS.RAFFLE);
  if (!raffleRows.length) return { ok: false, message: 'No raffle entries to draw from.' };

  var totalTickets = 0;
  for (var i = 0; i < raffleRows.length; i++) {
    totalTickets += Math.max(1, sdNum_(raffleRows[i]['Tickets Bought']));
  }

  if (totalTickets <= 0) return { ok: false, message: 'No raffle entries to draw from.' };

  var pick = Math.floor(Math.random() * totalTickets) + 1;
  var running = 0;
  var winner = raffleRows[0];

  for (var j = 0; j < raffleRows.length; j++) {
    running += Math.max(1, sdNum_(raffleRows[j]['Tickets Bought']));
    if (pick <= running) {
      winner = raffleRows[j];
      break;
    }
  }

  sdSaveRaffleWinner_(winner);

  return {
    ok: true,
    message: 'Winner drawn.',
    winner: {
      customerName: sdTrim_(winner['Customer Name']),
      customerDiscord: sdTrim_(winner['Customer Discord']),
      phoneNumber: sdTrim_(winner['Phone Number']),
      ticketsBought: sdNum_(winner['Tickets Bought']),
      orderNumber: sdTrim_(winner['Order Number'])
    }
  };
}

function sdClearRaffleWinner_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canViewRaffle');
  if (!access.ok) return access;

  var sh = sdSS_().getSheetByName(SD.SHEETS.RAFFLE_WINNER);
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  }

  sdInvalidateSheetCache_(SD.SHEETS.RAFFLE_WINNER);
  return { ok: true, message: 'Winner cleared.' };
}

function sdResetRaffle_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  if (!employee) return { ok: false, message: 'Unauthorized.' };

  var role = sdLower_(employee.Role);
  if (role !== 'owner') return { ok: false, message: 'Only the owner can reset the raffle.' };

  var raffleSh = sdSS_().getSheetByName(SD.SHEETS.RAFFLE);
  if (raffleSh && raffleSh.getLastRow() > 1) {
    raffleSh.getRange(2, 1, raffleSh.getLastRow() - 1, raffleSh.getLastColumn()).clearContent();
  }

  var winnerSh = sdSS_().getSheetByName(SD.SHEETS.RAFFLE_WINNER);
  if (winnerSh && winnerSh.getLastRow() > 1) {
    winnerSh.getRange(2, 1, winnerSh.getLastRow() - 1, winnerSh.getLastColumn()).clearContent();
  }

  sdInvalidateSheetCache_(SD.SHEETS.RAFFLE);
  sdInvalidateSheetCache_(SD.SHEETS.RAFFLE_WINNER);
  return { ok: true, message: 'Raffle reset.' };
}

function sdSaveRaffleWinner_(winnerRow) {
  var sh = sdSS_().getSheetByName(SD.SHEETS.RAFFLE_WINNER);
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  }

  sdAppendRow_(SD.SHEETS.RAFFLE_WINNER, [
    new Date(),
    sdTrim_(winnerRow['Customer Name']),
    sdTrim_(winnerRow['Customer Discord']),
    sdTrim_(winnerRow['Phone Number']),
    sdNum_(winnerRow['Tickets Bought']),
    sdTrim_(winnerRow['Order Number'])
  ]);
}

function sdGetSavedRaffleWinner_() {
  var rows = sdSheetRows_(SD.SHEETS.RAFFLE_WINNER);
  if (!rows.length) return null;

  var row = rows[rows.length - 1];
  return {
    customerName: sdTrim_(row['Customer Name']),
    customerDiscord: sdTrim_(row['Customer Discord']),
    phoneNumber: sdTrim_(row['Phone Number']),
    ticketsBought: sdNum_(row['Tickets Bought']),
    orderNumber: sdTrim_(row['Order Number'])
  };
}

function sdLoadPayroll_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canViewPayroll');
  if (!access.ok) return access;

  var startDate = sdTrim_(payload.startDate);
  var endDate = sdTrim_(payload.endDate);
  var rows = startDate || endDate ? sdSheetRows_(SD.SHEETS.PAYROLL) : sdSheetLastRows_(SD.SHEETS.PAYROLL, 100);
  var results = [];

  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    var rowStart = row['Start Date'];
    var rowEnd = row['End Date'];

    if (startDate || endDate) {
      var rowStartText = rowStart ? Utilities.formatDate(new Date(rowStart), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      var rowEndText = rowEnd ? Utilities.formatDate(new Date(rowEnd), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';

      if (startDate && rowEndText && rowEndText < startDate) continue;
      if (endDate && rowStartText && rowStartText > endDate) continue;
    }

    results.push(row);
    if (results.length >= 100) break;
  }

  return { ok: true, rows: results };
}

function sdSaveSettings_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canSaveSettings');
  if (!access.ok) return access;

  sdSetSetting_('announcement', sdTrim_(sdFirstValue_(payload, ['announcement'], SD.DEFAULTS.ANNOUNCEMENT)) || SD.DEFAULTS.ANNOUNCEMENT, 'setting');
  sdSetSetting_('bankId', sdTrim_(sdFirstValue_(payload, ['bankId'], SD.DEFAULTS.BANK_ID)) || SD.DEFAULTS.BANK_ID, 'setting');
  sdSetSetting_('portalName', sdTrim_(sdFirstValue_(payload, ['portalName'], SD.DEFAULTS.PORTAL_NAME)) || SD.DEFAULTS.PORTAL_NAME, 'setting');
  sdSetSetting_('portalSubtitle', sdTrim_(sdFirstValue_(payload, ['portalSubtitle'], SD.DEFAULTS.PORTAL_SUBTITLE)) || SD.DEFAULTS.PORTAL_SUBTITLE, 'setting');
  sdSetSetting_('mileageRate', sdNum_(sdFirstValue_(payload, ['mileageRate'], SD.DEFAULTS.MILEAGE_RATE)), 'setting');

  return { ok: true, message: 'Settings saved.' };
}

function sdSaveRaffleSettings_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  if (!employee) return { ok: false, message: 'Unauthorized.' };
  if (sdLower_(employee.Role) !== 'owner') return { ok: false, message: 'Only the owner can change raffle controls.' };

  var enabled = sdTrim_(payload.enabled || 'Yes');
  var maxOverall = String(sdNum_(payload.maxOverall || 0));
  var maxPer = String(sdNum_(payload.maxPer || 0));
  var start = sdTrim_(payload.start || '');
  var end = sdTrim_(payload.end || '');

  if (start && end) {
    var startDate = new Date(start);
    var endDate = new Date(end);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate.getTime() < startDate.getTime()) {
      return { ok: false, message: 'Raffle end date must be after the start date.' };
    }
  }

  sdSetSetting_('raffleEnabled', enabled === 'No' ? 'No' : 'Yes', 'setting');
  sdSetSetting_('raffleMaxOverall', maxOverall, 'setting');
  sdSetSetting_('raffleMaxPerPerson', maxPer, 'setting');
  sdSetSetting_('raffleStart', start, 'setting');
  sdSetSetting_('raffleEnd', end, 'setting');

  return { ok: true, message: 'Raffle controls saved.' };
}

function sdGetAdminData_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var perms = sdRolePermissions_(employee && employee.Role);

  if (!employee || !(perms.canViewSettings || perms.canManageProducts || perms.canManageEmployees || perms.canManageTheme || perms.canManageUIText || perms.canManagePaymentMethods)) {
    return { ok: false, message: 'You do not have permission for that.' };
  }

  var settings = sdSettingsMap_();

  return {
    ok: true,
    theme: sdThemeMap_(),
    uiText: sdUITextMap_(),
    products: sdSheetRows_(SD.SHEETS.PRODUCTS),
    employees: sdSheetRows_(SD.SHEETS.EMPLOYEES),
    paymentMethods: sdSheetRows_(SD.SHEETS.PAYMENT_METHODS),
    settings: {
      portalName: settings.portalName || SD.DEFAULTS.PORTAL_NAME,
      portalSubtitle: settings.portalSubtitle || SD.DEFAULTS.PORTAL_SUBTITLE,
      announcement: settings.announcement || SD.DEFAULTS.ANNOUNCEMENT,
      bankId: settings.bankId || SD.DEFAULTS.BANK_ID,
      mileageRate: sdNum_(settings.mileageRate || SD.DEFAULTS.MILEAGE_RATE),
      raffleEnabled: settings.raffleEnabled || 'Yes',
      raffleMaxOverall: settings.raffleMaxOverall || '0',
      raffleMaxPerPerson: settings.raffleMaxPerPerson || '0',
      raffleStart: settings.raffleStart || '',
      raffleEnd: settings.raffleEnd || ''
    }
  };
}

function sdSaveTheme_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canManageTheme');
  if (!access.ok) return access;

  var theme = payload.theme || payload || {};
  var keys = ['primary', 'primaryDark', 'secondary', 'bg', 'card', 'text', 'muted', 'border'];

  for (var i = 0; i < keys.length; i++) {
    sdUpsertKeyValue_(SD.SHEETS.THEME, keys[i], sdTrim_(theme[keys[i]] || SD.DEFAULTS.THEME[keys[i]]));
  }

  return { ok: true, message: 'Theme saved.' };
}

function sdSaveUIText_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canManageUIText');
  if (!access.ok) return access;

  var uiText = payload.uiText || payload || {};
  var keys = [
    'loginTitle',
    'loginSubtitle',
    'dashboardTitle',
    'dashboardSubtitle',
    'posTitle',
    'posSubtitle',
    'ordersTitle',
    'ordersSubtitle',
    'rewardsTitle',
    'rewardsSubtitle',
    'raffleTitle',
    'raffleSubtitle',
    'payrollTitle',
    'payrollSubtitle',
    'settingsTitle',
    'settingsSubtitle',
    'logoEmoji'
  ];

  for (var i = 0; i < keys.length; i++) {
    sdUpsertKeyValue_(SD.SHEETS.UI_TEXT, keys[i], sdTrim_(uiText[keys[i]] || sdDefaultUIText_()[keys[i]] || ''));
  }

  return { ok: true, message: 'UI text saved.' };
}

function sdSaveProducts_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canManageProducts');
  if (!access.ok) return access;

  var items = payload.products || [];
  var rows = [];

  for (var i = 0; i < items.length; i++) {
    var name = sdTrim_(sdFirstValue_(items[i], ['Name', 'name'], ''));
    if (!name) continue;

    rows.push([
      name,
      sdNum_(sdFirstValue_(items[i], ['Price', 'price'], 0)),
      sdBool_(sdFirstValue_(items[i], ['Active', 'active'], 'Yes')) ? 'Yes' : 'No'
    ]);
  }

  sdReplaceSheetData_(SD.SHEETS.PRODUCTS, ['Name', 'Price', 'Active'], rows);
  return { ok: true, message: 'Products saved.' };
}

function sdSaveEmployees_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canManageEmployees');
  if (!access.ok) return access;

  var existing = sdSheetRows_(SD.SHEETS.EMPLOYEES);
  var existingMap = {};
  for (var i = 0; i < existing.length; i++) {
    var key = sdLower_(existing[i].Name || existing[i].Email || existing[i].Username);
    if (key) existingMap[key] = existing[i];
  }

  var items = payload.employees || [];
  var rows = [];

  for (var j = 0; j < items.length; j++) {
    var name = sdTrim_(sdFirstValue_(items[j], ['Name', 'name'], ''));
    var email = sdTrim_(sdFirstValue_(items[j], ['Email', 'email'], ''));
    var role = sdTrim_(sdFirstValue_(items[j], ['Role', 'role'], ''));
    var lookupKey = sdLower_(name || email);
    var oldRow = existingMap[lookupKey] || {};

    if (!name && !email) continue;

    rows.push([
      name,
      email,
      sdTrim_(sdFirstValue_(items[j], ['Username', 'username'], oldRow.Username)),
      sdTrim_(sdFirstValue_(items[j], ['PIN', 'pin'], oldRow.PIN)),
      role || sdTrim_(oldRow.Role || 'Employee'),
      sdBool_(sdFirstValue_(items[j], ['Active', 'active'], oldRow.Active || 'Yes')) ? 'Yes' : 'No'
    ]);
  }

  sdReplaceSheetData_(SD.SHEETS.EMPLOYEES, ['Name', 'Email', 'Username', 'PIN', 'Role', 'Active'], rows);
  return { ok: true, message: 'Employees saved.' };
}

function sdSavePaymentMethods_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  var access = sdRequirePermission_(employee, 'canManagePaymentMethods');
  if (!access.ok) return access;

  var items = payload.paymentMethods || [];
  var rows = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var name = typeof item === 'string' ? sdTrim_(item) : sdTrim_(sdFirstValue_(item, ['Name', 'name'], ''));
    if (!name) continue;

    var active = typeof item === 'string' ? 'Yes' : sdFirstValue_(item, ['Active', 'active'], 'Yes');
    rows.push([name, sdBool_(active) ? 'Yes' : 'No']);
  }

  sdReplaceSheetData_(SD.SHEETS.PAYMENT_METHODS, ['Name', 'Active'], rows);
  return { ok: true, message: 'Payment methods saved.' };
}

function sdLoadAds_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  if (!employee) return { ok: false, message: 'Unauthorized.' };

  var perms = sdRolePermissions_(employee.Role);
  if (!(perms.canManageAds || perms.isOwner || perms.isAdmin || perms.isManager)) {
    return { ok: false, message: 'You do not have permission for that.' };
  }

  var rows = sdSheetRows_(SD.SHEETS.ADS);
  var results = [];
  for (var i = rows.length - 1; i >= 0; i--) results.push(rows[i]);

  return { ok: true, ads: results };
}

function sdSaveAd_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  if (!employee) return { ok: false, message: 'Unauthorized.' };

  var perms = sdRolePermissions_(employee.Role);
  if (!(perms.canManageAds || perms.isOwner || perms.isAdmin || perms.isManager)) {
    return { ok: false, message: 'You do not have permission for that.' };
  }

  var title = sdTrim_(payload.title);
  var adText = sdTrim_(payload.text);
  var status = sdTrim_(payload.status || 'Active');

  if (!title || !adText) {
    return { ok: false, message: 'Ad title and text are required.' };
  }

  sdAppendRow_(SD.SHEETS.ADS, [
    'AD-' + new Date().getTime(),
    new Date(),
    title,
    adText,
    status,
    sdTrim_(employee.Name)
  ]);

  return { ok: true, message: 'Ad saved.' };
}

function sdDeleteAd_(payload) {
  var employee = sdFindEmployee_(payload.email || payload.username || payload.loginValue, payload.pin);
  if (!employee) return { ok: false, message: 'Unauthorized.' };

  var perms = sdRolePermissions_(employee.Role);
  if (!(perms.canManageAds || perms.isOwner || perms.isAdmin || perms.isManager)) {
    return { ok: false, message: 'You do not have permission for that.' };
  }

  var id = sdTrim_(payload.id);
  if (!id) return { ok: false, message: 'Missing ad ID.' };

  var sh = sdSS_().getSheetByName(SD.SHEETS.ADS);
  var data = sh.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (sdTrim_(data[i][0]) === id) {
      sh.deleteRow(i + 1);
      sdInvalidateSheetCache_(SD.SHEETS.ADS);
      return { ok: true, message: 'Ad deleted.' };
    }
  }

  return { ok: false, message: 'Ad not found.' };
}

function sdNextOrderNumber_() {
  var props = PropertiesService.getScriptProperties();
  var stored = sdNum_(props.getProperty('SD_LAST_ORDER_NUM'));
  if (!stored) stored = sdScanMaxOrderNumber_();

  var next = stored + 1;
  props.setProperty('SD_LAST_ORDER_NUM', String(next));
  return SD.DEFAULTS.ORDER_PREFIX + Utilities.formatString('%04d', next);
}

function sdScanMaxOrderNumber_() {
  var sh = sdSS_().getSheetByName(SD.SHEETS.ORDERS);
  if (!sh || sh.getLastRow() <= 1) return 0;

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var maxNum = 0;

  for (var i = 0; i < values.length; i++) {
    var text = sdTrim_(values[i][0]);
    var match = text.match(/(\d+)$/);
    if (match) maxNum = Math.max(maxNum, Number(match[1]));
  }

  return maxNum;
}

function sdSyncOrderCounter_() {
  var maxNum = sdScanMaxOrderNumber_();
  PropertiesService.getScriptProperties().setProperty('SD_LAST_ORDER_NUM', String(maxNum));
  return maxNum;
}

function syncOrderCounter() {
  sdSetup_();
  return sdSyncOrderCounter_();
}

function runSetup() {
  PropertiesService.getScriptProperties().deleteProperty('SD_SETUP_VERSION');
  sdInvalidateAllCaches_();
  sdSetup_();
}

function sdSS_() {
  if (!SD_RUNTIME.ss) SD_RUNTIME.ss = SpreadsheetApp.getActiveSpreadsheet();
  return SD_RUNTIME.ss;
}

function sdJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sdReadBody_(e) {
  var body = {};

  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      body = {};
    }
  }

  if ((!body || !Object.keys(body).length) && e && e.parameter) {
    body = e.parameter;
  }

  if (body && typeof body.payload === 'string') {
    try {
      body.payload = JSON.parse(body.payload);
    } catch (err2) {
      body.payload = {};
    }
  }

  return body || {};
}

function sdGetOrCreateSheet_(sheetName, headers) {
  var ss = sdSS_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var current = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn())).getValues()[0];
    var needsHeader = !sdTrim_(current[0]);

    if (needsHeader) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      for (var i = 0; i < headers.length; i++) {
        if (!sdTrim_(current[i])) sh.getRange(1, i + 1).setValue(headers[i]);
      }
    }
  }

  sh.setFrozenRows(1);
  return sh;
}

function sdAppendRow_(sheetName, row) {
  sdAppendRows_(sheetName, [row]);
}

function sdAppendRows_(sheetName, rows) {
  if (!rows || !rows.length) return;

  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh) throw new Error(sheetName + ' sheet missing.');

  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  sdInvalidateSheetCache_(sheetName);
}

function sdReplaceSheetData_(sheetName, headers, rows) {
  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh) sh = sdGetOrCreateSheet_(sheetName, headers);

  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows && rows.length) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sh.setFrozenRows(1);
  sdInvalidateSheetCache_(sheetName);
}

function sdUpsertKeyValue_(sheetName, key, value) {
  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh) throw new Error(sheetName + ' sheet missing.');

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (sdTrim_(data[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(value);
      sdInvalidateSheetCache_(sheetName);
      return;
    }
  }

  sdAppendRow_(sheetName, [key, value]);
}

function sdSetSetting_(key, value, type) {
  var sh = sdSS_().getSheetByName(SD.SHEETS.SETTINGS);
  if (!sh) throw new Error('Settings sheet missing.');

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (sdTrim_(data[i][0]) === key) {
      sh.getRange(i + 1, 1, 1, 3).setValues([[key, value, type || 'setting']]);
      sdInvalidateSheetCache_(SD.SHEETS.SETTINGS);
      return;
    }
  }

  sdAppendRow_(SD.SHEETS.SETTINGS, [key, value, type || 'setting']);
}

function sdSheetRows_(sheetName) {
  if (SD_RUNTIME.rows && SD_RUNTIME.rows[sheetName]) return SD_RUNTIME.rows[sheetName];

  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() <= 1) {
    SD_RUNTIME.rows[sheetName] = [];
    return SD_RUNTIME.rows[sheetName];
  }

  var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var rows = sdRowsFromValues_(values);

  SD_RUNTIME.rows[sheetName] = rows;
  return rows;
}

function sdSheetLastRows_(sheetName, limit) {
  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() <= 1) return [];

  var lastCol = sh.getLastColumn();
  var lastRow = sh.getLastRow();
  var count = Math.min(limit, lastRow - 1);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sh.getRange(lastRow - count + 1, 1, count, lastCol).getValues();

  values.unshift(headers);
  return sdRowsFromValues_(values);
}

function sdRowsFromValues_(values) {
  if (!values || values.length <= 1) return [];

  var headers = [];
  for (var h = 0; h < values[0].length; h++) headers.push(sdTrim_(values[0][h]));

  var rows = [];
  for (var i = 1; i < values.length; i++) {
    if (!sdRowHasValue_(values[i])) continue;

    var row = {};
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) row[headers[j]] = values[i][j];
    }
    rows.push(row);
  }

  return rows;
}

function sdOrderStats_() {
  var sh = sdSS_().getSheetByName(SD.SHEETS.ORDERS);
  if (!sh || sh.getLastRow() <= 1) return { totalOrders: 0, totalSales: 0 };

  var totalOrders = sh.getLastRow() - 1;
  var totalSales = 0;
  var totalColumn = 10;
  var values = sh.getRange(2, totalColumn, totalOrders, 1).getValues();

  for (var i = 0; i < values.length; i++) totalSales += sdNum_(values[i][0]);

  return {
    totalOrders: totalOrders,
    totalSales: totalSales
  };
}

function sdDataRowCount_(sheetName) {
  var sh = sdSS_().getSheetByName(sheetName);
  if (!sh) return 0;
  return Math.max(0, sh.getLastRow() - 1);
}

function sdSettingsMap_() {
  if (SD_RUNTIME.maps && SD_RUNTIME.maps.settings) return SD_RUNTIME.maps.settings;

  var rows = sdSheetRows_(SD.SHEETS.SETTINGS);
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var key = sdTrim_(rows[i].Key);
    if (key) map[key] = rows[i].Value;
  }

  SD_RUNTIME.maps.settings = map;
  return map;
}

function sdThemeMap_() {
  if (SD_RUNTIME.maps && SD_RUNTIME.maps.theme) return SD_RUNTIME.maps.theme;

  var map = {};
  var defaults = SD.DEFAULTS.THEME;
  var defaultKeys = ['primary', 'primaryDark', 'secondary', 'bg', 'card', 'text', 'muted', 'border'];

  for (var d = 0; d < defaultKeys.length; d++) {
    map[defaultKeys[d]] = defaults[defaultKeys[d]];
  }

  var rows = sdSheetRows_(SD.SHEETS.THEME);
  for (var i = 0; i < rows.length; i++) {
    var key = sdTrim_(rows[i].Key);
    var value = sdTrim_(rows[i].Value);
    if (key && value) map[key] = value;
  }

  SD_RUNTIME.maps.theme = map;
  return map;
}

function sdUITextMap_() {
  if (SD_RUNTIME.maps && SD_RUNTIME.maps.uiText) return SD_RUNTIME.maps.uiText;

  var map = sdDefaultUIText_();
  var rows = sdSheetRows_(SD.SHEETS.UI_TEXT);
  for (var i = 0; i < rows.length; i++) {
    var key = sdTrim_(rows[i].Key);
    if (key) map[key] = sdTrim_(rows[i].Value);
  }

  SD_RUNTIME.maps.uiText = map;
  return map;
}

function sdDefaultUIText_() {
  return {
    loginTitle: "Sean's Donuts Portal",
    loginSubtitle: 'Sign in with your username or email and PIN.',
    dashboardTitle: 'Welcome',
    dashboardSubtitle: 'Portal overview',
    posTitle: 'POS',
    posSubtitle: 'Create a new order',
    ordersTitle: 'Orders',
    ordersSubtitle: 'Search recent orders',
    rewardsTitle: 'Rewards',
    rewardsSubtitle: 'Lookup customer rewards',
    raffleTitle: 'Raffle',
    raffleSubtitle: 'Recent raffle entries',
    payrollTitle: 'Payroll',
    payrollSubtitle: 'View payroll rows',
    settingsTitle: 'Settings',
    settingsSubtitle: 'Owner/Admin controls',
    logoEmoji: SD.DEFAULTS.LOGO_EMOJI
  };
}

function sdGetProducts_() {
  if (SD_RUNTIME.maps && SD_RUNTIME.maps.products) return SD_RUNTIME.maps.products;

  var rows = sdSheetRows_(SD.SHEETS.PRODUCTS);
  var products = [];

  for (var i = 0; i < rows.length; i++) {
    if (!sdBool_(rows[i].Active || 'Yes')) continue;

    products.push({
      name: sdTrim_(rows[i].Name),
      price: sdNum_(rows[i].Price),
      active: true
    });
  }

  SD_RUNTIME.maps.products = products;
  return products;
}

function sdPaymentMethods_() {
  if (SD_RUNTIME.maps && SD_RUNTIME.maps.paymentMethods) return SD_RUNTIME.maps.paymentMethods;

  var rows = sdSheetRows_(SD.SHEETS.PAYMENT_METHODS);
  var methods = [];

  for (var i = 0; i < rows.length; i++) {
    if (sdBool_(rows[i].Active || 'Yes')) methods.push(sdTrim_(rows[i].Name));
  }

  SD_RUNTIME.maps.paymentMethods = methods;
  return methods;
}

function sdFindEmployee_(loginValue, pin) {
  var login = sdLower_(loginValue);
  var enteredPin = sdTrim_(pin);
  if (!login || !enteredPin) return null;

  var rows = sdSheetRows_(SD.SHEETS.EMPLOYEES);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!sdBool_(row.Active || 'Yes')) continue;
    if (!sdPinMatches_(row.PIN, enteredPin)) continue;

    var email = sdLower_(row.Email);
    var username = sdLower_(row.Username);
    var name = sdLower_(row.Name);

    if (login === email || login === username || login === name) return row;
  }

  return null;
}

function sdPinMatches_(storedPin, enteredPin) {
  var stored = sdTrim_(storedPin);
  var entered = sdTrim_(enteredPin);
  if (stored === entered) return true;

  var storedNum = Number(stored);
  var enteredNum = Number(entered);
  return stored !== '' && entered !== '' && !isNaN(storedNum) && !isNaN(enteredNum) && storedNum === enteredNum;
}

function sdRequirePermission_(employee, permission) {
  if (!employee) return { ok: false, message: 'Unauthorized.' };

  var permissions = sdRolePermissions_(employee.Role);
  if (!permissions[permission]) return { ok: false, message: 'You do not have permission for that.' };

  return { ok: true, permissions: permissions };
}

function sdRolePermissions_(roleValue) {
  var role = sdLower_(roleValue || 'employee');
  var isOwner = role === 'owner';
  var isAdmin = role === 'admin' || role === 'administrator';
  var isManager = role === 'manager';
  var isStaff = isOwner || isAdmin || isManager || role === 'employee' || role === 'staff' || role === '';

  return {
    isOwner: isOwner,
    isAdmin: isAdmin,
    isManager: isManager,
    canUsePOS: isStaff,
    canViewOrders: isStaff,
    canViewRewards: isStaff,
    canViewRaffle: isStaff,
    canViewPayroll: isOwner || isAdmin || isManager,
    canViewSettings: isOwner || isAdmin,
    canSaveSettings: isOwner || isAdmin,
    canManageProducts: isOwner || isAdmin,
    canManageEmployees: isOwner || isAdmin,
    canManageTheme: isOwner || isAdmin,
    canManageUIText: isOwner || isAdmin,
    canManagePaymentMethods: isOwner || isAdmin,
    canManageAds: isOwner || isAdmin || isManager,
    canOverrideCheckout: isOwner || isAdmin || isManager
  };
}

function sdInvalidateSheetCache_(sheetName) {
  if (!SD_RUNTIME.rows) SD_RUNTIME.rows = {};
  if (!SD_RUNTIME.maps) SD_RUNTIME.maps = {};

  delete SD_RUNTIME.rows[sheetName];

  if (sheetName === SD.SHEETS.SETTINGS) delete SD_RUNTIME.maps.settings;
  if (sheetName === SD.SHEETS.THEME) delete SD_RUNTIME.maps.theme;
  if (sheetName === SD.SHEETS.UI_TEXT) delete SD_RUNTIME.maps.uiText;
  if (sheetName === SD.SHEETS.PRODUCTS) delete SD_RUNTIME.maps.products;
  if (sheetName === SD.SHEETS.PAYMENT_METHODS) delete SD_RUNTIME.maps.paymentMethods;
}

function sdInvalidateAllCaches_() {
  SD_RUNTIME.rows = {};
  SD_RUNTIME.maps = {};
}

function sdNeedsDefault_(map, key) {
  return !sdHasKey_(map, key) || sdTrim_(map[key]) === '';
}

function sdHasKey_(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key);
}

function sdRowHasValue_(row) {
  for (var i = 0; i < row.length; i++) {
    if (sdTrim_(row[i]) !== '') return true;
  }
  return false;
}

function sdFirstValue_(obj, keys, fallback) {
  if (!obj) return fallback;

  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) return obj[keys[i]];
  }

  return fallback;
}

function sdTrim_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function sdLower_(value) {
  return sdTrim_(value).toLowerCase();
}

function sdNum_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;

  var cleaned = String(value).replace(/[$,]/g, '').trim();
  var num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function sdBool_(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'number') return value !== 0;

  var text = sdLower_(value);
  if (!text) return false;

  return text === 'yes' ||
    text === 'y' ||
    text === 'true' ||
    text === '1' ||
    text === 'active' ||
    text === 'enabled' ||
    text === 'on';
}
