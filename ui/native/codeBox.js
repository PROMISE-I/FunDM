var heapNode = document.getElementById("heap-block");
var enode = document.createElement("div");
enode.id = "editor"
document.getElementById("code-block").appendChild(enode);
var editor = ace.edit("editor");
editor.setFontSize("13px");
editor.session.setMode("ace/mode/elm");

app.ports.sendCode.subscribe(function(message) {
    editor.getSession().setValue(message, 0);
});

var runbtn = document.getElementById("run-program");
runbtn.onclick = function() {
    app.ports.receiveCode.send(editor.getSession().getDocument().getValue());
    enode.style.setProperty('border', 'none')
};

app.ports.sendFileName.subscribe(function(fileN) {
    if (fileN === "New File") {
        editor.getSession().setValue("");
    } else {
        editor.getSession().setValue(window.FunDMExamples[fileN]);
    }
});
