const { ipcRenderer } = require("electron");
const preload = require("./preload");
const { Sleep } = require("./preload");

window.addEventListener("load", () => {
    var updateURL = null;

    //#region FRAME BAR

    document.getElementById("closeCircle").addEventListener("click", CloseWindow);

    window.addEventListener("keydown", (event) => {
        if (event.key == "F4" && event.altKey) {
            event.preventDefault();
            CloseWindow();
        }
    });

    function CloseWindow() {
        if (document.getElementById("updateProgressBar").classList.contains("indeterminate") || document.getElementById("updateProgressBar").offsetWidth != 0)
            preload.ShowAlert("O TGPSI Share está agora a transferir uma atualização. Por favor espere que esta acabe e tente novamente.", 1, "info");
        else
            preload.CloseWindow();
    }

    document.getElementById("minimizeCircle").addEventListener("click", () => {
        preload.MinimizeWindow();
    });

    //#endregion

    (async function () {
        let pageIndex = 1, ghInfo;
        let showdown = require("showdown");
        let converter = new showdown.Converter();
    
        do {
            ghInfo = await fetch(`https://api.github.com/repos/D3W10/TGPSI-Share/releases?per_page=1&page=${pageIndex}`, {
                headers: {
                    accept: "application/vnd.github.v3+json"
                }
            });
            ghInfo = await ghInfo.json();
            pageIndex++;
            if (ghInfo.length == 0)
                return;
            if ((await preload.GetConfig()).beta)
                break;
        }
        while (ghInfo[0].prerelease == true)
    
        if (ghInfo[0].tag_name != preload.GetPackageData().version) {
            ipcRenderer.send("UpdateStartup", true);
            document.getElementById("packageName").innerHTML = ghInfo[0].name;
            document.getElementById("updateDescription").innerHTML = "Uma nova atualização está dísponível para transferir. Eis o que há de novo:";
            document.getElementById("icon").src = "./update.png";
            document.getElementsByClassName("changes")[0].removeAttribute("style");
            document.getElementsByClassName("changes")[0].innerHTML = converter.makeHtml(ghInfo[0].body);
            updateURL = ghInfo[0].assets[0].browser_download_url;
        }
        else {
            ipcRenderer.send("UpdateStartup", false);
            document.getElementById("packageName").innerHTML = "Parabéns";
            document.getElementById("updateDescription").innerHTML = "A versão mais recente do TGPSI Share já está instalada!";
            document.getElementById("icon").src = "./updated.png";
            document.getElementById("appUpdate").innerHTML = "Ótimo";
        }
        document.getElementById("appUpdate").disabled = false;
        preload.ResizeToFit("UPDATE");
    }());

    document.getElementById("appUpdate").addEventListener("click", async () => {
        if (document.getElementById("appUpdate").innerHTML == "Ótimo")
            preload.CloseWindow();
        else {
            document.getElementById("appUpdate").disabled = true;
            document.getElementById("updateInfo").style.opacity = "0";
            await Sleep(400);
            document.getElementById("updateDescription").innerHTML = "Preparando...";
            document.getElementById("updateInfo").removeAttribute("style");
            await Sleep(400);
            document.getElementById("updateProgressBar").classList.add("indeterminate");
            preload.DownloadUpdate(updateURL);
        }
    });
});