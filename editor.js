var newButton, openButton, saveButton;
var editor;
var menu;
var fileEntry;
var hasWriteAccess;
var icalendar = require('icalendar');

const {remote, clipboard} = require('electron');
const {Menu, MenuItem, dialog } = remote;
const fs = require("fs");
const json2csv = require('json2csv');


function handleDocumentChange(title) {
  var mode = "javascript";
  var modeName = "JavaScript";
  if (title) {
    title = title.match(/[^/]+$/)[0];
    document.getElementById("title").innerHTML = title;
    document.title = title;
    if (title.match(/.json$/)) {
      mode = {name: "javascript", json: true};
      modeName = "JavaScript (JSON)";
    } else if (title.match(/.html$/)) {
      mode = "htmlmixed";
      modeName = "HTML";
    } else if (title.match(/.css$/)) {
      mode = "css";
      modeName = "CSS";
    }
  } else {
    document.getElementById("title").innerHTML = "[no document loaded]";
  }
  editor.setOption("mode", mode);
  document.getElementById("mode").innerHTML = modeName;
}

function newFile() {
  fileEntry = null;
  hasWriteAccess = false;
  handleDocumentChange(null);
}

function setFile(theFileEntry, isWritable) {
  fileEntry = theFileEntry;
  hasWriteAccess = isWritable;
}

//
// Read an .ics file given on the command line, generate a reply, and email it
// using nodemailer.
//
var eventMaps = [],events = [];
var fieldMap={};
function readFileIntoEditor(theFileEntry) {
    console.log(theFileEntry);
    var ical = icalendar.parse_calendar(
        fs.readFileSync(theFileEntry.toString(), {encoding: 'utf-8'}));
    events = ical.events();
    console.log(events);

    handleDocumentChange(theFileEntry);
    fieldMap={};
    eventMaps = events.map(function(item){
        var tmp = {};
        Object.keys(item.properties).forEach(function(key){
            if(item.properties[key] instanceof Array){
                const prop = item.properties[key][0];
                var val = prop.value;
                if(key==="SEQUENCE" || key==="RECURRENCE-ID"){
                    return;
                }
                switch(prop.type){
                    case "DATE-TIME":
                        if(prop.parameters && prop.parameters.VALUE==='DATE'){
                            val = moment(prop.value).format('YYYY-MM-DD');
                        }else{
                            val = moment(prop.value).format('YYYY-MM-DD HH:mm:ss');
                        }
                        break;
                }
                fieldMap[key] = true;
                if(typeof prop.type==="object"){
                    val = JSON.stringify(val);
                }
                if(key==="DESCRIPTION" && val==="[]"){
                    val="";
                }
                tmp[key] = val;
            }
        });
        return tmp;
    });
    showEvents();
}
function showJsonContent(){
    showJson = true;
    const results = events.map(function(item){
        return item.properties;
    });
    editor.setValue(formatJson(results));
}
function showEvents(){
    showJson = false;

    const headers=Object.keys(fieldMap).filter(function(key){
        return fieldMap[key];
    });

    try {
        var result = json2csv({ data: eventMaps, fields: headers });
        console.log(result);
        editor.setValue(result);
    } catch (err) {
        // Errors are thrown for bad options, or if the data is empty and no fields are provided.
        // Be sure to provide fields if it is possible that your data array will be empty.
        console.error(err);
    }

}

function writeEditorToFile(theFileEntry) {
  var str = editor.getValue();
  fs.writeFile(theFileEntry, editor.getValue(), function (err) {
    if (err) {
      console.log("Write failed: " + err);
      return;
    }

    handleDocumentChange(theFileEntry);
    console.log("Write completed.");
  });
}

var onChosenFileToOpen = function(theFileEntry) {
  console.log(theFileEntry);
  setFile(theFileEntry, false);
  readFileIntoEditor(theFileEntry);
};

var onChosenFileToSave = function(theFileEntry) {
  setFile(theFileEntry, true);
  writeEditorToFile(theFileEntry);
};

function handleOpenButton() {
  dialog.showOpenDialog({properties: ['openFile'],filters:[ {name: 'icalendar', extensions: ['ics','ical','vcal']}]}, function(filename) {
      onChosenFileToOpen(filename.toString()); });
}

function handleSaveButton() {
  /*if (fileEntry && hasWriteAccess) {
    writeEditorToFile(fileEntry);
  } else {
    dialog.showSaveDialog(function(filename) {
       onChosenFileToSave(filename.toString(), true);
    });
  }*/
    dialog.showSaveDialog({filters:[ {name: 'icalendar', extensions: ['ical','vcal']}]},function(filename) {
        onChosenFileToSave(filename.toString(), true);
    });
}

function initContextMenu() {
  menu = new Menu();
  menu.append(new MenuItem({
    label: 'Copy',
    click: function() {
      clipboard.writeText(editor.getSelection(), 'copy');
    }
  }));
  menu.append(new MenuItem({
    label: 'Cut',
    click: function() {
      clipboard.writeText(editor.getSelection(), 'copy');
      editor.replaceSelection('');
    }
  }));
  menu.append(new MenuItem({
    label: 'Paste',
    click: function() {
      editor.replaceSelection(clipboard.readText('copy'));
    }
  }));

  window.addEventListener('contextmenu', function(ev) { 
    ev.preventDefault();
    menu.popup(remote.getCurrentWindow(), ev.x, ev.y);
  }, false);
}

var showJson = true;
function switchCode(){
    if(showJson){
        showEvents();
    }else{
        showJsonContent();
    }
}
onload = function() {
  initContextMenu();

  // newButton = document.getElementById("new");

  openButton = document.getElementById("open");
  saveButton = document.getElementById("save");

  // newButton.addEventListener("click", switchCode);
  openButton.addEventListener("click", handleOpenButton);
  saveButton.addEventListener("click", handleSaveButton);

  editor = CodeMirror(
      document.getElementById("editor"),
      {
        mode: {name: "javascript", json: true },
        lineNumbers: true,
        theme: "lesser-dark",
        extraKeys: {
          "Cmd-S": function(instance) { handleSaveButton() },
          "Ctrl-S": function(instance) { handleSaveButton() }
        }
      });

  newFile();
  onresize();
};

onresize = function() {
  var container = document.getElementById('editor');
  var containerWidth = container.offsetWidth;
  var containerHeight = container.offsetHeight;

  var scrollerElement = editor.getScrollerElement();
  scrollerElement.style.width = containerWidth + 'px';
  scrollerElement.style.height = containerHeight + 'px';

  editor.refresh();
}

//格式化代码函数,已经用原生方式写好了不需要改动,直接引用就好
function formatJson(json, options) {
    var reg = null,
        formatted = '',
        pad = 0,
        PADDING = '    ';
    options = options || {};
    options.newlineAfterColonIfBeforeBraceOrBracket = (options.newlineAfterColonIfBeforeBraceOrBracket === true);
    options.spaceAfterColon = (options.spaceAfterColon !== false);
    if (typeof json !== 'string') {
        json = JSON.stringify(json);
    } else {
        json = JSON.parse(json);
        json = JSON.stringify(json);
    }
    reg = /([\{\}])/g;
    json = json.replace(reg, '\r\n$1\r\n');
    reg = /([\[\]])/g;
    json = json.replace(reg, '\r\n$1\r\n');
    reg = /(\,)/g;
    json = json.replace(reg, '$1\r\n');
    reg = /(\r\n\r\n)/g;
    json = json.replace(reg, '\r\n');
    reg = /\r\n\,/g;
    json = json.replace(reg, ',');
    if (!options.newlineAfterColonIfBeforeBraceOrBracket) {
        reg = /\:\r\n\{/g;
        json = json.replace(reg, ':{');
        reg = /\:\r\n\[/g;
        json = json.replace(reg, ':[');
    }
    if (options.spaceAfterColon) {
        reg = /\:/g;
        json = json.replace(reg, ':');
    }
    (json.split('\r\n')).forEach(function (node, index) {
            var i = 0,
                indent = 0,
                padding = '';

            if (node.match(/\{$/) || node.match(/\[$/)) {
                indent = 1;
            } else if (node.match(/\}/) || node.match(/\]/)) {
                if (pad !== 0) {
                    pad -= 1;
                }
            } else {
                indent = 0;
            }

            for (i = 0; i < pad; i++) {
                padding += PADDING;
            }

            formatted += padding + node + '\r\n';
            pad += indent;
        }
    );
    return formatted;
};