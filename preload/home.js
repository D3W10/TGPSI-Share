const { shell } = require("electron");
const fs = require("fs");
const preload = require("./preload");
const { Sleep } = require("./preload");

window.addEventListener("load", () => {
    var appSizes = {}, contextOpen = false, selectedFiles = new Array(), byteUnits = ["Bytes", "KB", "MB", "GB", "TB"], openPanel = null;
    var appContent = document.getElementById("appContent");

    //#region INITIALIZATION

    (async function () {
        await preload.ReloadIcons();

        for (const panel of document.querySelectorAll("#appContent > *")) {
            appSizes[panel.id] = panel.offsetHeight + "px";
            if (panel.id == "homePanel" && navigator.onLine) {
                document.getElementById("homePanel").style.display = "block";
                document.getElementById("homePanel").style.opacity = "1";
                openPanel = "homePanel";
                appContent.style.height = appSizes.homePanel;
                preload.ResizeWindow(appSizes.homePanel);
            }
            else if (panel.id == "offlinePanel" && !navigator.onLine) {
                document.getElementById("offlinePanel").style.display = "block";
                document.getElementById("offlinePanel").style.opacity = "1";
                openPanel = "offlinePanel";
                appContent.style.height = appSizes.offlinePanel;
                preload.ResizeWindow(appSizes.offlinePanel);
            }
            else {
                panel.style.display = "none";
                panel.style.opacity = "0";
            }
        }
        appSizes.contextWidth = document.getElementById("contextMenu").offsetWidth + "px";
        appSizes.contextHeight = document.getElementById("contextMenu").offsetHeight + "px";
        document.getElementById("contextMenu").style.display = "none";
        document.getElementById("contextMenu").style.width = "0";
        document.getElementById("contextMenu").style.height = "0";
        document.getElementById("contextMenu").style.padding = "0";

        for (const element of document.querySelectorAll("button, a")) {
            element.addEventListener("click", async (event) => {
                if (element.getAttribute("goto") != null) {
                    let panelToSwitch = event.currentTarget.getAttribute("goto"), appContentSize = appContent.style.height;
                    if (!event.currentTarget.hasAttribute("lock") && openPanel != panelToSwitch) {
                        document.getElementById(openPanel).style.opacity = "0";
                        await Sleep(400);
                        document.getElementById(openPanel).style.display = "none";

                        if (appContentSize < appSizes[panelToSwitch])
                            preload.ResizeWindow(appSizes[panelToSwitch]);

                        if (panelToSwitch == "helloPanel")
                            HelloAnimation(false);

                        appContent.style.height = appSizes[panelToSwitch];
                        openPanel = panelToSwitch;

                        if (panelToSwitch == "historyPanel")
                            HistoryDisplay();

                        document.getElementById(panelToSwitch).style.display = "block";
                        await Sleep(400);

                        if (appContentSize > appSizes[panelToSwitch])
                            preload.ResizeWindow(appSizes[panelToSwitch]);

                        document.getElementById(panelToSwitch).style.opacity = "1";
                        await Sleep(400);

                        if (panelToSwitch == "helloPanel")
                            HelloAnimation(true);
                    }
                }
            });  
        }

        let config = await preload.GetConfig();

        document.getElementById("settingsScheme").value = config.scheme;
        document.getElementById("settingsBeta").checked = config.beta;
    }());

    preload.AccountManager("LOGIN", { stored: true });
    
    window.addEventListener("online", () => document.getElementById(navigator.onLine ? "exitOffline" : "enterOffline").click());
    window.addEventListener("offline", () => document.getElementById(navigator.onLine ? "exitOffline" : "enterOffline").click());

    preload.OpenUpdater(true);

    //#endregion

    //#region FRAME BAR

    document.getElementById("closeCircle").addEventListener("click", CloseWindow);

    window.addEventListener("keydown", (event) => {
        if (event.key == "F4" && event.altKey) {
            event.preventDefault();
            CloseWindow();
        }
    });

    function CloseWindow() {
        for (const image of document.getElementsByTagName("img")) {
            if (image.src.endsWith("/load.gif") && !image.hasAttribute("notask")) {
                preload.ShowAlert("Existe uma operação em execução. Por favor espere que esta acabe e tente novamente.", 1, "info");
                return;
            }
        }
        preload.CloseWindow();
    }

    document.getElementById("minimizeCircle").addEventListener("click", () => {
        preload.MinimizeWindow();
    });

    //#endregion

    //#region HOME PANEL

    document.getElementById("profileSpace").addEventListener("click", contextMenuOpen);

    document.getElementById("appContent").addEventListener("click", () => {
        if (contextOpen)
            contextMenuOpen();
    });

    async function contextMenuOpen() {
        if (!document.getElementById("profileSpace").hasAttribute("lock")) {
            document.getElementById("profileSpace").setAttribute("lock", "");
            if (!contextOpen) {
                document.getElementById("contextMenu").style.display = "flex";
                await Sleep(50);
                document.getElementById("contextMenu").style.width = appSizes.contextWidth;
                document.getElementById("contextMenu").style.height = appSizes.contextHeight;
                document.getElementById("contextMenu").style.padding = "5px";
                await Sleep(400);
                document.getElementById("contextMenu").childNodes.forEach(element => {
                    if (element.localName)
                        element.style.opacity = "1";
                });
                contextOpen = true;
            }
            else {
                document.getElementById("contextMenu").childNodes.forEach(element => {
                    if (element.localName)
                        element.removeAttribute("style");
                });
                await Sleep(400);
                document.getElementById("contextMenu").style.width = "0";
                document.getElementById("contextMenu").style.height = "0";
                document.getElementById("contextMenu").style.padding = "0";
                await Sleep(400);
                document.getElementById("contextMenu").style.display = "none";
                contextOpen = false;
            }
            document.getElementById("profileSpace").removeAttribute("lock");
        }
    }

    //#endregion

    //#region SEND PANEL

    document.getElementById("filesDragAndDrop").addEventListener("click", () => SelectFiles("CLICK"));
    document.getElementById("addFiles").addEventListener("click", () => {
        if (!document.getElementById("addFiles").hasAttribute("lock"))
            SelectFiles("CLICK");
    });

    document.getElementById("filesDragAndDrop").ondragenter = () => DragAndDrop("enter");
    document.getElementById("filesDragAndDrop").ondragover = () => DragAndDrop("over");
    document.getElementById("filesDragAndDrop").ondragleave = () => DragAndDrop("leave");
    document.getElementById("filesDragAndDrop").addEventListener("drop", (event) => {
        e.preventDefault();
        DragAndDrop("drop", event);
    });

    async function DragAndDrop(mode, event) {
        if (!document.getElementById("filesDragAndDrop").hasAttribute("lock")) {
            if (mode == "enter" || mode == "over") {
                document.getElementById("textChoose").innerText = "Preparado para enviar!";
                document.getElementById("textDrop").innerText = "Apenas larga-o e eu trato do resto!";
                document.getElementById("filesInputBox").style.borderColor = "var(--little)";
            }
            else if (mode == "leave") {
                document.getElementById("textChoose").innerText = "Escolher ficheiros";
                document.getElementById("textDrop").innerText = "Ou arraste para aqui!";
                document.getElementById("filesInputBox").removeAttribute("style");
            }
            else if (mode == "drop") {
                document.getElementById("textChoose").innerText = "Escolher ficheiros";
                document.getElementById("textDrop").innerText = "Ou arraste para aqui!";
                SelectFiles("DROP", event);
            }
        }
    }

    async function SelectFiles(mode, event) {
        if (!document.getElementById("filesDragAndDrop").hasAttribute("lock")) {
            let selectedFilesRollback = [...selectedFiles], totalFileSize = 0;

            if (mode == "CLICK") {
                let filesDialog = await preload.ShowOpenDialog([{ name: "Todos os ficheiros", extensions: ["*"] }], ["openFile", "multiSelections", "createDirectory"]);
                if (filesDialog.canceled)
                    return;
                
                for (const path of filesDialog.filePaths) {
                    let obj = {
                        name: path.replace(/.*[\/\\]/, ""),
                        path: path,
                        size: fs.statSync(path).size
                    }

                    if (!selectedFiles.includes(obj)) {
                        selectedFiles.push(obj);
                        totalFileSize += obj.size;
                    }
                }
            }
            else if (mode == "DROP") {
                for (const file of event.dataTransfer.files) {
                    if (!preload.CheckIfFolder(file.path)) {
                        let obj = {
                            name: file.name,
                            path: file.path,
                            size: fs.statSync(file.path).size
                        }

                        if (!selectedFiles.includes(obj)) {
                            selectedFiles.push(obj);
                            totalFileSize += obj.size;
                        }
                    }
                }
            }

            for (const file of selectedFiles)
                totalFileSize += file.size;

            if (totalFileSize >= 2147483648) {
                selectedFiles = [...selectedFilesRollback];
                SendError("O tamanho total dos ficheiros não pode ser superior a 2GB!");
                return;
            }
            else if (mode == "DROP") {
                (async function () {
                    var borderColors = ["#f445bc", "#f7bb48", "#f96c71", "#0099f1", "#00d7f6", "#ff7e95", "#7d3cce"];
                    for (const color of borderColors) {
                        document.getElementById("filesInputBox").style.borderColor = color;
                        await Sleep(150);
                    }
                    document.getElementById("filesInputBox").removeAttribute("style");
                }());
            }

            ReloadFiles();
        }
    }

    async function ReloadFiles() {
        for (const fileDiv of document.querySelectorAll(".fileDiv"))
            fileDiv.parentElement.removeChild(fileDiv);
        
        if (selectedFiles.length != 0) {
            let fileSizeTotal = 0, index = 0;

            for (const file of selectedFiles) {
                let fileSizeToFormat = 0, rCount = 0;
                let fileDiv = document.createElement("div");
                let fileName = document.createElement("span");
                let fileSize = document.createElement("span");

                fileName.classList.add("name");
                fileName.innerHTML = file.name;
                fileName.title = file.name;

                fileSizeToFormat = file.size;
                fileSizeTotal += file.size;
                do {
                    fileSizeToFormat /= 1024;
                    rCount++;
                }
                while (fileSizeToFormat > 1024);
                fileSize.classList.add("size");
                fileSize.innerHTML = fileSizeToFormat.toFixed(2) + " " + byteUnits[rCount];
                fileSize.setAttribute("size", fileSizeToFormat.toFixed(2) + " " + byteUnits[rCount]);

                fileDiv.appendChild(fileName);
                fileDiv.appendChild(fileSize);
                fileDiv.classList.add("fileDiv");
                document.getElementById("filesDiv").insertBefore(fileDiv, document.getElementById("addFiles"))

                fileDiv.addEventListener("click", async (event) => {
                    if (document.getElementById("filesDiv").hasAttribute("lock"))
                        return;

                    for (const fileDiv of document.getElementsByClassName("fileDiv")) {
                        if (fileDiv == event.currentTarget && fileDiv.getElementsByClassName("size")[0].innerHTML == fileDiv.getElementsByClassName("size")[0].getAttribute("size"))
                            preload.ClickOptions("ADD", fileDiv.getElementsByClassName("size")[0], "size", [
                                {
                                    name: "remove",
                                    title: "Remover",
                                    function: DeleteFile
                                }
                            ]);
                        else if (fileDiv.getElementsByClassName("size")[0].innerHTML != fileDiv.getElementsByClassName("size")[0].getAttribute("size"))
                            preload.ClickOptions("REMOVE", fileDiv.getElementsByClassName("size")[0], "size");
                    }
                    await Sleep(200);
                    UpdateFileDivFade();
                });
            }

            document.getElementById("filesDragAndDrop").style.display = "none";
            document.getElementById("filesText").style.display = "none";
            document.getElementById("filesDiv").style.display = "block";
            document.getElementById("addFiles").style.display = "flex";
            document.getElementById("sendMessage").disabled = false;
            document.getElementById("filesSend").disabled = false;

            do {
                fileSizeTotal /= 1024;
                index++;
            }
            while (fileSizeTotal > 1024);
            document.getElementById("sendSize").innerHTML = fileSizeTotal.toFixed(2) + " " + byteUnits[index];
            document.getElementById("sendSize").style.visibility = "visible";

            UpdateFileDivFade();
            preload.ReloadIcons();
        }
        else {
            document.getElementById("filesDiv").style.opacity = "0";
            await Sleep(400);
            document.getElementById("filesText").style.display = "block";
            document.getElementById("filesDiv").style.display = "flex";
            document.getElementById("addFiles").removeAttribute("style");
            document.getElementById("sendSize").style.visibility = "hidden";
            document.getElementById("sendMessage").value = "";
            document.getElementById("filesDragAndDrop").removeAttribute("style");
            document.getElementById("filesDiv").style.opacity = "1";
        }
    }

    function UpdateFileDivFade() {
        for (const fileDiv of document.getElementsByClassName("fileDiv")) {
            if (fileDiv.getElementsByClassName("name")[0].offsetWidth + fileDiv.getElementsByClassName("size")[0].offsetWidth + 8 == 225)
                fileDiv.getElementsByClassName("name")[0].setAttribute("style", "background: -webkit-linear-gradient(0deg, var(--text) 90%, transparent); -webkit-background-clip: text; -webkit-text-fill-color: transparent;");
            else
                fileDiv.getElementsByClassName("name")[0].setAttribute("style", "background: -webkit-linear-gradient(0deg, var(--text) 0%, var(--text) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;");
        }
    }

    document.getElementById("filesSend").addEventListener("click", FileSend);
    document.getElementById("sendMessage").addEventListener("keyup", (event) => {
        if (event.key == "Enter")
            FileSend();
    });

    async function FileSend() {
        if (selectedFiles.length != 0) {
            document.querySelector("#sendPanel > .sideFooter > a").setAttribute("lock", "");
            document.getElementById("filesDragAndDrop").setAttribute("lock", "");
            document.getElementById("sendMessage").disabled = true;
            document.getElementById("filesSend").disabled = true;
            document.getElementById("filesDiv").setAttribute("lock", "");
            document.getElementById("addFiles").setAttribute("lock", "");
            document.querySelector("#sendPanel > .sideFooter > div").insertBefore(preload.LoadGif(), document.getElementById("filesSend"));
            try {
                let sendToWt = await preload.SendFile(selectedFiles, document.getElementById("sendMessage").value);
                let outputCode = sendToWt.shortened_url.replace("https://we.tl/t-", "");
                document.getElementById("outputCode").innerText = outputCode;

                document.getElementById("enterDone").click();
                preload.HistoryManager("ADD", outputCode, sendToWt.expires_at);
            }
            catch (error) {
                if (error.message == "File does not exist anymore")
                    SendError("Um ou mais dos ficheiros a serem enviados já não existem!");
                else {
                    console.error(error);
                    SendError("Houve um erro desconhecido ao enviar os ficheiros!");
                }
            }
            finally {
                selectedFiles = new Array();
                document.querySelector("#sendPanel > .sideFooter > a").removeAttribute("lock");
                document.getElementById("filesDragAndDrop").removeAttribute("lock");
                document.getElementById("filesDiv").removeAttribute("lock");
                document.getElementById("addFiles").removeAttribute("lock");
                document.querySelector("#sendPanel > .sideFooter > div").removeChild(document.querySelector("#sendPanel > .sideFooter > div > img"));
                document.getElementById("sendProgressBar").style.visibility = "hidden";
                document.getElementById("sendProgressBar").style.width = "0%";
                await Sleep(200);
                document.getElementById("sendProgressBar").style.visibility = "visible";
                ReloadFiles();
            }
        }
    }

    async function DeleteFile(event) {
        let fileIndex = 0, fileElement = event.currentTarget.parentElement.parentElement;

        for (const fileDiv of document.querySelectorAll(".fileDiv")) {
            if (fileDiv == fileElement)
                break;
            else
                fileIndex++;
        }

        selectedFiles.splice(fileIndex, 1);
        fileElement.style.opacity = "0";
        await Sleep(200);
        fileElement.style.maxHeight = "0";
        fileElement.style.padding = "0";
        await Sleep(200);
        ReloadFiles();
    }

    async function SendError(message) {
        document.getElementById("filesDiv").style.opacity = "0";
        await Sleep(400);
        document.getElementById("filesDiv").style.display = "flex";
        document.getElementById("textChoose").innerHTML = "Erro";
        document.getElementById("textDrop").innerHTML = message;
        document.getElementById("filesDiv").style.opacity = "1";
        await Sleep(400);
        for (let i = 0; i < 6; i++) {
            document.getElementById("filesInputBox").style.borderColor = "var(--shinyRed)";
            await Sleep(150);
            document.getElementById("filesInputBox").removeAttribute("style");
            await Sleep(150);
        }
        await Sleep(4000);
        document.getElementById("filesDiv").style.opacity = "0";
        await Sleep(400);
        document.getElementById("textChoose").innerHTML = "Escolher ficheiros";
        document.getElementById("textDrop").innerHTML = "Ou arraste para aqui!";
        document.getElementById("filesDiv").style.opacity = "1";
    }

    //#endregion

    //#region RECEIVE PANEL

    document.getElementById("fileCode").addEventListener("keyup", (event) => {
        if (document.getElementById("fileCode").value.length == 0)
            document.getElementById("filesReceive").disabled = true;
        else {
            document.getElementById("filesReceive").disabled = false;
            if (event.key == "Enter")
                FileReceive();
        }
    });

    document.getElementById("filesReceive").addEventListener("click", FileReceive);

    async function FileReceive() {
        document.querySelector("#receivePanel > .sideFooter > a").setAttribute("lock", "");
        document.getElementById("filesReceive").disabled = true;
        document.getElementById("fileCode").disabled = true;
        document.querySelector("#receivePanel > .sideFooter > div").insertBefore(preload.LoadGif(), document.getElementById("filesReceive"));

        var checkCode = await preload.CheckTransferCode(document.getElementById("fileCode").value);
        if (!checkCode.valid) {
            document.getElementById("receiveDetails").style.visibility = "hidden";
            document.querySelector("#receivePanel > .sideFooter > a").removeAttribute("lock");
            document.querySelector("#receivePanel > .sideFooter > div").removeChild(document.querySelector("#receivePanel > .sideFooter > div > img"));
            document.getElementById("filesReceive").disabled = false;
            document.getElementById("fileCode").disabled = false;
            for (let i = 0; i < 4; i++) {
                document.getElementById("fileCode").style.backgroundColor = "var(--lightRed)";
                document.getElementById("fileCode").style.color = "var(--shinyRed)";
                await Sleep(200);
                document.getElementById("fileCode").removeAttribute("style");
                await Sleep(200);
            }
            return;
        }
        if (checkCode.message == null)
            document.getElementById("receiveMessage").innerHTML = "<i>Sem mensagem</i>";
        else
            document.getElementById("receiveMessage").innerText = checkCode.message;
        document.getElementById("receiveDetails").style.visibility = "visible";
        preload.ReceiveFile(document.getElementById("fileCode").value);
    }

    async function OnResize() {
        document.getElementById("receiveMessage").removeAttribute("style");

        if (document.getElementById("receiveMessage").offsetWidth <= 163)
            document.getElementById("receiveMessage").style.right = "0";
        else {
            document.getElementById("receiveMessageStyle").innerHTML = "@keyframes textSlide { 0% { left: 163px; } 100% { left: -" + document.getElementById("receiveMessage").offsetWidth + "px; } }";
            document.getElementById("receiveMessage").style.animation = "textSlide " + document.getElementById("receiveMessage").innerHTML.length / 6 + "s linear 0s infinite";
        }
    }

    new ResizeObserver(OnResize).observe(document.getElementById("receiveMessage"));

    //#endregion

    //#region DONE PANEL

    document.getElementById("doneCode").addEventListener("click", async () => {
        if (!document.getElementById("outputCode").hasAttribute("lock")) {
            document.getElementById("outputCode").setAttribute("lock", "");
            
            let codeText = document.getElementById("outputCode").innerText;
            preload.CopyToClipboard(codeText);

            document.getElementById("outputCode").style.opacity = "0";
            await Sleep(400);
            document.getElementById("outputCode").innerText = "Copiado!";
            document.getElementById("outputCode").removeAttribute("style");
            await Sleep(3400);
            document.getElementById("outputCode").style.opacity = "0";
            await Sleep(400);
            document.getElementById("outputCode").innerText = codeText;
            document.getElementById("outputCode").removeAttribute("style");

            document.getElementById("outputCode").removeAttribute("lock");
        }
    });

    document.getElementById("doneLink").addEventListener("click", async () => {
        if (!document.getElementById("outputCode").hasAttribute("lock")) {
            document.getElementById("outputCode").setAttribute("lock", "");
            
            let codeText = document.getElementById("outputCode").innerText;
            preload.CopyToClipboard("https://tgpsi-share.pt/?dl=" + codeText);

            document.getElementById("outputCode").style.opacity = "0";
            await Sleep(400);
            document.getElementById("outputCode").innerText = "Copiado!";
            document.getElementById("outputCode").removeAttribute("style");
            await Sleep(3400);
            document.getElementById("outputCode").style.opacity = "0";
            await Sleep(400);
            document.getElementById("outputCode").innerText = codeText;
            document.getElementById("outputCode").removeAttribute("style");

            document.getElementById("outputCode").removeAttribute("lock");
        }
    });

    //#endregion

    //#region ACCOUNT PANEL

    document.getElementById("loginoutButton").addEventListener("click", async () => {
        if (document.getElementById("loginoutButton").innerText == "Iniciar Sessão")
            document.getElementById("enterLogin").click();
        else {
            if ((await preload.ShowAlert("Tem a certeza que pretende terminar sessão?", 2, "info")) == 1) {
                document.querySelector("#accountPanel > .sideFooter > a").click();
                await Sleep(400);
                preload.AccountManager("LOGOUT");
            }
        }
    });

    //#endregion

    //#region LOGIN PANEL

    document.getElementById("loginUsername").addEventListener("keyup", CheckAccountLogin);
    document.getElementById("loginPassword").addEventListener("keyup", CheckAccountLogin);

    function CheckAccountLogin(event) {
        if (document.getElementById("loginUsername").value.length == 0 || document.getElementById("loginPassword").value.length == 0)
            document.getElementById("accountLogin").disabled = true;
        else {
            document.getElementById("accountLogin").disabled = false;
            if (event.key == "Enter")
                AccountLogin();
        }
    }

    document.getElementById("accountLogin").addEventListener("click", AccountLogin);

    async function AccountLogin() {
        document.getElementById("accountLogin").disabled = true;
        document.getElementById("loginUsername").disabled = true;
        document.getElementById("loginPassword").disabled = true;
        document.getElementById("loginToSignup").setAttribute("lock", "");
        document.querySelector("#loginPanel > .sideFooter > a").setAttribute("lock", "");
        document.querySelector("#loginPanel > .sideFooter > div").insertBefore(preload.LoadGif(), document.getElementById("accountLogin"));

        try {
            await preload.AccountManager("LOGIN", {
                name: document.getElementById("loginUsername").value.trim(),
                password: document.getElementById("loginPassword").value
            });

            document.getElementById("loginUsername").value = "";
            document.getElementById("loginPassword").value = "";
            document.getElementById("enterHello").click();
        }
        catch (error) {
            if (error.message == "Invalid data")
                preload.ShowAlert("O nome de utilizador ou a palavra-passe estão incorretos. Verifique os seus dados e tente novamente.", 1, "error");
            else if (error.message == "Locked account")
                preload.ShowAlert("Esta conta foi bloqueada devido a muitas tentativas de acesso, tente novamente daqui a 5 minutos.", 1, "error");
        }

        document.getElementById("accountLogin").disabled = false;
        document.getElementById("loginUsername").disabled = false;
        document.getElementById("loginPassword").disabled = false;
        document.getElementById("loginToSignup").removeAttribute("lock");
        document.querySelector("#loginPanel > .sideFooter > a").removeAttribute("lock");
        document.querySelector("#loginPanel > .sideFooter > div").removeChild(document.querySelector("#loginPanel > .sideFooter > div > img"));
    }

    //#endregion

    //#region SIGNUP PANEL

    document.getElementById("signupPic").addEventListener("click", async () => {
        if (!document.getElementById("signupPic").hasAttribute("lock")) {
            let profilePicDialog = await preload.ShowOpenDialog([{ name: "Imagens", extensions: ["png", "jpg", "jpeg"] }], ["openFile", "createDirectory"]);

            document.getElementById("signupPic").removeChild(document.getElementById("signupPic").lastElementChild);
            if (profilePicDialog.canceled) {
                document.getElementById("signupPic").innerHTML += "<icon name=\"account\"></icon>";
                preload.ReloadIcons();
            }
            else
                document.getElementById("signupPic").innerHTML += "<img src=\"file:///" + profilePicDialog.filePaths[0] + "\"></img>";
        }
    });

    document.getElementById("signupUsername").addEventListener("keyup", CheckAccountSignup);
    document.getElementById("signupEmail").addEventListener("keyup", CheckAccountSignup);
    document.getElementById("signupPassword").addEventListener("keyup", CheckAccountSignup);
    document.getElementById("signupPasswordRepeat").addEventListener("keyup", CheckAccountSignup);

    function CheckAccountSignup(event) {
        if (document.getElementById("signupUsername").value.length == 0 || document.getElementById("signupEmail").value.length == 0 || document.getElementById("signupPassword").value.length == 0 || document.getElementById("signupPasswordRepeat").value.length == 0)
            document.getElementById("accountSignup").disabled = true;
        else {
            document.getElementById("accountSignup").disabled = false;
            if (event.key == "Enter")
                AccountSignup();
        }
    }

    document.getElementById("accountSignup").addEventListener("click", AccountSignup);

    async function AccountSignup() {
        let usernameRegex = /^[A-Za-z0-9 àèìòùÀÈÌÒÙáéíóúýÁÉÍÓÚÝâêîôûÂÊÎÔÛãñõÃÑÕçÇ]{4,10}$/g, emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g, passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/g;
        
        document.getElementById("accountSignup").disabled = true;
        document.getElementById("signupUsername").disabled = true;
        document.getElementById("signupEmail").disabled = true;
        document.getElementById("signupPassword").disabled = true;
        document.getElementById("signupPasswordRepeat").disabled = true;
        document.getElementById("signupPic").setAttribute("lock", "");
        document.querySelector("#signupPanel > .sideFooter > a").setAttribute("lock", "");

        if (document.getElementById("signupUsername").value.match(usernameRegex) == null)
            preload.ShowAlert("O nome de utilizador tem de ter entre 4 a 10 caractéres e deve apenas conter letras, números e espaços.", 1, "error");
        else if (document.getElementById("signupEmail").value.match(emailRegex) == null)
            preload.ShowAlert("O endereço de email inserido não é válido. Verifique a sua sintaxe e tente novamente!", 1, "error");
        else if (document.getElementById("signupPassword").value.match(passwordRegex) == null)
            preload.ShowAlert("A palavra-passe não é válida. A palavra-passe deve ter pelo menos 8 caractéres, uma letra e um número.", 1, "error");
        else if (document.getElementById("signupPassword").value != document.getElementById("signupPasswordRepeat").value)
            preload.ShowAlert("As palavras-passe inseridas não são iguais!", 1, "error");
        else {
            document.querySelector("#signupPanel > .sideFooter > div").insertBefore(preload.LoadGif(), document.getElementById("accountSignup"));

            try {
                await preload.AccountManager("REGIST", {
                    name: document.getElementById("signupUsername").value.trim(),
                    email: document.getElementById("signupEmail").value.trim(),
                    password: document.getElementById("signupPassword").value,
                    photo: document.getElementById("signupPic").lastElementChild.nodeName == "ICON" ? "" : document.getElementById("signupPic").lastElementChild.src,
                });

                document.getElementById("signupUsername").value = "";
                document.getElementById("signupEmail").value = "";
                document.getElementById("enterWelcome").click();
            }
            catch (error) {
                if (error.message == "Username taken")
                    preload.ShowAlert("Já existe um utilizador registado com este nome de utilizador. Por favor escolha outro ou faça login.", 1, "error");
                else if (error.message == "Email taken")
                    preload.ShowAlert("Já existe um utilizador registado com este endereço de email. Por favor utilize outro email ou faça login.", 1, "error");
            }

            document.querySelector("#signupPanel > .sideFooter > div").removeChild(document.querySelector("#signupPanel > .sideFooter > div > img"));
        }

        document.getElementById("signupPassword").value = "";
        document.getElementById("signupPasswordRepeat").value = "";
        document.getElementById("accountSignup").disabled = false;
        document.getElementById("signupUsername").disabled = false;
        document.getElementById("signupEmail").disabled = false;
        document.getElementById("signupPassword").disabled = false;
        document.getElementById("signupPasswordRepeat").disabled = false;
        document.getElementById("signupPic").removeAttribute("lock");
        document.querySelector("#signupPanel > .sideFooter > a").removeAttribute("lock");
    }

    //#endregion

    //#region WELCOME PANEL

    document.getElementById("welcomeNext").addEventListener("click", async () => {
        let currentSlide = document.getElementById("welcomeSlide").getAttribute("current");
        let nextSlide = "welcomeSlide" + (Number(currentSlide.match(/\d/g)[0]) + 1);

        if (nextSlide != "welcomeSlide5") {
            document.getElementById(currentSlide).style.opacity = "0";
            await Sleep(400);
            document.getElementById(currentSlide).style.display = "none";
            document.getElementById("welcomeSlide").setAttribute("current", nextSlide);
            document.getElementById(nextSlide).style.display = "flex";
            await Sleep(400);
            document.getElementById(nextSlide).style.opacity = "1";
        }
        else {
            document.getElementById("enterHello").click();
            await Sleep(400);
            document.getElementById(currentSlide).style.opacity = "0";
            await Sleep(400);
            document.getElementById(currentSlide).style.display = "none";
            document.getElementById("welcomeSlide").setAttribute("current", "welcomeSlide1");
            document.getElementById("welcomeSlide1").style.display = "flex";
            await Sleep(400);
            document.getElementById("welcomeSlide1").style.opacity = "1";
        }
    });

    //#endregion

    //#region HELLO PANEL

    async function HelloAnimation(play) {
        if (play) {
            document.querySelector("#helloPanel > div > :first-child").style.transform = "scale(1)";
            document.querySelector("#helloPanel > div > :first-child").style.opacity = "1";
            await Sleep(1000);
            document.querySelector("#helloPanel > h1").style.opacity = "1";
            await Sleep(400);
            document.querySelector("#helloPanel > h4").style.opacity = "1";
            await Sleep(1000);
            document.querySelector("#helloPanel > button").style.opacity = "1";
        }
        else {
            document.querySelector("#helloPanel > div > :first-child").removeAttribute("style");
            document.querySelector("#helloPanel > h1").removeAttribute("style");
            document.querySelector("#helloPanel > h4").removeAttribute("style");
            document.querySelector("#helloPanel > button").removeAttribute("style");
        }
    }

    //#endregion

    //#region HISTORY PANEL

    async function HistoryDisplay() {
        let history = await preload.HistoryManager("GET");

        document.getElementById("historyEntries").removeAttribute("style");
        document.getElementById("historyEntries").innerHTML = "";

        for (const transfer of [...history].reverse()) {
            let historyEntry = document.createElement("div"), historyCode = document.createElement("p"), historyExpire = document.createElement("span");
            let todayDate = new Date(), expireDate = new Date(transfer.expire);
            let timeLeft = Math.round((expireDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24));

            if (todayDate > expireDate) {
                preload.HistoryManager("REMOVE", transfer.code, transfer.expire);
                continue;
            }

            historyCode.innerText = transfer.code;
            historyExpire.innerText = timeLeft + (timeLeft == 1 ? " dia" : " dias");
            historyExpire.setAttribute("expire", timeLeft + (timeLeft == 1 ? " dia" : " dias"));

            historyEntry.appendChild(historyCode);
            historyEntry.appendChild(historyExpire);
            historyEntry.classList.add("historyEntry");
            document.getElementById("historyEntries").appendChild(historyEntry);

            historyEntry.addEventListener("click", (event) => {
                if (event.currentTarget == event.target && document.getElementById("historyEntries").hasAttribute("lock"))
                    return;
                for (const entry of document.querySelectorAll(".historyEntry")) {
                    if (entry == event.currentTarget && entry.getElementsByTagName("span")[0].innerHTML == entry.getElementsByTagName("span")[0].getAttribute("expire"))
                        preload.ClickOptions("ADD", entry.getElementsByTagName("span")[0], "expire", [
                            {
                                name: "copy",
                                title: "Copiar",
                                function: CopyEntry
                            },
                            {
                                name: "download",
                                title: "Transferir",
                                function: DownloadEntry
                            },
                            {
                                name: "remove",
                                title: "Remover",
                                function: DeleteEntry
                            }
                        ]);
                    else if (entry.getElementsByTagName("span")[0].innerHTML != entry.getElementsByTagName("span")[0].getAttribute("expire"))
                        preload.ClickOptions("REMOVE", entry.getElementsByTagName("span")[0], "expire");
                }
            });
        }

        if (history.length == 0) {
            document.getElementById("historyEntries").style.display = "flex";
            document.getElementById("historyEntries").style.alignItems = "center";
            document.getElementById("historyEntries").style.justifyContent = "center";
            document.getElementById("historyEntries").innerHTML = "<span id=\"historyEmpty\" style=\"opacity: 0;\">Parece que não tens nada no Histórico...</span>";
            await Sleep(1000);
            document.getElementById("historyEmpty").removeAttribute("style");
        }
    }

    async function CopyEntry(event) {
        let entryIndex = 0, entryElement = event.currentTarget.parentElement.parentElement;

        for (const historyEntry of document.querySelectorAll(".historyEntry")) {
            if (historyEntry == entryElement)
                break;
            else
                entryIndex++;
        }
        entryElement = document.querySelectorAll(".historyEntry")[entryIndex];

        if (!entryElement.hasAttribute("lock")) {
            entryElement.setAttribute("lock", "");

            let codeText = entryElement.firstElementChild.innerHTML;
            preload.CopyToClipboard(codeText);

            entryElement.firstElementChild.style.opacity = "0";
            await Sleep(200);
            entryElement.firstElementChild.innerText = "Copiado!";
            entryElement.firstElementChild.removeAttribute("style");
            await Sleep(3200);
            entryElement.firstElementChild.style.opacity = "0";
            await Sleep(200);
            entryElement.firstElementChild.innerText = codeText;
            entryElement.firstElementChild.removeAttribute("style");
            entryElement.removeAttribute("lock");
        }
    }

    async function DownloadEntry(event) {
        document.querySelectorAll("#homePanel > button:last-child")[0].click();
        document.getElementById("fileCode").value = event.currentTarget.parentElement.parentElement.firstElementChild.innerHTML;
        await Sleep(400);
        document.getElementById("filesReceive").disabled = false;
        document.getElementById("filesReceive").click();
    }

    async function DeleteEntry(event) {
        let history = await preload.HistoryManager("GET");
        let entryIndex = 0, entryElement = event.currentTarget.parentElement.parentElement;

        for (const historyEntry of document.querySelectorAll(".historyEntry")) {
            if (historyEntry == entryElement)
                break;
            else
                entryIndex++;
        }
        entryElement = document.querySelectorAll(".historyEntry")[entryIndex];
        preload.HistoryManager("REMOVE", history[entryIndex].code, history[entryIndex].expire);

        entryElement.style.opacity = "0";
        await Sleep(200);
        entryElement.style.maxHeight = "0";
        entryElement.style.padding = "0";
        entryElement.style.marginBottom = "0";
        await Sleep(200);
        entryElement.parentElement.removeChild(entryElement);
        if (document.querySelectorAll(".historyEntry").length == 0)
            HistoryDisplay();
    }

    //#endregion

    //#region SETTINGS PANEL

    document.getElementById("settingsPasswordChange").addEventListener("click", async () => {
        await preload.AccountManager("RESET", document.getElementById("settingsPassword").value);
        await preload.ShowAlert("A palavra-passe foi alterada com sucesso!", 1, "info");
    });

    document.getElementById("settingsDeleteAccount").addEventListener("click", async () => {
        if (await preload.ShowAlert("Tens a certeza que queres apagar a tua conta? Irás perder todos os teus dados!", 2, "question") == 1) {
            if (await preload.ShowAlert("Está é a última chance! Após confirmares a tua conta será apagada de uma forma IRREVERSÍVEL!", 2, "warning") == 1) {
                await preload.AccountManager("DELETE");
                await preload.ShowAlert("A sua conta foi apagada e a sua sessão será agora terminada. Esperemos que volte em breve!", 1, "info");
            }
        }
    });

    document.getElementById("settingsScheme").addEventListener("change", SaveNewSettings);

    document.getElementById("settingsHistoryClear").addEventListener("click", async () => {
        if (!document.getElementById("settingsHistoryClear").hasAttribute("lock")) {
            document.getElementById("settingsHistoryClear").setAttribute("lock", "");
            
            let buttonText = document.getElementById("settingsHistoryClear").innerText;
            preload.HistoryManager("CLEAR");

            document.getElementById("settingsHistoryClear").style.color = "rgba(0, 0, 0, 0)";
            await Sleep(400);
            document.getElementById("settingsHistoryClear").innerText = "Limpo!";
            document.getElementById("settingsHistoryClear").removeAttribute("style");
            await Sleep(3400);
            document.getElementById("settingsHistoryClear").style.color = "rgba(0, 0, 0, 0)";
            await Sleep(400);
            document.getElementById("settingsHistoryClear").innerText = buttonText;
            document.getElementById("settingsHistoryClear").removeAttribute("style");

            document.getElementById("settingsHistoryClear").removeAttribute("lock");
        }
    });

    document.getElementById("settingsBeta").addEventListener("change", async () => {
        if (document.getElementById("settingsBeta").checked) {
            document.getElementById("settingsBeta").checked = false;

            var option = await preload.ShowAlert("Tens a certeza que queres ligar as atualizações beta? Estas versões podem conter bugs e funcionalidades inacabadas que poderão resultar em erros de funcionamento!", 2, "warning");
            if (option == 1)
                document.getElementById("settingsBeta").checked = true;
        }
        SaveNewSettings();
    });

    async function SaveNewSettings() {
        let settings = {};
        settings.scheme = document.getElementById("settingsScheme").value;
        settings.beta = document.getElementById("settingsBeta").checked;

        fs.writeFileSync((await preload.GetPaths("userData")) + "\\config.json", JSON.stringify(settings, null, 4), "utf8");
        preload.RefreshAppearance();
    }

    //#endregion

    //#region ABOUT PANEL

    document.getElementsByTagName("li")[0].innerHTML = document.getElementsByTagName("li")[0].innerHTML.replace("null", preload.GetPackageData().version);
    document.getElementsByTagName("li")[1].innerHTML = document.getElementsByTagName("li")[1].innerHTML.replace("null", preload.GetPackageData().author);
    document.getElementsByTagName("li")[2].innerHTML = document.getElementsByTagName("li")[2].innerHTML.replace("null", preload.GetProcessVersions().electron);
    document.getElementsByTagName("li")[3].innerHTML = document.getElementsByTagName("li")[3].innerHTML.replace("null", preload.GetProcessVersions().node);
    document.getElementById("copyright").innerHTML = document.getElementById("copyright").innerHTML.replace("null", preload.GetPackageData().author);
    document.getElementById("copyright").addEventListener("click", () => shell.openExternal(preload.GetPackageData().copyright));
    document.getElementById("checkForUpdates").addEventListener("click", () => preload.OpenUpdater(false));

    document.getElementById("aboutLogo").getElementsByTagName("img")[0].addEventListener("dblclick", (event) => {
        if (event.altKey) {
            if (appContent.parentElement.getAttribute("style") == null)
                appContent.parentElement.style.animation = "hueRotate 5s infinite linear";
            else
                appContent.parentElement.removeAttribute("style");
        }
    });

    //#endregion
});