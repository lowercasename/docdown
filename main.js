const {app, BrowserWindow, ipcMain, Tray, dialog} = require('electron')
require ('hazardous');
const semver = require('semver')
const menubar = require('menubar')
const path = require('path')
const fs = require('fs')
const mime = require('mime-types')
const eWindow = require('electron-window')
const settings = require('electron-settings');
const AutoLaunch = require('auto-launch');
const commandExists = require('command-exists');
const notify = require('electron-main-notification')
const fetch = require('node-fetch');

var autoLauncher = new AutoLaunch({
    name: 'DocDown',
    isHidden: true
});

async function checkForNewRelease () {
  let currentRelease = app.getVersion();
  let response = await fetch('https://api.github.com/repos/lowercasename/docdown/releases/latest')
  let data = await response.json();
  let latestRelease = semver.coerce(data.tag_name)
  if (semver.gt(latestRelease.version, currentRelease)) {
    return {
      updateAvailable: true,
      latestRelease: latestRelease.version,
      releaseDate: latestRelease.publishedAt,
      currentRelease: currentRelease
    }
  }
  else {
    return {
      updateAvailable: false
    }
  }
}


ipcMain.on('checkForNewRelease', (event) => {
  console.log("Checking for new release!")
  checkForNewRelease()
    .then(
      data => {
        if (data){
          event.sender.send('update_notification', data)
        }
        else {
          event.sender.send('update_notification', {updateAvailable: false})
        }
      }
    )
    .catch(
      reason => {
        event.sender.send('update_notification', {updateAvailable: false, fetchError: true})
        console.log(reason)
      }
    )
})



async function convert(filepath) {
  commandExists('pandoc', function(err, pandocExists) {
    if(pandocExists) {
      // Pandoc exists!
      commandExists('pandoc-citeproc', function(err, citeprocExists) {
        if(citeprocExists) {
          var exec = require('child_process').exec;
          var child;
          child = exec("pandoc -v",
          function (error, stdout, stderr) {
            if (error !== null) {
              // This shouldn't really ever come up because commandExists should catch it first, but if it doesn't...
              dialog.showMessageBox({type: "warning", message: "I can't find Pandoc! Has it been installed?"})
              console.log('Error retrieving pandoc version: ' + error);
              return false;
            }
            else {
              const pandocVersion = semver.coerce(stdout.split('\n')[0]);
              if (semver.lt(pandocVersion, '2.0.0')) {
                dialog.showMessageBox({type: "warning", message: "Please update Pandoc to version 2.0 or higher."})
                console.log('Pandoc too old: ' + pandocVersion);
                return false;
              }
              console.log("Pandoc version is " + pandocVersion);
              const settingsObject = {
                outputDirectory: settings.get('user.outputDirectory', settings.get('defaults.outputDirectory')),
                bibliographyFile: settings.get('user.bibliographyFile', settings.get('defaults.bibliographyFile')),
                cslFile: settings.get('user.cslFile', settings.get('defaults.cslFile')),
                docxFile: settings.get('user.docxFile', settings.get('defaults.docxFile'))
              }
              console.log(settingsObject);
              if (settingsObject.outputDirectory === "" || settingsObject.bibliographyFile === "" || settingsObject.cslFile === "" || settingsObject.docxFile === "") {
                dialog.showMessageBox({type: "warning", message: "Please set file paths for all the files DocDown requires!"})
                return false;
              }
              const fileType = mime.lookup(filepath)
              if (fileType === "text/markdown" || fileType === "text/plain"){
                // It's a Markdown file!
                var pandoc = require('node-pandoc')
                const fileName = path.basename(filepath, path.extname(filepath))
                // const parentDirectory = path.dirname(filepath)
                const rawMarkdown = fs.readFileSync(filepath) + '\n\n# Bibliography'
                const outputFile = settingsObject.outputDirectory + '/' + fileName + '.docx'

                // This is where the magic happens, for a given definiton of 'magic'
                const hellScapeMcHorrorFace = ['-s','--filter','pandoc-citeproc','--bibliography',settingsObject.bibliographyFile,'--csl',settingsObject.cslFile,'--reference-doc',settingsObject.docxFile,'-f','markdown+smart+escaped_line_breaks','-t','docx','-o',outputFile];

                callback = function (err, result) {
                  if (err !== null) {
                    console.error('Oh Noes: ',err);
                    return false;
                  }
                  else {
                    console.log("Completed!")
                    notify('Markdown converted sucessfully', { body: 'Word document saved in ' + settingsObject.outputDirectory })
                    return console.log(result), result;
                  }
                }
                pandoc(rawMarkdown, hellScapeMcHorrorFace, callback);
              }
              else {
                notify('Markdown not converted', { body: "This isn't a Markdown file." })
                return false;
              }
            }
          });
        }
        else {
          dialog.showMessageBox({type: "warning", message: "I can't find pandoc-citeproc (Pandoc's citation conversion tool). Please install Pandoc using one of the full installers, or install pandoc-citeproc seperately."})
          return false;
        }
      })
    }
    else {
      dialog.showMessageBox({type: "warning", message: "I can't find Pandoc! Has it been installed?"})
      return false;
    }
  })
}

const assetsDirectory = path.join(__dirname, 'assets')

var mb = menubar({
  icon: path.join(assetsDirectory, 'docdown_iconTemplate.png'),
  width: 300,
  height: 400,
  transparent: false,
  hasShadow: true,
  resizable: false
})

mb.on('ready', function ready () {
  // Add /usr/local/bin and /usr/local/sbin to $PATH because they aren't in $PATH if the application is started from Finder
  process.env.PATH += ':/usr/local/bin:/usr/local/sbin';

  // If this is the first time this app is started, settings will be empty and need to be filled with defaults
  let settingsSet = settings.get("defaults.outputDirectory");
  if (!settingsSet) {
    console.log("No settings are set!")
    settings.setAll({
      defaults: {
        outputDirectory: app.getPath('home'),
        bibliographyFile: '',
        cslFile: path.join(assetsDirectory, '/csl/chicago-note-bibliography.csl'),
        cslSource: 'internal',
        cslInternalVal: 'chicago-note',
        docxFile: path.join(assetsDirectory, '/docx/pandoc-default-reference.docx'),
        docxSource: 'internal',
        docxInternalVal: 'pandoc',
        autoLaunch: false,
        autoUpdateCheck: true
      }
    });
  }

  // Check if 'autoUpdateCheck' setting is set (new in v0.2)
  let autoUpdateCheckSet = settings.get("defaults.autoUpdateCheck");
  if (!autoUpdateCheckSet) {
    console.log("Auto update setting is missing!")
    settings.set("defaults.autoUpdateCheck", true);
  }

  // Check for new release
  if (settings.get("user.autoUpdateCheck", settings.get("defaults.autoUpdateCheck")) === true){
    checkForNewRelease()
      .then(
        data => {
          if (data.updateAvailable === true){
            dialog.showMessageBox({type: "info", message: "A new version of DocDown is available to download! Check the preferences window for more information."})
          }
        }
      )
      .catch(
        reason => {
          console.log(reason)
        }
      )
  }

  mb.on('after-create-window', function(event){
    // mb.window.openDevTools({mode: 'detach'})

    // Move window 4 pixels down from menubar
    var isWin = process.platform === "win32";
    yPosition = mb.positioner.calculate('trayCenter').y;
    if (isWin){
      yPosition = yPosition-4;
    }
    else {
      yPosition = yPosition+4;
    }
    mb.setOption("y",yPosition);
  })
  mb.tray.on('drop-files', function (event, fileArray) {
    event.preventDefault();
    fileArray.forEach(function(file) {
      convert(file);
    });
  });
})

// Quit the app when the window is closed
app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-finish-launching', ()=>{
  app.on('open-file', function(event, file) {
  	event.preventDefault();
    convert(file)
  });
})


ipcMain.on('select_file', (event, target) => {
  if (target == "outputDirectory") {
    extension = ''
    element = '#output_directory_input'
    property = 'openDirectory'
  }
  if (target == "bibliographyFile") {
    extension = 'bib'
    element = '#bibliography_file_input'
    property = 'openFile'
  }
  else if (target == "cslFile") {
    extension = 'csl'
    element = '#csl_file_input'
    property = 'openFile'
  }
  else if (target == "docxFile"){
    extension = 'docx'
    element = '#docx_file_input'
    property = 'openFile'
  }
  dialog.showOpenDialog({
    properties: [property],
    filters: [{ name: '.' + extension + ' Files', extensions: [extension] }]
  }, function (file) {
      if (file !== undefined) {
        setPreference(target, file)
        event.sender.send('preference_value', {'element': element, 'value': file})
      }
  });
})

ipcMain.on('change_file_source', (event, payload) => {
  switch (payload.file) {
    case "csl":
      setPreference("cslSource", payload.value);
      break;
    case "docx":
      setPreference("docxSource", payload.value);
      break;
    default:
      break;
  }
});

ipcMain.on('choose_internal_file', (event, payload) => {
  if (payload.value == "") {
    setPreference(payload.preference + 'File', "");
    setPreference(payload.preference + 'InternalVal', payload.internalVal)
  }
  else {
    setPreference(payload.preference + 'File', path.join(assetsDirectory, payload.value));
    setPreference(payload.preference + 'InternalVal', payload.internalVal)
  }
});

ipcMain.on('clear_external_file', (event, target) => {
  setPreference(target, "");
});

ipcMain.on('set_auto_launch', (event, value) => {
  if (value === true){
    autoLauncher.isEnabled()
    .then(function(isEnabled){
      if(isEnabled){
        console.log("Launcher already enabled");
        return;
      }
      console.log("Enabling launcher");
      autoLauncher.enable();
    })
    setPreference("autoLaunch", true);
  }
  else if (value === false){
    autoLauncher.isEnabled()
    .then(function(isEnabled){
      if(!isEnabled){
        console.log("Launcher already disabled");
        return;
      }
      console.log("Disabling launcher");
      autoLauncher.disable();
    })
    setPreference("autoLaunch", false);
  }
})

ipcMain.on('set_auto_update_check', (event, value) => {
  if (value === true){
    setPreference("autoUpdateCheck", true);
  }
  else if (value === false){
    setPreference("autoUpdateCheck", false);
  }

})

ipcMain.on('show-preferences', () => {
  const preferencesWindow = eWindow.createWindow({ width: 686, height: 600, preload: true, resizable: false, frame: false })
  const preferencesPath = path.resolve(__dirname, 'preferences.html')
  const settingsObject = {
    outputDirectory: settings.get('user.outputDirectory', settings.get('defaults.outputDirectory')),
    bibliographyFile: settings.get('user.bibliographyFile', settings.get('defaults.bibliographyFile')),
    cslFile: settings.get('user.cslFile', settings.get('defaults.cslFile')),
    docxFile: settings.get('user.docxFile', settings.get('defaults.docxFile')),
    autoLaunch: settings.get('user.autoLaunch', settings.get('defaults.autoLaunch')),
    autoUpdateCheck: settings.get('user.autoUpdateCheck', settings.get('defaults.autoUpdateCheck')),
    cslSource: settings.get('user.cslSource', settings.get('defaults.cslSource')),
    docxSource: settings.get('user.docxSource', settings.get('defaults.docxSource')),
    cslInternalVal: settings.get('user.cslInternalVal', settings.get('defaults.cslInternalVal')),
    docxInternalVal: settings.get('user.docxInternalVal', settings.get('defaults.docxInternalVal')),
    currentRelease: app.getVersion()
  }
  console.log(settingsObject);
  preferencesWindow.showUrl(preferencesPath, settingsObject)
  // preferencesWindow.openDevTools({mode: 'detach'})
})

ipcMain.on('quit-app', () => {
  app.quit()
})

ipcMain.on('convert-file', (event, file) => {
  convert(file.path)
});

function setPreference (preference, value){
  preference = 'user.' + preference
  settings.set(preference, value)
  console.log("Preference for " + preference + " is now: ",settings.get(preference))
}
