const { clipboard, ipcRenderer, shell } = require("electron");
const fs = require("fs");
const { getInfo, upload } = require("wetransfert");
const Parse = require("parse/node");
const crypto = require("crypto");

//#region INITIALIZATION

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", RefreshAppearance);
window.addEventListener("load", () => RefreshAppearance());

let parseKeys = ipcRenderer.sendSync("GetDatabaseKeys");
Parse.serverURL = "https://parseapi.back4app.com";
Parse.initialize(parseKeys[0], parseKeys[1], parseKeys[2]);

//#endregion

//#region FUNCTIONS

/**
 * Creates the LoadGIF element
 * @returns LoadGIF element
 */
function LoadGif() {
    let loadGif = document.createElement("img");
    loadGif.src = document.title == "TGPSI Share" ? "./assets/load.gif" : "../load.gif";
    return loadGif;
}

/**
 * Closes the current BrowserWindow
 */
function CloseWindow() {
    ipcRenderer.send("WinClose", document.title);
}

/**
 * Minimizes the current BrowserWindow
 */
function MinimizeWindow() {
    ipcRenderer.send("WinMinimize", document.title);
}

/**
 * Resizes the current BrowserWindow to the specified height
 * @param {String} height A string containing the height in pixels
 */
function ResizeWindow(height) {
    ipcRenderer.send("WinResize", document.title, Number(height.replace("px", "")) + document.getElementById("frameBar").offsetHeight);
}

/**
 * Resizes the Alert BrowserWindow or the Updater BrowserWindow to fit the content
 * @param {String} mode The mode containing the window to resize. `ALERT` or `UPDATE`.
 */
function ResizeToFit(mode) {
    if (mode == "ALERT")
        ResizeWindow(document.getElementById("alertContent").offsetHeight + "px");
    else if (mode == "UPDATE")
        ResizeWindow(document.getElementById("updaterContent").offsetHeight + "px");
}

/**
 * Asks the main process for an appearance refresh
 */
function RefreshAppearance() {
    ipcRenderer.send("RefreshAppearance");
}

/**
 * Asks for a refresh on the account assets
 */
async function RefreshAccount() {
    let userInfo = await Parse.User.currentAsync();
    
    if (userInfo != null) {
        if (!userInfo.attributes.photo._url.endsWith(".svg")) {
            document.querySelector("#welcomeSlide3 > div > div").innerHTML = "<img src=\"" + userInfo.attributes.photo._url + "\"></img>";
            document.querySelector("#helloPanel > div").innerHTML = "<img src=\"" + userInfo.attributes.photo._url + "\"></img>";
            document.querySelector("#profileSpace > div").innerHTML = "<img src=\"" + userInfo.attributes.photo._url + "\"></img>";
            document.querySelector("#accountPanel > .imageTitle > div").innerHTML = "<img src=\"" + userInfo.attributes.photo._url + "\"></img>";
        }
        document.querySelector("#helloPanel > h4").innerText = userInfo.attributes.username;
        document.getElementById("accountUsername").innerText = userInfo.attributes.username;
        document.querySelector("#accountPanel > button").innerText = "Terminar Sessão";
        for (const button of document.getElementById("accountButtons").getElementsByTagName("a"))
            button.removeAttribute("lock");
        document.getElementById("settingsPassword").disabled = false;
        document.getElementById("settingsPasswordChange").disabled = false;
        document.getElementById("settingsDeleteAccount").disabled = false;
    }
    else {
        document.querySelector("#welcomeSlide3 > div > div").innerHTML = "<icon name=\"account\"></icon>";
        document.querySelector("#helloPanel > div").innerHTML = "<icon name=\"account\"></icon>";
        document.querySelector("#profileSpace > div").innerHTML = "<icon name=\"account\"></icon>";
        document.querySelector("#accountPanel > .imageTitle > div").innerHTML = "<icon name=\"account\"></icon>";
        ReloadIcons();
        document.getElementById("accountUsername").innerText = "Conta";
        document.querySelector("#accountPanel > button").innerText = "Iniciar Sessão";
        for (const button of document.getElementById("accountButtons").getElementsByTagName("a"))
            button.setAttribute("lock", "");
        document.getElementById("settingsPassword").disabled = true;
        document.getElementById("settingsPasswordChange").disabled = true;
        document.getElementById("settingsDeleteAccount").disabled = true;
    }
}

/**
 * Reloads the icons embed on the page HTML
 */
async function ReloadIcons() {
    for (const icon of document.getElementsByTagName("icon")) {
        let iconXML = await fetch("./assets/icons/" + icon.getAttribute("name") + ".svg");
        icon.innerHTML = await iconXML.text();
    }
}

/**
 * Gets the informations about the package
 * @returns The information saved in `package.json`
 */
function GetPackageData() {
    return JSON.parse(ipcRenderer.sendSync("GetPackageData"));
}

/**
 * Gets the informations about the processes
 * @returns The information about the running processes
 */
function GetProcessVersions() {
    return process.versions;
}

/**
 * Gets the path of a special folder
 * @param {String} name The folder name to get the path
 * @returns The absolute path to the folder
 */
async function GetPaths(name) {
    return await ipcRenderer.sendSync("GetPaths", name);
}

/**
 * Gets the current settings of the application
 * @returns The informations saved on the `config.json` file
 */
async function GetConfig() {
    return await JSON.parse(ipcRenderer.sendSync("GetConfig"));
}

/**
 * Prepares and shows the alert to the user locking the parent BrowserWindow.
 * @param {String} text The text to appear in the alert
 * @param {Number} button A number representing the buttons to show.
 * - `1` - OK
 * - `2` - Yes and No
 * @param {String} icon The name of the icon to be displayed
 * @returns The option chosen on the alert. (0 - OK, 1 - Yes, 2 - No)
 */
async function ShowAlert(text, button, icon) {
    return await ipcRenderer.sendSync("AlertShow", document.title, {
        text: text,
        buttons: button,
        icon: icon
    });
}

/**
 * Shows specific options on a specified element
 * @param {String} mode The action you want to execute
 * - `ADD` - Adds the options to the target
 * - `REMOVE` - Restores the value of the target element
 * @param {HTMLElement} target The element where the option elements should be added
 * @param {String} attribute The name of the attribute to pull information from (only required for the `REMOVE` action)
 * @param {Array<Object>} icons An array of objects containing informations about the icons to add (only required for the `ADD` action)
 */
async function ClickOptions(mode, target, attribute, icons) {
    if (mode == "ADD") {
        target.style.opacity = "0";
        await Sleep(200);
        target.innerHTML = "";
        for (const icon of icons) {
            let createIcon = document.createElement("icon");
            createIcon.setAttribute("name", icon.name);
            createIcon.title = icon.title;
            createIcon.addEventListener("click", icon.function);
            target.appendChild(createIcon);
        }
        ReloadIcons();
        target.removeAttribute("style");
    }
    else if (mode == "REMOVE") {
        target.style.opacity = "0";
        await Sleep(200);
        target.innerHTML = target.getAttribute(attribute);
        target.removeAttribute("style");
    }
}

/**
 * Shows the open dialog to the user
 * @param {String[]} filters The filters to apply to the open dialog
 * @param {String[]} properties The properties to apply to the open dialog
 * @returns The information about the dialog
 */
async function ShowOpenDialog(filters, properties) {
    return await ipcRenderer.sendSync("ShowOpenDialog", document.title, {
        title: "Escolher ficheiros",
        buttonLabel: "Selecionar",
        filters: filters,
        properties: properties
    });
}

/**
 * Checks if the path leads to a folder or a file
 * @param {String} path The path to be analysed
 * @returns `true` if the path leads to a folder or `false` if the path leads to a file
 */
function CheckIfFolder(path) {
    return fs.lstatSync(path).isDirectory();
}

/**
 * Sends the selected files to WeTransfer
 * @param {String[Object]} files An array of objects with informations about the files to send
 * @param {String} message The message to send with the transfer 
 * @returns The information about the files sending
 */
async function SendFile(files, message) {
    return new Promise((resolve) => {
        let filePaths = new Array();

        for (const file of files) {
            filePaths.push(file.path);
            if (!fs.existsSync(file.path))
                throw new Error("File does not exist anymore");
        }

        upload("", "", filePaths, message, "pt")
            .on("progress", (progress) => document.getElementById("sendProgressBar").style.width = (progress.percent * 100) + "%")
            .on("end", (end) => resolve(end));
    });
}

/**
 * Copies text to the clipboard
 * @param {String} value The value to be copied to the clipboard
 */
function CopyToClipboard(value) {
    clipboard.writeText(value);
}

/**
 * Checks if the transfer code is valid
 * @param {String} transferCode The code of the transfer to check
 * @returns The Information about the transfer
 * - *valid* `Boolean` - Tells if the transferCode is valid
 * - *message* `String` `null` - The message sent with this transfer
 */
async function CheckTransferCode(transferCode) {
    try {
        let wtRequest = await getInfo(`https://we.tl/t-${transferCode}`);
        return {
            valid: wtRequest.downloadURI ? true : false,
            message: wtRequest.content.description ? wtRequest.content.description : null
        }
    }
    catch {
        return {
            valid: false,
            message: null
        }
    }
}

/**
 * Receives the file(s) with that transfer code
 * @param {String} transferCode The code of the transfer to receive
 */
async function ReceiveFile(transferCode) {
    let wtRequest = await getInfo(`https://we.tl/t-${transferCode}`), transferInfo = new Array();
    transferInfo[0] = wtRequest.content.description;
    transferInfo[1] = wtRequest.content.items[0].name;
    transferInfo[2] = wtRequest.content.items.length == 1 ? wtRequest.content.items[0].name.match(/\.[0-9a-z]+$/gi)[0] : ".zip";
    transferInfo[3] = wtRequest.content.items.length;

    let defaultName = transferInfo[3] == 1 ? transferInfo[1] : transferCode + transferInfo[2];
    let saveInfo = ipcRenderer.sendSync("ShowSaveDialog", document.title, {
        title: "Guardar Transferência",
        defaultPath: "*/" + defaultName,
        filters: [
            {
                name: "Ficheiro (" + transferInfo[2] + ")",
                extensions: [ transferInfo[2] ]
            }
        ],
        properties: ["createDirectory", "showOverwriteConfirmation"]
    });
    if (saveInfo.canceled == false) {
        ipcRenderer.send("Download", document.title, {
            url: wtRequest.downloadURI,
            options: {
                directory: saveInfo.filePath.match(/(.*)\\/g)[0],
                filename: saveInfo.filePath.match(/(?:.(?<!\\))+$/g)[0]
            },
            events: {
                progress: null,
                complete: "FinishedReceiving"
            },
            update: false
        });
    }
    else
        RollbackReceivePanel();
}

/**
 * Manages and creates user accounts directly on the TGPSI Login Database
 * @param {String} mode The action you want to execute on the account
 * - `GET` - Gets information stored on the user account
 * - `REGIST` - Regists a new user account on the database
 * - `LOGIN` - Logs the user into its account
 * - `LOGOUT` - Logs the user out
 * - `RESET` - Resets the user password
 * - `DELETE` - Deletes the user from the database
 * @param {Object|null} args Aditional information needed for certain modes
 * - `GET` `LOGOUT` `DELETE` - *null*
 * - `REGIST` - *Object* with name, email, photo and password
 * - `LOGIN` - *Object* with name and password or stored
 * - `RESET` - *String* with the new password
 * @returns {Object|null}
 * - `GET` - *Object* containing the user info
 * - `REGIST` `LOGIN` `LOGOUT` `RESET` `DELETE` - *null*
 */
async function AccountManager(mode, args) {
    if (mode == "GET")
        return await Parse.User.currentAsync();
    else if (mode == "REGIST") {
        let user = new Parse.User();

        user.set("username", args.name);
        user.set("email", args.email);
        if (args.photo != "")
            user.set("photo", new Parse.File("photo", { uri: args.photo }));
        user.set("password", crypto.createHash("sha512").update(args.password).digest("hex"));

        try {
            await user.signUp();
            RefreshAccount();
            fs.writeFileSync((await GetPaths("userData")) + "\\account.json", JSON.stringify({ "username": args.name, "password": crypto.createHash("sha512").update(args.password).digest("hex") }, null, 4), "utf8");
        }
        catch (error) {
            if (error.toString().includes("Account already exists for this username"))
                throw new Error("Username taken");
            else if (error.toString().includes("Account already exists for this email address"))
                throw new Error("Email taken");
        }
    }
    else if (mode == "LOGIN") {
        try {
            if (!args.stored) {
                await Parse.User.logIn(args.name, crypto.createHash("sha512").update(args.password).digest("hex"));
                fs.writeFileSync((await GetPaths("userData")) + "\\account.json", JSON.stringify({ "username": args.name, "password": crypto.createHash("sha512").update(args.password).digest("hex") }, null, 4), "utf8");
            }
            else if (fs.existsSync((await GetPaths("userData")) + "\\account.json")) {
                let loadAccElmt = LoadGif();
                loadAccElmt.setAttribute("notask", "");
                document.getElementById("profileSpace").appendChild(loadAccElmt);
                let storedData = await JSON.parse(fs.readFileSync((await GetPaths("userData")) + "\\account.json", "utf8"));
                await Parse.User.logIn(storedData.username, storedData.password);
                document.getElementById("profileSpace").removeChild(document.getElementById("profileSpace").lastElementChild);
            }
            RefreshAccount();
        }
        catch (error) {
            if (error.toString().includes("Invalid username/password"))
                throw new Error("Invalid data");
            else if (error.toString().includes("Your account is locked due to multiple failed login attempts"))
                throw new Error("Locked account");
        }
    }
    else if (mode == "LOGOUT") {
        await Parse.User.logOut();
        RefreshAccount();
        fs.unlinkSync((await GetPaths("userData")) + "\\account.json");
    }
    else if (mode == "RESET") {
        let user = Parse.User.current();

        user.set("password", crypto.createHash("sha512").update(args).digest("hex"));
        await user.save();

        fs.writeFileSync((await GetPaths("userData")) + "\\account.json", JSON.stringify({ "username": user.getUsername(), "password": crypto.createHash("sha512").update(args).digest("hex") }, null, 4), "utf8");
    }
    else if (mode == "DELETE") {
        await Parse.User.current().destroy();
        RefreshAccount();
        fs.unlinkSync((await GetPaths("userData")) + "\\account.json");
    }
}

/**
 * Manages history entries using the database
 * @param {String} mode The action you want to execute on history
 * - `GET` - Get all the history entries
 * - `ADD` - Adds an entry to the history
 * - `REMOVE` - Remove an entry from the history
 * - `CLEAR` - Clears all the history entries
 * @param {String} code The code to add or remove from history (only for `ADD` and `REMOVE` actions)
 * @param {String} expire The expire date for the transfer code (only for `ADD` and `REMOVE` actions)
 * @returns {Array|null}
 * - `GET` - Returns a Array containing all the history entries
 * - `ADD` `REMOVE` `CLEAR` - Always returns null
 */
async function HistoryManager(mode, code, expire) {
    if (mode == "GET")
        document.querySelector("#historyPanel > .sideFooter").appendChild(LoadGif());
    var user = await AccountManager("GET");
    var historyData = user.attributes.history;

    if (mode == "GET") {
        document.querySelector("#historyPanel > .sideFooter").removeChild(document.querySelector("#historyPanel > .sideFooter > img"));
        return historyData;
    }
    else if (mode == "ADD") {
        document.getElementById("profileSpace").appendChild(LoadGif());
        historyData.push({
            "code": code,
            "expire": expire
        });
    }
    else if (mode == "REMOVE") {
        for (let i = 0; i < historyData.length; i++) {
            if (JSON.stringify(historyData[i]) == JSON.stringify({ "code": code, "expire": expire }))
                historyData.splice(i, 1);
        }
    }
    else if (mode == "CLEAR")
        historyData = [];
    user.set("history", historyData);
    await user.save();
    if (mode == "ADD")
        document.getElementById("profileSpace").removeChild(document.getElementById("profileSpace").lastElementChild);
}

/**
 * Opens the updater window that will check for application updates
 * @param {Boolean} startup Indicates if the update checking is occuring on the startup process
 */
function OpenUpdater(startup) {
    ipcRenderer.send("UpdateShow", startup);
}

/**
 * Downloads an update from the given URL
 * @param {String} updateUrl The URL to download the update from
 */
async function DownloadUpdate(updateUrl) {
    ipcRenderer.send("Download", document.title, {
        url: updateUrl,
        options: {
            directory: (await GetPaths("temp")) + "\\TGPSI Update\\",
            filename: "TGPSI-Share-Setup.exe"
        },
        events: {
            progress: "UpdateProgress",
            complete: "UpdateComplete"
        }
    });
}

/**
 * Stops the JavaScript execution code for the given time
 * @param {Number} milliseconds The number of milliseconds that the code should wait
 * @returns The NodeJS timeout object
 */
function Sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

//#endregion

//#region RENDER LISTENERS

ipcRenderer.on("RefreshAppearance", async () => {
    let scheme = (await GetConfig()).scheme;
    if (scheme == "system") {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches)
            document.documentElement.setAttribute("theme", "dark");
        else
            document.documentElement.setAttribute("theme", "light");
    }
    else
        document.documentElement.setAttribute("theme", scheme);
});

ipcRenderer.on("ResizeFit", (_, mode) => {
    ResizeToFit(mode);
});

ipcRenderer.on("URIDownload", (_, code) => {
    window.addEventListener("load", async () => {
        await Sleep(1000);
        document.querySelectorAll("#homePanel > button:last-child")[0].click();
        document.getElementById("fileCode").value = code;
        await Sleep(400);
        document.getElementById("filesReceive").disabled = false;
        document.getElementById("filesReceive").click();
    });
});

ipcRenderer.on("AlertSendInfo", (_, info) => {
    document.querySelector("#alertContent > div:first-child > img").setAttribute("src", `./${info.icon}.svg`);
    document.querySelector("#alertContent > div:first-child > p").innerHTML = info.text;
    if (info.buttons == 1)
        document.querySelector("#alertContent > div:last-child > div:first-child").style.display = "flex";
    else if (info.buttons == 2)
        document.querySelector("#alertContent > div:last-child > div:last-child").style.display = "flex";
});

ipcRenderer.on("FinishedReceiving", RollbackReceivePanel);

function RollbackReceivePanel() {
    document.querySelector("#receivePanel > .sideFooter > a").removeAttribute("lock");
    document.querySelector("#receivePanel > .sideFooter > div").removeChild(document.querySelector("#receivePanel > .sideFooter > div > img"));
    document.getElementById("filesReceive").disabled = false;
    document.getElementById("fileCode").disabled = false;
}

ipcRenderer.on("UpdateProgress", (_, info) => {
    document.getElementById("updateProgressBar").classList.remove("indeterminate");
    document.getElementById("updateDescription").innerHTML = "A transferir: " + Math.round(info.percent * 100) + "%";
    document.getElementById("updateProgressBar").style.width = info.percent * 100 + "%";
});

ipcRenderer.on("UpdateComplete", async (_, info) => {
    document.getElementById("updateDescription").innerHTML = "Concluído!";
    await shell.openPath(info.path);
    ipcRenderer.sendSync("CloseApplication");
});

//#endregion

exports.LoadGif = LoadGif;
exports.CloseWindow = CloseWindow;
exports.MinimizeWindow = MinimizeWindow;
exports.ResizeWindow = ResizeWindow;
exports.ResizeToFit = ResizeToFit;
exports.RefreshAppearance = RefreshAppearance;
exports.RefreshAccount = RefreshAccount;
exports.ReloadIcons = ReloadIcons;
exports.GetPackageData = GetPackageData;
exports.GetProcessVersions = GetProcessVersions;
exports.GetPaths = GetPaths;
exports.GetConfig = GetConfig;
exports.ShowAlert = ShowAlert;
exports.ClickOptions = ClickOptions;
exports.ShowOpenDialog = ShowOpenDialog;
exports.CheckIfFolder = CheckIfFolder;
exports.SendFile = SendFile;
exports.CopyToClipboard = CopyToClipboard;
exports.CheckTransferCode = CheckTransferCode;
exports.ReceiveFile = ReceiveFile;
exports.AccountManager = AccountManager;
exports.HistoryManager = HistoryManager;
exports.OpenUpdater = OpenUpdater;
exports.DownloadUpdate = DownloadUpdate;
exports.Sleep = Sleep;