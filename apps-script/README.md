# Apps Script Backend

These files power the Sean's Donuts portal API.

- `Code.gs` handles actions such as login, orders, rewards, applications, contact messages, inventory, bank balance, ads, and settings.
- `Helpers.gs` contains shared helpers for Sheets, permissions, formatting, cleanup, and data conversion.

After editing these files in GitHub, copy them into the Google Apps Script project and save.

Recommended after backend updates:

```js
runSetup()
cleanUpSheets()
```

`runSetup()` creates or updates required sheets. `cleanUpSheets()` formats the spreadsheet tabs so they are easier to read.
