const { app, BrowserWindow, dialog, globalShortcut, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { download } = require("electron-dl");
var win, alertWin, updateWin, alertOption;

function createWindow() {
    win = new BrowserWindow({
        title: "TGPSI Share",
        width: 280,
        height: 370,
        minWidth: 280,
        maxWidth: 280,
        minHeight: 370,
        maxHeight: 370,
        frame: false,
        transparent: true,
        resizable: false,
        fullscreen: false,
        fullscreenable: false,
        maximizable: false,
        show: false,
        icon: path.join(__dirname, "assets/logo.png"),
        sandbox: true,
        webPreferences: {
            devTools: true,
            preload: path.join(__dirname, "preload/home.js")
        }
    });

    win.loadFile("index.html");

    win.once("ready-to-show", () => {
        win.show();

        if (process.argv[2] != undefined && process.argv[2].replace("tgpsi-share://", "").startsWith("download/"))
            win.webContents.send("URIDownload", process.argv[2].replace("tgpsi-share://download/", ""));
    });
}

//#region BASIC COMPONENTS

if (!fs.existsSync(app.getPath("userData") + "\\history.json"))
    fs.writeFileSync(app.getPath("userData") + "\\history.json", JSON.stringify({ "transfers": [] }, null, 4), "utf8");
    
if (!fs.existsSync(app.getPath("userData") + "\\config.json"))
    fs.writeFileSync(app.getPath("userData") + "\\config.json", JSON.stringify({ "scheme": "system", "beta": false }, null, 4), "utf8");

if (fs.existsSync(app.getPath("temp") + "\\TGPSI Update\\TGPSI-Share-Setup.exe")) {
    try {
        fs.unlinkSync(app.getPath("temp") + "\\TGPSI Update\\TGPSI-Share-Setup.exe");
    } catch (error) {}
}

//#endregion

//#region APP EVENTS

if (process.defaultApp) {
    if (process.argv.length >= 2)
        app.setAsDefaultProtocolClient("tgpsi-share", process.execPath, [path.resolve(process.argv[1])])
}
else
    app.setAsDefaultProtocolClient("tgpsi-share")

if (!app.requestSingleInstanceLock())
    app.quit()
else {
    app.on("second-instance", () => {
        if (win.isMinimized())
            win.restore();
        win.focus();
    });

    app.whenReady().then(() => {
        createWindow();
    
        globalShortcut.register("Control+Shift+I", () => {
            return false;
        });
        
        globalShortcut.register("Control+Shift+D", () => {
            if (BrowserWindow.getFocusedWindow())
                BrowserWindow.getFocusedWindow().webContents.openDevTools();
        });
    });
}

app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        app.quit();
});

//#endregion

//#region RENDER EVENTS

function GetWindowId(title) {
    for (let i = 0; i < BrowserWindow.getAllWindows().length; i++) {
        if (BrowserWindow.getAllWindows()[i].title == title)
            return i;
    }
}

ipcMain.on("CloseApplication", () => {
    app.quit();
});

ipcMain.on("WinClose", (_, window) => {
    BrowserWindow.getAllWindows()[GetWindowId(window)].close();
});

ipcMain.on("WinMinimize", (_, window) => {
    BrowserWindow.getAllWindows()[GetWindowId(window)].minimize();
});

ipcMain.on("WinResize", (_, window, height) => {
    BrowserWindow.getAllWindows()[GetWindowId(window)].setMinimumSize(BrowserWindow.getAllWindows()[GetWindowId(window)].getSize()[0], height);
    BrowserWindow.getAllWindows()[GetWindowId(window)].setMaximumSize(BrowserWindow.getAllWindows()[GetWindowId(window)].getSize()[0], height);
    BrowserWindow.getAllWindows()[GetWindowId(window)].setSize(BrowserWindow.getAllWindows()[GetWindowId(window)].getSize()[0], height, false);
});

ipcMain.on("GetPackageData", (event) => {
    event.returnValue = fs.readFileSync(path.join(__dirname, "package.json"), "utf8");
});

ipcMain.on("GetPaths", (event, name) => {
    event.returnValue = app.getPath(name);
});

ipcMain.on("GetConfig", (event) => {
    event.returnValue = fs.readFileSync(app.getPath("userData") + "\\config.json", "utf8");
});

ipcMain.on("GetDatabaseKeys", (event) => {
    event.returnValue = ["m83fXSwdSQu2avUvcVwF4O35opPWcYDYpRiSFo4h", "GNdFhSJuD33FJLe0OpncOttqMX6vy8MXzXYasG5F", "R28hQbDHYmafSsBcTBsTZyCFfn4Fvkc5WjuPm15k"];
});

ipcMain.on("AlertShow", async (event, window, info) => {
    alertWin = new BrowserWindow({
        title: "Alert",
        width: 400,
        height: 200,
        frame: false,
        transparent: true,
        resizable: false,
        fullscreen: false,
        fullscreenable: false,
        maximizable: false,
        parent: BrowserWindow.getAllWindows()[GetWindowId(window)],
        modal: true,
        show: false,
        sandbox: true,
        webPreferences: {
            devTools: true,
            preload: path.join(__dirname, "preload/alert.js")
        }
    });

    await alertWin.loadFile("assets/alert/alert.html");
    alertWin.once("focus", () => alertWin.webContents.send("ResizeFit", "ALERT"));

    alertWin.webContents.send("AlertSendInfo", info);
    alertWin.show();

    ipcMain.on("SaveAlertOption", (_, option) => alertOption = option);

    alertWin.once("closed", () => event.returnValue = alertOption);
});

ipcMain.on("UpdateShow", async (_, startup) => {
    let foundUpdateWin = undefined;

    for (const window of BrowserWindow.getAllWindows()) {
        if (window.title == "TGPSI Update") {
            foundUpdateWin = window;
            break;
        }
    }

    if (foundUpdateWin == undefined) {
        updateWin = new BrowserWindow({
            title: "TGPSI Update",
            width: 400,
            height: 200,
            frame: false,
            transparent: true,
            resizable: false,
            fullscreen: false,
            fullscreenable: false,
            maximizable: false,
            show: false,
            icon: path.join(__dirname, "assets/updater/update.png"),
            sandbox: true,
            webPreferences: {
                devTools: true,
                preload: path.join(__dirname, "preload/updater.js")
            }
        });

        await updateWin.loadFile("assets/updater/updater.html");
        updateWin.once("focus", () => updateWin.webContents.send("ResizeFit", "UPDATE"));

        function ShowOrClose(_, show) {
            if (show)
                updateWin.show();
            else
                updateWin.close();
            ipcMain.off("UpdateStartup", ShowOrClose);
        }

        if (startup)
            ipcMain.on("UpdateStartup", ShowOrClose);
        else
            updateWin.show();
    }
    else
        foundUpdateWin.focus();
});

ipcMain.on("ShowOpenDialog", async (event, window, options) => {
    event.returnValue = await dialog.showOpenDialog(BrowserWindow.getAllWindows()[GetWindowId(window)], options);
});

ipcMain.on("ShowSaveDialog", async (event, window, options) => {
    event.returnValue = await dialog.showSaveDialog(BrowserWindow.getAllWindows()[GetWindowId(window)], options);
});

ipcMain.on("Download", (_, window, info) => {
    info.events.window = BrowserWindow.getAllWindows()[GetWindowId(window)];
    info.options.onProgress = (progress) => {
        if (info.events.progress != null)
            info.events.window.webContents.send(info.events.progress, progress);
    };
    info.options.onCompleted = (complete) => {
        if (info.events.complete != null)
            info.events.window.webContents.send(info.events.complete, complete);
    };

    download(BrowserWindow.getAllWindows()[GetWindowId(window)], info.url, info.options);
});

ipcMain.on("RefreshAppearance", () => {
    for (const window of BrowserWindow.getAllWindows())
        window.webContents.send("RefreshAppearance");
});

//#endregion