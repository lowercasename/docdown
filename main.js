const {app, BrowserWindow, ipcMain, Tray, dialog} = require('electron')
const menubar = require('menubar')
const path = require('path')
const fs = require('fs')
const mime = require('mime-types')
const eWindow = require('electron-window')
const settings = require('electron-settings');
const AutoLaunch = require('auto-launch');
const commandExists = require('command-exists');
const notify = require('electron-main-notification')

var autoLauncher = new AutoLaunch({
    name: 'DocDown',
    isHidden: true,
    mac: {
      useLaunchAgent: true
    }
});

// console.log( process.env.PATH );

async function convert(filepath) {
  commandExists('pandoc', function(err, commandExists) {
    if(commandExists) {
      // Pandoc exists!
      const settingsObject = {
        outputDirectory: settings.get('user.outputDirectory', settings.get('defaults.outputDirectory')),
        bibliographyFile: settings.get('user.bibliographyFile', settings.get('defaults.bibliographyFile')),
        cslFile: settings.get('user.cslFile', settings.get('defaults.cslFile')),
        docxFile: settings.get('user.docxFile', settings.get('defaults.docxFile')),
        autoLaunch: settings.get('user.autoLaunch', settings.get('defaults.autoLaunch'))
      }
      if (settingsObject.outputDirectory === "" || settingsObject.bibliographyFile === "" || settingsObject.cslFile === "" || settingsObject.docxFile === "") {
        dialog.showMessageBox({type: "warning", message: "Please set file paths for all the files DocDown requires!"})
        return false;
      }
      const fileType = mime.lookup(filepath)
      if (fileType === "text/markdown" || fileType === "text/plain"){
        console.log("Looks like the right kinda file!")
        var pandoc = require('node-pandoc')
        const fileName = path.basename(filepath, path.extname(filepath))
        // const parentDirectory = path.dirname(filepath)
        const rawMarkdown = fs.readFileSync(filepath) + '\n\n# Bibliography'
        const outputFile = settingsObject.outputDirectory + '/' + fileName + '.docx'

        // This is where the magic happens, for a given definiton of 'magic'
        const hellScapeMcHorrorFace = ['-s','--filter','pandoc-citeproc','--bibliography',settingsObject.bibliographyFile,'--csl',settingsObject.cslFile,'--reference-doc',settingsObject.docxFile,'-f','markdown+smart+escaped_line_breaks','-t','docx','-o',outputFile];

        console.log("Beginning conversion!")

        callback = function (err, result) {
          if (err){
            console.error('Oh Noes: ',err);
            return false;
          }
          else {
            notify('Markdown converted sucessfully', { body: 'Word document saved in ' + settingsObject.outputDirectory })
            return console.log(result), result;
          }
        };
        pandoc(rawMarkdown, hellScapeMcHorrorFace, callback);
      }
      else {
        return false;
      }
    }
    else {
      dialog.showMessageBox({type: "warning", message: "I can't find Pandoc! Has it been installed?"})
      return false;
    }
  });
}

const assetsDirectory = path.join(__dirname, 'assets')

var mb = menubar({
  icon: path.join(assetsDirectory, 'docdown_icon.png'),
  width: 300,
  height: 400,
  transparent: true,
  resize: false,
  hasShadow: true,
  resizable: false
})

mb.on('ready', function ready () {
  process.env.PATH += ':/usr/local/bin';
  console.log(process.env.PATH);
  // mb.on('after-create-window', function(event){
  //   mb.window.openDevTools({mode: 'detach'})
  // })
  mb.tray.on('drop-files', function (event, fileArray) {
    event.preventDefault();
    fileArray.forEach(function(file) {
      console.log(file)
      convert(file);
    });
  });
})

// settings.setAll({
//   defaults: {
//     outputDirectory: app.getPath('home'),
//     bibliographyFile: '',
//     cslFile: '',
//     docxFile: '',
//     autoLaunch: ''
//   }
// });

console.log(settings.getAll());

// Quit the app when the window is closed
app.on('window-all-closed', () => {
  app.quit()
})

app.on('will-finish-launching', ()=>{
  app.on('open-file', function(event, file) {
  	event.preventDefault();
    // fileArray.forEach(function(file) {
      console.log(file)
      convert(file)
    // });
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
        // ipcRenderer.send('set-preference', {preference: 'bibliographyFile', value: file});
        // $("#bibliography_file_input").val(file);
      }
  });
})

ipcMain.on('set_auto_launch', (event, value) => {
  console.log("I'm being sent the value " + value)
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

ipcMain.on('show-preferences', () => {
  const preferencesWindow = eWindow.createWindow({ width: 486, height: 400, preload: true, resizable: false })
  const preferencesPath = path.resolve(__dirname, 'preferences.html')
  const settingsObject = {
    outputDirectory: settings.get('user.outputDirectory', settings.get('defaults.outputDirectory')),
    bibliographyFile: settings.get('user.bibliographyFile', settings.get('defaults.bibliographyFile')),
    cslFile: settings.get('user.cslFile', settings.get('defaults.cslFile')),
    docxFile: settings.get('user.docxFile', settings.get('defaults.docxFile')),
    autoLaunch: settings.get('user.autoLaunch', settings.get('defaults.autoLaunch'))
  }
  console.log(settingsObject);
  preferencesWindow.showUrl(preferencesPath, settingsObject)
  // preferencesWindow.openDevTools({mode: 'detach'})
})

ipcMain.on('quit-app', () => {
  app.quit()
})


ipcMain.on('show-window', () => {
  showWindow()
})

ipcMain.on('convert-file', (event, file) => {
  convert(file.path)
});

function setPreference (preference, value){
  preference = 'user.' + preference
  settings.set(preference, value)
  console.log("Preference is now: ",settings.get(preference))
}
