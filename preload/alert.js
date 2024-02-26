const { ipcRenderer } = require("electron");
const preload = require("./preload");
var alertChoice = NaN;

window.addEventListener("load", () => {
    document.getElementById("okOption").addEventListener("click", () => {
        alertChoice = 0;
        SaveAndClose();
    });

    document.getElementById("yesOption").addEventListener("click", () => {
        alertChoice = 1;
        SaveAndClose();
    });

    document.getElementById("noOption").addEventListener("click", () => {
        alertChoice = 2;
        SaveAndClose();
    });

    function SaveAndClose() {
        ipcRenderer.send("SaveAlertOption", alertChoice);
        preload.CloseWindow();
    }

    window.addEventListener("keydown", (event) => {
        if (event.key == "F4" && event.altKey)
            event.preventDefault();
    });
});