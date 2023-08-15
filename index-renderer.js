  $("#quit_button").click(function(){
    console.log(window);
    window.api.send('quit-app');
  })
  $("#settings_button").click(function(){
    window.api.send('show-preferences');
  });
  $("#help_button").click(function(){
    $("#drag-file-container").toggle();
    $("#help_section").toggle();
    $(this).toggleClass("active");
  });
  $("#external_link").click(function(e){
    e.preventDefault();
    window.api.send('open-external-link', 'https://github.com/lowercasename/docdown');
  })
  $(document).ready(function() {
      $("#convert_again_button").click(function(){
        window.api.send('convert_again');
      })

      var holder = document.getElementById('drag-file')

      holder.ondragover = (event) => {
        event.preventDefault();
        $("#drag-file").css("background-color","#ededed")
        console.log("Dragging over!")
      };

      holder.ondragleave = (event) => {
        event.preventDefault();
        $("#drag-file").css("background-color","#fafafa")
          console.log("Dragging left!")
      };

      holder.ondrop = (event) => {
          event.preventDefault();
          $("#drag-file").css("background-color","#fafafa")
          console.log("Done did dropped!")
          for (let f of event.dataTransfer.files) {
            window.api.send('convert-file', {"path": f.path, "type": f.type});
          }

          return false;
      };
  });