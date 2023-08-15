const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      console.log(channel, data);
        let validChannels = [
          "quit-app",
          "show-preferences",
          "convert_again",
          "convert-file",
          "open-external-link",
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
      console.log(channel, func);
        let validChannels = ["fromMain"];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
  }
);

ipcRenderer.on('notify', (event, payload) => {
  console.log(payload)
  const notification = {
      title: payload.title,
      body: payload.body
  }
  const showNotification = new window.Notification(notification.title, notification);
  // let notification = new Notification(payload.title, {
  //   body: payload.body
  // })
  // console.log(showNotification)
})