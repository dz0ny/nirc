(function ($) {
  $.nirc = function () {
    var options = {
      server:   $("#server").val(),
      port:     $("#port").val(),
      nickname: $("#nickname").val(),
      channels: $("#channels").val(),
      ssl:      $("#ssl").is(":checked"),
      password: $("#password").val()
    }

    if (options.server == "" || options.nickname == "" || options.channels == "") {
      alert('Fields marked with * are required!');
      return;
    } 
    else if (typeof(Storage) !== "undefined" && localStorage) {
      //store the options in localStorage
      var opts = $.extend({}, options); //copy to modify
      delete opts['password']; //except password, probably a bad idea
      localStorage.ircOptions = JSON.stringify(opts);
    }

    var socket        = io.connect(null);

    var connectForm   = $('#connect-form');
    var ircStuff      = $('#irc-stuff');
    var tabs          = $('#tabs');
    var tabViews      = $('#tab-views');
    var commandInput  = $('#command-input');

    var newMsg = function (msgData) {
      var msgType = (msgData.reciever == 'status' ? 'status' : 'channel');

      var tab     = $('.tab[title="'+msgData.receiver.toLowerCase()+'"]');
      var tabView = $('.tab-view[title="'+tab.attr('title')+'"]');
      var newLine = $('<div>').addClass('line ' + msgType);

      var timestamp = $("<span>").addClass('timestamp').text(new Date().toString().split(' ')[4]);
      newLine.append(timestamp);

      if (msgType == 'channel' && msgData.from !== undefined) {
        if (!tab.hasClass('active')) {
          tab.addClass('new-msgs');
        }
        
        var msgFrom = $('<span>').addClass('from').text(msgData.from + ': ');
        
        if (msgData.fromYou) {
          msgFrom.addClass('from-you');
        }

        newLine.append(msgFrom);
      }

      newLine.append(msgData.message);
      
      tabView.append(newLine)
             .scrollTop(tabView[0].scrollHeight);
    }

    var newTab = function (tabName) {
      if ($('.tab[title="'+tabName.toLowerCase()+'"]').length == 0) {
        $('.tab').removeClass('active');
        $('.tab-view').removeClass('active');

        var tab = $('<li>').attr('title', tabName.toLowerCase())
                           .addClass('tab active')
                           .text(tabName);

        tab.click(function () {
          $('.tab').removeClass('active');
          $('.tab-view').removeClass('active');

          var tabToActivate   = $(this);
          var tabViewToActive = $('.tab-view[title="'+tabToActivate.attr('title')+'"]');

          activateTab(tabToActivate, tabViewToActive);
        });

        tabs.append(tab);

        var tabView = $('<div>').attr('title', tabName.toLowerCase())
                                .addClass('tab-view active');

        tabViews.append(tabView);
      }
    }

    var closeTab = function (tabName) {
      var tabNameToClose = tabName.toLowerCase();

      var tab     = $('.tab[title="'+tabNameToClose+'"]');
      var tabView = $('.tab-view[title="'+tabNameToClose+'"]');

      var currentActiveTab  = $('.tab.active').attr('title');
      if (currentActiveTab == tabNameToClose) {
        var tabToActivate     = tab.prev();
        var tabViewToActivate = $('.tab-view[title="'+tabToActivate.attr('title')+'"]');

        activateTab(tabToActivate, tabViewToActivate);
      }

      tab.remove();
      tabView.remove();
    }

    var changeTabWithKeyboard = function (direction) {
      // deactivate old tab
      var currentTab      = $('.tab.active');
      var currentTabView  = $('.tab-view[title="'+currentTab.attr('title')+'"]');

      currentTab.removeClass('active');
      currentTabView.removeClass('active');

      // activate new tab
      var tabToActivate;

      if (direction == 'left') {
        tabToActivate = (currentTab.prev().length == 1 ? currentTab.prev() : $('.tab').last());
      }
      else {
        tabToActivate = (currentTab.next().length == 1 ? currentTab.next() : $('.tab').first());
      }

      var tabViewToActivate = $('.tab-view[title="'+tabToActivate.attr('title')+'"]');

      activateTab(tabToActivate, tabViewToActivate);
    }

    var activateTab = function (tabToActivate, tabViewToActivate) {
      tabToActivate.addClass('active')
                   .removeClass('new-msgs');

      tabViewToActivate.addClass('active')
                       .scrollTop(tabViewToActivate[0].scrollHeight);

      commandInput.focus();
    }

    // START SOCKET LISTENERS
    socket.on('connect', function () {
      socket.emit('connectToIRC', { options: options });

      connectForm.hide();
      ircStuff.show();

      newTab('status');
    });

    socket.on('successfullyJoinedChannel', function (data) {
      newTab(data.channel);
    });

    socket.on('successfullyPartedChannel', function (data) {
      closeTab(data.channel);
    });

    socket.on('message', function (data) {
      if (data.receiver.search(/^[#]/) == -1 && data.receiver != 'status') newTab(data.from);

      var msgData = {
        receiver: data.receiver,
        message:  data.message,
        from:     data.from
      }
      
      newMsg(msgData);
    });
		
		socket.on('disconnected', function () {
			// ideally this should just clear the tabs and tabViews, hide the ircStuff, and show the connect form
			// reloading the page for now, the socket seems to close or something when disconnecting server side :/
			// tabs.html('');
			// tabViews.html('');
			// ircStuff.hide();
			// connectForm.show();
			window.location.reload()
		});
    // END SOCKET LISTENERS

    // CAPTURE USER TYPING
    commandInput.keypress(function (e) {
      var code = (e.keyCode ? e.keyCode : e.which);

      if (code == 13) { // user pressed enter
        var input = commandInput.val();

        if (input != '') {
          if (input.search(/^[\/]/) == 0) {
            // user is trying to use irc commands
						var splitInput 	= input.split(' ');
						var command 		= splitInput[0].substr(1).toLowerCase();
						
            // if a user types the command /part be sure to send
            // the currently active channel
            if (splitInput.length == 1) {
              var activeTab = $('.tab.active').text();

              if (activeTab == 'status') {
                commandInput.val('');
                return;
              }
              else {
                input = input + ' ' + activeTab;
              }
            }
						else if (command == 'msg') {
							var commandSplit 	= input.split(' ');
							var receiver 			= commandSplit[1];
							var message 			= commandSplit.splice(2, commandSplit.length - 2).join(' ');

							if (receiver.search(/^#/) == -1) {
								newTab(receiver);
							}
							
							if ($('.tab[title="' + receiver + '"]').length == 1) {
								newMsg({
									receiver: receiver,
									from:     'you',
									fromYou:  true,
									message:  message
								});
							}
							else {
								commandInput.val('');
								return;
							}
						}
						
						 commandInput.val('');
          }
          else {
            // normal message to current tab-view
            var receiver = $('.tab.active').attr('title');

            commandInput.val('');
            if (receiver == 'status') return;
						
						newMsg({
							receiver: receiver,
							from:     'you',
							fromYou:  true,
							message:  input
						});
						
						input = '/msg ' + receiver + ' ' + input;
          }
					
					socket.emit('command', input);
        }
      }
    });
    // END CAPTURE USER TYPING
		
		window.onbeforeunload = function () {
			socket.emit('command', 'quit');
		}
		
    // SETUP KEY BINDINGS
    Mousetrap.bind('ctrl+left', function () {
      changeTabWithKeyboard('left');
    });

    Mousetrap.bind('ctrl+right', function () {
      changeTabWithKeyboard('right');
    });
    // END KEY BINDINGS
  };
})(jQuery);

