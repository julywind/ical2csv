var electronInstaller = require('electron-winstaller');
resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: '../build-out/ics2csv-win32-x64',
    outputDirectory: '../build-out/winstaller',
    loadingGif:'./img/loading.gif',
    authors: 'marty hou',
    // exe: 'ics2csv.exe',
    setupExe:'ics2csv.exe',
    description:"测试",
    version:'1.0.0',
    noMsi:true,
    noDelta:true
});

resultPromise.then(() => console.log("It worked!"), (e) => {
    console.log(e.message)
});