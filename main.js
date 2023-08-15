// DocDown Copyright (C) 2019 Raphael Kabo <mail at raphaelkabo dot com>
//
// This program is free software; you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free Software
// Foundation; either version 3 of the License, or (at your option) any later
// version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
// details.
//
// You should have received a copy of the GNU General Public License along with
// this program; if not, write to the Free Software Foundation, Inc., 51
// Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
//
// The GNU General Public License is available in the file LICENSE in the source
// distribution of DocDown.
//
// =====================================================================
//
// DocDown includes bundled binaries of the third-party Pandoc program. This
// program is licensed under the GPLv2 license. This license is available in the
// assets/bin directory in the source distribution of DocDown. The source
// distributions of this program is available at: https://github.com/jgm/pandoc/

const {
  app,
  shell,
  ipcMain,
  dialog,
  Notification,
} = require("electron");
const semver = require("semver");
const { menubar } = require("menubar");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const window = require("electron-window");
const settings = require("electron-settings");
const AutoLaunch = require("auto-launch");
const commandExists = require("command-exists");
const fetch = require("node-fetch");

const pandocErrorCodes = {
  1: "PandocIOError",
  3: "PandocFailOnWarningError",
  4: "PandocAppError",
  5: "PandocTemplateError",
  6: "PandocOptionError",
  21: "PandocUnknownReaderError",
  22: "PandocUnknownWriterError",
  23: "PandocUnsupportedExtensionError",
  24: "PandocCiteprocError",
  25: "PandocBibliographyError",
  31: "PandocEpubSubdirectoryError",
  43: "PandocPDFError",
  44: "PandocXMLError",
  47: "PandocPDFProgramNotFoundError",
  61: "PandocHttpError",
  62: "PandocShouldNeverHappenError",
  63: "PandocSomeError",
  64: "PandocParseError",
  65: "PandocParsecError",
  66: "PandocMakePDFError",
  67: "PandocSyntaxMapError",
  83: "PandocFilterError",
  84: "PandocLuaError",
  91: "PandocMacroLoop",
  92: "PandocUTF8DecodingError",
  93: "PandocIpynbDecodingError",
  94: "PandocUnsupportedCharsetError",
  97: "PandocCouldNotFindDataFileError",
  98: "PandocCouldNotFindMetadataFileError",
  99: "PandocResourceNotFound",
};

function removeChars(validChars, inputString) {
  var regex = new RegExp("[^" + validChars + "]", "g");
  return inputString.replace(regex, "");
}

var autoLauncher = new AutoLaunch({
  name: "DocDown",
  isHidden: true,
});

function showIntroductionWindow() {
  const introductionWindow = window.createWindow({
    width: 550,
    height: 460,
    resizable: false,
    frame: false,
    webPreferences: { nodeIntegration: true },
  });
  const introductionPath = path.resolve(__dirname, "introduction.html");
  introductionWindow.showUrl(introductionPath);
}

async function checkForNewRelease() {
  let currentRelease = app.getVersion();
  let response = await fetch(
    "https://api.github.com/repos/lowercasename/docdown/releases/latest"
  );
  let data = await response.json();
  let latestRelease = semver.coerce(data.tag_name);
  if (semver.gt(latestRelease.version, currentRelease)) {
    return {
      updateAvailable: true,
      latestRelease: latestRelease.version,
      releaseDate: data.published_at,
      releaseInformation: data.body,
      currentRelease: currentRelease,
    };
  } else {
    return {
      updateAvailable: false,
    };
  }
}

ipcMain.on("checkForNewRelease", (event) => {
  console.log("Checking for new release!");
  checkForNewRelease()
    .then((data) => {
      if (data) {
        event.sender.send("update_notification", data);
      } else {
        event.sender.send("update_notification", { updateAvailable: false });
      }
    })
    .catch((reason) => {
      event.sender.send("update_notification", {
        updateAvailable: false,
        fetchError: true,
      });
      console.log(reason);
    });
});

const getOutputDirectory = (inputFileName) => {
  const exportToInputDirectory = settings.get(
    "user.exportToInputDirectory",
    settings.get("defaults.exportToInputDirectory")
  );
  const outputDirectory = settings.get(
    "user.outputDirectory",
    settings.get("defaults.outputDirectory")
  );
  if (exportToInputDirectory === true) {
    return path.dirname(inputFileName);
  } else {
    return outputDirectory;
  }
};

const showNotification = (payload) => {
  new Notification({
    title: payload.title,
    body: payload.body,
  }).show();
};

async function convert(filepath) {
  console.log("Starting conversion");
  // First, check if we should even be trying to convert this file
  const fileType = mime.lookup(filepath);
  if (!(fileType == "text/markdown") && !(fileType == "text/plain")) {
    showNotification({
      title: "Markdown not converted",
      body: path.basename(filepath) + " is not a Markdown file.",
    });
    console.log("Not a Markdown file");
    return false;
  }
  // It's a Markdown file!
  console.log("It's a Markdown file!");
  console.log(filepath);
  const settingsObject = {
    mode: settings.get("user.mode", settings.get("defaults.mode")),
    outputFormat: settings.get(
      "user.outputFormat",
      settings.get("defaults.outputFormat")
    ),
    liveCitationsModeCitationFormat: settings.get(
      "user.liveCitationsModeCitationFormat",
      settings.get("defaults.liveCitationsModeCitationFormat")
    ),
    outputDirectory: settings.get(
      "user.outputDirectory",
      settings.get("defaults.outputDirectory")
    ),
    bibliographyFile: settings.get(
      "user.bibliographyFile",
      settings.get("defaults.bibliographyFile")
    ),
    cslFile: settings.get("user.cslFile", settings.get("defaults.cslFile")),
    docxFile: settings.get("user.docxFile", settings.get("defaults.docxFile")),
    markdownProcessor: settings.get(
      "user.markdownProcessor",
      settings.get("defaults.markdownProcessor")
    ),
    pandocExtensions: settings.get(
      "user.pandocExtensions",
      settings.get("defaults.pandocExtensions")
    ),
  };
  if (
    settingsObject.mode === "plainText" &&
    (
      settingsObject.outputDirectory === "" ||
      settingsObject.bibliographyFile === "" ||
      settingsObject.cslFile === "" ||
      settingsObject.docxFile === "" ||
      settingsObject.markdownProcessor === ""
    )
  ) {
    dialog.showMessageBox({
      type: "warning",
      message:
        "Please set file paths for all the files DocDown requires. You can set these paths in DocDown's preferences window (click the cog button in the DocDown window).",
    });
    return false;
  }
  // Prepare the input file and set the output directory
  const fileName = path.basename(filepath, path.extname(filepath));
  const rawMarkdown = fs.readFileSync(filepath) + "\n\n# Bibliography";
  const outputFile = `${getOutputDirectory(filepath)}/${fileName}.${settingsObject.outputFormat}`;

  let pandocBinaryPath = path
    .join(__dirname, "assets/bin/pandoc")
    .replace("app.asar", "app.asar.unpacked");
  
  let scannableCiteFilterPath = path
    .join(__dirname, "assets/bin/zotero.lua")
    .replace("app.asar", "app.asar.unpacked");

  const { spawn } = require("child_process");
  try {
    console.log(pandocBinaryPath);
    const plainTextFlags = [
      "--citeproc",
      "--bibliography",
      settingsObject.bibliographyFile,
      "--csl",
      settingsObject.cslFile,
    ];
    const liveCitationsFlags = [
      `--lua-filter=${scannableCiteFilterPath}`,
      `--metadata=zotero_csl_style:${settingsObject.liveCitationsModeCitationFormat}`,
    ];
    const pandocCommand = [
      ...(settingsObject.mode === "liveCitations" ? liveCitationsFlags : []),
      ...(settingsObject.mode === "plainText" ? plainTextFlags : []),
      ...(settingsObject.outputFormat === "docx" ? ["--reference-doc", settingsObject.docxFile] : []),
      "--resource-path",
      path.dirname(fileName),
      "-f",
      `${settingsObject.markdownProcessor}${settingsObject.pandocExtensions}`,
      "-t",
      settingsObject.outputFormat,
      "-o",
      outputFile,
    ];
    console.log(pandocCommand.join(" "));
    var pandocProcess = spawn(pandocBinaryPath, pandocCommand);
    pandocProcess.stdout.on("data", (data) => {
      console.log(data.toString());
    });
    pandocProcess.on("error", (err) => {
      console.log("Pandoc spawn error " + err);
    });
    pandocProcess.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
      if (code === 0) {
        console.log("Converted successfully.");
        showNotification({
          title: "Markdown converted sucessfully",
          body: "Exported document saved in " + getOutputDirectory(filepath),
        });
        shell.showItemInFolder(
          settingsObject.outputDirectory + "/" + fileName + "." + settingsObject.outputFormat
        );
        setPreference("lastConvertedFile", filepath);
      } else {
        console.log("Error in conversion.");
        dialog.showMessageBox({
          title: "Error converting Markdown",
          message: `Pandoc was unable to convert with the error ${pandocErrorCodes[code]}.`,
          silent: true,
        });
      }
    });
    pandocProcess.stdin.write(rawMarkdown);
    pandocProcess.stdin.end();
  } catch (err) {
    console.log("exception: " + err);
  }
}

async function externalConvert(filepath) {
  // First, check if we should even be trying to convert this file
  const fileType = mime.lookup(filepath);
  if (fileType === "text/markdown" || fileType === "text/plain") {
    // It's a Markdown file!
    commandExists("pandoc", function (err, pandocExists) {
      if (pandocExists) {
        // Pandoc exists!
        // Let's see if it's a recent enough version.
        var exec = require("child_process").exec;
        var child;
        child = exec("pandoc -v", function (error, stdout, stderr) {
          if (error !== null) {
            // This shouldn't really ever come up because commandExists should catch it first, but if it doesn't...
            dialog.showMessageBox({
              type: "warning",
              message: "I can't find Pandoc! Has it been installed?",
            });
            console.log("Error retrieving pandoc version: " + error);
            return false;
          } else {
            const pandocVersion = semver.coerce(stdout.split("\n")[0]);
            if (semver.lt(pandocVersion, "2.18.0")) {
              dialog.showMessageBox({
                type: "warning",
                message: "Please update Pandoc to version 2.18 or higher.",
              });
              console.log("Pandoc too old: " + pandocVersion);
              return false;
            }
            console.log("Pandoc version is " + pandocVersion);
            const settingsObject = {
              mode: settings.get("user.mode", settings.get("defaults.mode")),
              outputFormat: settings.get(
                "user.outputFormat",
                settings.get("defaults.outputFormat")
              ),
              liveCitationsModeCitationFormat: settings.get(
                "user.liveCitationsModeCitationFormat",
                settings.get("defaults.liveCitationsModeCitationFormat")
              ),
              outputDirectory: settings.get(
                "user.outputDirectory",
                settings.get("defaults.outputDirectory")
              ),
              bibliographyFile: settings.get(
                "user.bibliographyFile",
                settings.get("defaults.bibliographyFile")
              ),
              cslFile: settings.get(
                "user.cslFile",
                settings.get("defaults.cslFile")
              ),
              docxFile: settings.get(
                "user.docxFile",
                settings.get("defaults.docxFile")
              ),
              markdownProcessor: settings.get(
                "user.markdownProcessor",
                settings.get("defaults.markdownProcessor")
              ),
              pandocExtensions: settings.get(
                "user.pandocExtensions",
                settings.get("defaults.pandocExtensions")
              ),
            };
            console.log(settingsObject);
            if (
              settingsObject.mode === "plainText" &&
              (
                settingsObject.outputDirectory === "" ||
                settingsObject.bibliographyFile === "" ||
                settingsObject.cslFile === "" ||
                settingsObject.docxFile === "" ||
                settingsObject.markdownProcessor === ""
              )
            ) {
              dialog.showMessageBox({
                type: "warning",
                message:
                  "Please set file paths for all the files DocDown requires. You can set these paths in DocDown's preferences window (click the cog button in the DocDown window).",
              });
              return false;
            }
            var pandoc = require("node-pandoc");
            const fileName = path.basename(filepath, path.extname(filepath));
            let scannableCiteFilterPath = path
              .join(__dirname, "assets/bin/zotero.lua")
              .replace("app.asar", "app.asar.unpacked");

            // const parentDirectory = path.dirname(filepath)
            const rawMarkdown =
              fs.readFileSync(filepath) + "\n\n# Bibliography";
            const outputFile =
              `${getOutputDirectory(filepath)}/${fileName}.${settingsObject.outputFormat}`;

            console.log(outputFile);

            // This is where the magic happens, for a given definiton of 'magic'
            const plainTextFlags = [
              "--citeproc",
              "--bibliography",
              settingsObject.bibliographyFile,
              "--csl",
              settingsObject.cslFile,
            ];
            const liveCitationsFlags = [
              `--lua-filter=${scannableCiteFilterPath}`,
              `--metadata=zotero_csl_style:${settingsObject.liveCitationsModeCitationFormat}`,
            ];
            const pandocCommand = [
              ...(settingsObject.mode === "liveCitations" ? liveCitationsFlags : []),
              ...(settingsObject.mode === "plainText" ? plainTextFlags : []),
              ...(settingsObject.outputFormat === "docx" ? ["--reference-doc", settingsObject.docxFile] : []),
              "--resource-path",
              path.dirname(fileName),
              "-f",
              `${settingsObject.markdownProcessor}${settingsObject.pandocExtensions}`,
              "-t",
              settingsObject.outputFormat,
              "-o",
              outputFile,
            ];

            callback = function (err, result) {
              if (err) {
                console.error("Pandoc error: ", err);
                dialog.showMessageBox({
                  title: "Error converting Markdown",
                  message: `Pandoc was unable to convert with the error: ${err.toString()}.`,
                  silent: true,
                });
                return false;
              } else {
                console.log("Completed!");
                showNotification({
                  title: "Markdown converted sucessfully",
                  body:
                    "Exported document saved in " + getOutputDirectory(filepath),
                });
                shell.showItemInFolder(outputFile);
                return console.log(result), result;
              }
            };
            pandoc(rawMarkdown, pandocCommand, callback);
            setPreference("lastConvertedFile", filepath);
          }
        });
      } else {
        dialog.showMessageBox({
          type: "warning",
          message: "I can't find Pandoc! Has it been installed?",
        });
        return false;
      }
    });
  } else {
    showNotification({
      title: "Markdown not converted",
      body: path.basename(filepath) + " is not a Markdown file.",
    });
    return false;
  }
}

const assetsDirectory = path
  .join(__dirname, "assets")
  .replace("app.asar", "app.asar.unpacked");


const mb = menubar({
  icon: path.join(assetsDirectory, "docdown_iconTemplate.png"),
  width: 300,
  height: 400,
  transparent: false,
  hasShadow: true,
  resizable: false,
  preloadWindow: true,
  browserWindow: {
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.js"),
    },
  },
});

mb.on("ready", function ready() {
  console.log("App is ready!");

  // Add /usr/local/bin and /usr/local/sbin to $PATH because they aren't in $PATH if the application is started from Finder
  process.env.PATH += ":/usr/local/bin:/usr/local/sbin";

  // If this is the first time this app is started, settings will be empty and need to be filled with defaults
  let settingsSet = settings.get("defaults.outputDirectory");
  if (!settingsSet) {
    console.log("No settings are set!");
    settings.setAll({
      defaults: {
        mode: "plainText",
        outputFormat: "docx",
        liveCitationsModeCitationFormat: "chicago-note-bibliography",
        exportToInputDirectory: false,
        outputDirectory: app.getPath("home"),
        bibliographyFile: "",
        cslFile: path.join(
          assetsDirectory,
          "/csl/chicago-note-bibliography.csl"
        ),
        cslSource: "internal",
        cslInternalVal: "chicago-note",
        docxFile: path.join(
          assetsDirectory,
          "/docx/pandoc-default-reference.docx"
        ),
        docxSource: "internal",
        docxInternalVal: "pandoc",
        autoLaunch: false,
        autoUpdateCheck: true,
        markdownProcessor: "markdown",
      },
    });
    // If there aren't any settings, this is also the first time the app
    // has been launched, so show the introduction window
    showIntroductionWindow();
  }

  // Check if settings introduced in v0.2, v0.3, 0.6, and 0.7 are set
  let autoUpdateCheckSet = settings.get("defaults.autoUpdateCheck");
  if (!autoUpdateCheckSet) {
    console.log("Auto update setting is missing!");
    settings.set("defaults.autoUpdateCheck", true);
  }
  let useBundledPandocCheckSet = settings.get("defaults.useBundledPandoc");
  if (!useBundledPandocCheckSet) {
    console.log("Bundled Pandoc setting is missing!");
    settings.set("defaults.useBundledPandoc", true);
  }
  let pandocExtensionsCheck = settings.get("defaults.pandocExtensions");
  if (pandocExtensionsCheck !== "+smart+escaped_line_breaks") {
    console.log("Optional Pandoc extensions setting is missing!");
    settings.set("defaults.pandocExtensions", "+smart+escaped_line_breaks");
  }
  let markdownProcessorCheck = settings.get("defaults.markdownProcessor");
  if (!markdownProcessorCheck) {
    console.log("Optional Markdown processor setting is missing!");
    settings.set("defaults.markdownProcessor", "markdown");
  }
  let modeCheck = settings.get("defaults.mode");
  if (!modeCheck) {
    console.log("Mode setting is missing!");
    settings.set("defaults.mode", "plainText");
  }
  let liveCitationsModeCitationFormatCheck = settings.get(
    "defaults.liveCitationsModeCitationFormat"
  );
  if (!liveCitationsModeCitationFormatCheck) {
    console.log("Live citations mode citation format setting is missing!");
    settings.set(
      "defaults.liveCitationsModeCitationFormat",
      "chicago-note-bibliography"
    );
  }
  let outputFormatCheck = settings.get("defaults.outputFormat");
  if (!outputFormatCheck) {
    console.log("Output format setting is missing!");
    settings.set("defaults.outputFormat", "docx");
  }
  let exportToInputDirectoryCheck = settings.get(
    "defaults.exportToInputDirectory"
  );
  if (!exportToInputDirectoryCheck) {
    console.log("Export to input directory setting is missing!");
    settings.set("defaults.exportToInputDirectory", false);
  }

  // Check for new release
  if (
    settings.get(
      "user.autoUpdateCheck",
      settings.get("defaults.autoUpdateCheck")
    ) === true
  ) {
    checkForNewRelease()
      .then((data) => {
        if (data.updateAvailable === true) {
          dialog.showMessageBox({
            type: "info",
            message:
              "A new version of DocDown is available to download! Check the preferences window for more information.",
          });
        }
      })
      .catch((reason) => {
        console.log(reason);
      });
  }

  // Move window 4 pixels down from menubar
  var isWin = process.platform === "win32";
  yPosition = mb.positioner.calculate("trayCenter").y;
  if (isWin) {
    yPosition = yPosition - 4;
  } else {
    yPosition = yPosition + 4;
  }
  mb.setOption("y", yPosition);
  // mb.window.openDevTools({mode: 'detach'})

  mb.tray.on("drop-files", function (event, fileArray) {
    event.preventDefault();
    fileArray.forEach(function (file) {
      if (
        settings.get(
          "user.useBundledPandoc",
          settings.get("defaults.useBundledPandoc")
        ) === true
      ) {
        convert(file);
      } else {
        externalConvert(file);
      }
    });
  });
  mb.tray.on("drag-enter", function (event) {
    mb.showWindow();
  });
  mb.tray.on("drag-end", function (event) {
    mb.hideWindow();
  });
});

// Quit the app when the window is closed
// app.on('window-all-closed', () => {
//   app.quit()
// })

app.on("will-finish-launching", () => {
  app.on("open-file", function (event, file) {
    event.preventDefault();
    if (
      settings.get(
        "user.useBundledPandoc",
        settings.get("defaults.useBundledPandoc")
      ) === true
    ) {
      convert(file);
    } else {
      externalConvert(file);
    }
  });
});

ipcMain.on("change_mode", (event, mode) => {
  setPreference("mode", mode);
});

ipcMain.on("choose_live_citations_csl", (event, csl) => {
  setPreference("liveCitationsModeCitationFormat", csl);
});

ipcMain.on("set_export_to_input_directory", (event, value) => {
  setPreference("exportToInputDirectory", value);
});

ipcMain.on("select_file", (event, target) => {
  let name, extension, element, property;
  if (target == "outputDirectory") {
    extension = [""];
    element = "#output_directory_input";
    property = "openDirectory";
  }
  if (target == "bibliographyFile") {
    name = ".bib, .json, and .yaml Files";
    extension = ["bib", "json", "yaml"];
    element = "#bibliography_file_input";
    property = "openFile";
  } else if (target == "cslFile") {
    extension = ["csl"];
    element = "#csl_file_input";
    property = "openFile";
  } else if (target == "docxFile") {
    extension = ["docx"];
    element = "#docx_file_input";
    property = "openFile";
  }
  dialog
    .showOpenDialog({
      properties: [property],
      filters: [
        {
          name: typeof name !== "undefined" ? name : "." + extension + " Files",
          extensions: extension,
        },
      ],
    })
    .then((result) => {
      if (!result.cancelled && result.filePaths !== undefined) {
        setPreference(target, result.filePaths[0]);
        event.sender.send("preference_value", {
          element: element,
          value: result.filePaths[0],
        });
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

ipcMain.on("change_file_source", (event, payload) => {
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

ipcMain.on("choose_internal_file", (event, payload) => {
  if (payload.value == "") {
    setPreference(payload.preference + "File", "");
    setPreference(payload.preference + "InternalVal", payload.internalVal);
  } else {
    setPreference(
      payload.preference + "File",
      path.join(assetsDirectory, payload.value)
    );
    setPreference(payload.preference + "InternalVal", payload.internalVal);
  }
});

ipcMain.on("clear_external_file", (event, target) => {
  setPreference(target, "");
});

ipcMain.on("set_auto_launch", (event, value) => {
  if (value === true) {
    autoLauncher.isEnabled().then(function (isEnabled) {
      if (isEnabled) {
        console.log("Launcher already enabled");
        return;
      }
      console.log("Enabling launcher");
      autoLauncher.enable();
    });
    setPreference("autoLaunch", true);
  } else if (value === false) {
    autoLauncher.isEnabled().then(function (isEnabled) {
      if (!isEnabled) {
        console.log("Launcher already disabled");
        return;
      }
      console.log("Disabling launcher");
      autoLauncher.disable();
    });
    setPreference("autoLaunch", false);
  }
});

ipcMain.on("set_auto_update_check", (event, value) => {
  if (value === true) {
    setPreference("autoUpdateCheck", true);
  } else if (value === false) {
    setPreference("autoUpdateCheck", false);
  }
});

ipcMain.on("set_pandoc_source", (event, value) => {
  if (value === true) {
    setPreference("useBundledPandoc", true);
  } else if (value === false) {
    setPreference("useBundledPandoc", false);
  }
});

ipcMain.on("choose_markdown_processor", (event, payload) => {
  if (payload.value == "") {
    setPreference(payload.preference, "markdown");
  } else {
    setPreference(payload.preference, payload.value);
  }
});

ipcMain.on("choose_pandoc_extensions", (event, payload) => {
  if (!payload.value) {
    setPreference(payload.preference, "");
  } else {
    const whitelistedString = removeChars(
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_+-",
      payload.value.trim()
    );
    setPreference(payload.preference, whitelistedString);
  }
});

ipcMain.on("choose_output_format", (event, payload) => {
  if (payload.value == "") {
    setPreference(payload.preference, "docx");
  } else {
    setPreference(payload.preference, payload.value);
  }
});

ipcMain.on("show-preferences", () => {
  const preferencesWindow = window.createWindow({
    width: 636,
    height: 600,
    preload: true,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });
  // preferencesWindow.webContents.openDevTools({ mode: "detach" });
  const preferencesPath = path.resolve(__dirname, "preferences.html");
  const settingsObject = {
    mode: settings.get("user.mode", settings.get("defaults.mode")),
    outputFormat: settings.get(
      "user.outputFormat",
      settings.get("defaults.outputFormat")
    ),
    liveCitationsModeCitationFormat: settings.get(
      "user.liveCitationsModeCitationFormat",
      settings.get("defaults.liveCitationsModeCitationFormat")
    ),
    exportToInputDirectory: settings.get(
      "user.exportToInputDirectory",
      settings.get("defaults.exportToInputDirectory")
    ),
    outputDirectory: settings.get(
      "user.outputDirectory",
      settings.get("defaults.outputDirectory")
    ),
    bibliographyFile: settings.get(
      "user.bibliographyFile",
      settings.get("defaults.bibliographyFile")
    ),
    cslFile: settings.get("user.cslFile", settings.get("defaults.cslFile")),
    docxFile: settings.get("user.docxFile", settings.get("defaults.docxFile")),
    autoLaunch: settings.get(
      "user.autoLaunch",
      settings.get("defaults.autoLaunch")
    ),
    autoUpdateCheck: settings.get(
      "user.autoUpdateCheck",
      settings.get("defaults.autoUpdateCheck")
    ),
    useBundledPandoc: settings.get(
      "user.useBundledPandoc",
      settings.get("defaults.useBundledPandoc")
    ),
    pandocExtensions: settings.get(
      "user.pandocExtensions",
      settings.get("defaults.pandocExtensions")
    ),
    markdownProcessor: settings.get(
      "user.markdownProcessor",
      settings.get("defaults.markdownProcessor")
    ),
    cslSource: settings.get(
      "user.cslSource",
      settings.get("defaults.cslSource")
    ),
    docxSource: settings.get(
      "user.docxSource",
      settings.get("defaults.docxSource")
    ),
    cslInternalVal: settings.get(
      "user.cslInternalVal",
      settings.get("defaults.cslInternalVal")
    ),
    docxInternalVal: settings.get(
      "user.docxInternalVal",
      settings.get("defaults.docxInternalVal")
    ),
    currentRelease: app.getVersion(),
  };
  console.log(settingsObject);
  preferencesWindow.showUrl(preferencesPath, settingsObject);
});

ipcMain.on("convert_again", () => {
  if (settings.get("user.lastConvertedFile")) {
    if (
      settings.get(
        "user.useBundledPandoc",
        settings.get("defaults.useBundledPandoc")
      ) === true
    ) {
      convert(settings.get("user.lastConvertedFile"));
    } else {
      externalConvert(settings.get("user.lastConvertedFile"));
    }
  }
});

ipcMain.on("quit-app", () => {
  app.quit();
});

ipcMain.on("convert-file", (event, file) => {
  console.log(file);
  if (
    settings.get(
      "user.useBundledPandoc",
      settings.get("defaults.useBundledPandoc")
    ) === true
  ) {
    convert(file.path);
  } else {
    externalConvert(file.path);
  }
});

ipcMain.on('open-external-link', (event, payload) => {
  console.log(payload);
  shell.openExternal(payload);
})  

function setPreference(preference, value) {
  preference = "user." + preference;
  settings.set(preference, value);
  console.log(
    "Preference for " + preference + " is now: ",
    settings.get(preference)
  );
}
