// ==UserScript==
// @name            AMQ Mega Commands
// @namespace       https://github.com/kempanator
// @version         0.8
// @description     Commands for AMQ Chat
// @author          kempanator
// @match           https://animemusicquiz.com/*
// @grant           none
// @require         https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL     https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js
// @updateURL       https://raw.githubusercontent.com/kempanator/amq-scripts/main/amqMegaCommands.js
// ==/UserScript==

/*
IMPORTANT: disable dice roller by thejoseph98 and chat commands by nyamu before installing

GAME SETTINGS
/size [2-40]        change room size
/type [oei]         change song types
/watched            change selection type to watched
/random             change selection type to random
/speed [1-4]        change song speed
/time [5-60]        change song guess time
/lives [1-5]        change number of lives
/team [1-8]         change team size
/songs [5-100]      change number of songs
/dif [low] [high]   change difficulty

IN GAME/LOBBY
/autoskip           automatically vote skip at the beginning of each song
/autosubmit         automatically submit answer on each key press
/autothrow [text]   automatically send answer at the beginning of each song
/autocopy [name]    automatically copy a team member's answer
/autoready          automatically ready up in lobby
/autostart          automatically start the game when everyone is ready if you are host
/ready              ready up in lobby
/invite [name]      invite player to game
/host [name]        promote player to host
/kick [name]        kick player
/skip               vote skip on current song
/pause              pause/unpause game
/lobby              start return to lobby vote
/leave              leave room
/rejoin [seconds]   leave and rejoin the room you are currently in after # of seconds
/spec               change to spectator
/join               change from spectator to player in lobby
/queue              join/leave queue
/volume [0-100]     change volume

OTHER
/roll               roll number, player, playerteam, spectator
/rules              show list of gamemodes and rules
/info               show list of external utilities
/pm [name] [text]   private message a player (name is case sensitive)
/profile [name]     show profile window of any player
/leaderboard        show the leaderboard
/password           reveal private room password
/invisible          show invisible friends (this command might be broken)
/logout             log out
/version            check the version of this script
*/

if (document.getElementById("startPage")) return;
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

function setup() {
    let auto_submit_answer_cookie = Cookies.get("mega_commands_auto_submit_answer");
    if (auto_submit_answer_cookie !== undefined ) {
        localStorage.setItem("mega_commands_auto_submit_answer", auto_submit_answer_cookie);
        Cookies.set("mega_commands_auto_submit_answer", "", { expires: 0 });
    }
    auto_submit_answer = localStorage.getItem("mega_commands_auto_submit_answer") === "true";
    let auto_ready_cookie = Cookies.get("mega_commands_auto_ready");
    if (auto_ready_cookie !== undefined ) {
        localStorage.setItem("mega_commands_auto_ready", auto_ready_cookie);
        Cookies.set("mega_commands_auto_ready", "", { expires: 0 });
    }
    auto_ready = localStorage.getItem("mega_commands_auto_ready") === "true";
    new Listener("game chat update", (payload) => {
        payload.messages.forEach((message) => { parseChat(message) });
    }).bindListener();
    new Listener("Game Chat Message", (payload) => {
        parseChat(payload);
    }).bindListener();
    new Listener("chat message response", (payload) => {
        parsePM(payload);
    }).bindListener();
    new Listener("play next song", (payload) => {
        if (!quiz.isSpectator && quiz.gameMode !== "Ranked") {
            if (auto_throw) quiz.answerInput.setNewAnswer(auto_throw);
            if (auto_skip) setTimeout(() => { quiz.skipClicked() }, 200);
        }
    }).bindListener();
    new Listener("Game Starting", (payload) => {
        if (auto_skip) sendSystemMessage("Auto Skip: Enabled");
        if (auto_submit_answer) sendSystemMessage("Auto Submit Answer: Enabled");
        if (auto_copy_player) sendSystemMessage("Auto Copy: " + auto_copy_player);
        if (auto_throw) sendSystemMessage("Auto Throw: " + auto_throw);
    }).bindListener();
    new Listener("team member answer", (payload) => {
        if (auto_copy_player && auto_copy_player === quiz.players[payload.gamePlayerId]._name.toLowerCase()) {
            let current_text = document.querySelector("#qpAnswerInput").value;
            quiz.answerInput.setNewAnswer(payload.answer);
            $("#qpAnswerInput").val(current_text);
        }
    }).bindListener();
    new Listener("Join Game", (payload) => {
        if (payload.error) return;
        if (auto_ready) sendSystemMessage("Auto Ready: Enabled");
        if (auto_start) sendSystemMessage("Auto Start: Enabled");
    }).bindListener();
    new Listener("Spectate Game", (payload) => {
        if (payload.error) return;
        if (auto_ready) sendSystemMessage("Auto Ready: Enabled");
        if (auto_start) sendSystemMessage("Auto Start: Enabled");
    }).bindListener();
    new Listener("Room Settings Changed", (payload) => {
        setTimeout(() => { autoReady() }, 1);
    }).bindListener();
    new Listener("Spectator Change To Player", (payload) => {
        if (payload.name === selfName) {
            setTimeout(() => { autoReady(); autoStart(); }, 1);
        }
    }).bindListener();
    new Listener("Host Promotion", (payload) => {
        setTimeout(() => { autoReady() }, 1);
    }).bindListener();
    document.querySelector("#qpAnswerInput").addEventListener("input", (event) => {
        let answer = event.target.value || " ";
        if (auto_submit_answer) {
            socket.sendCommand({
                type: "quiz",
                command: "quiz answer",
                data: { answer, isPlaying: true, volumeAtMax: false }
            });
        }
    });
    const profile_element = document.querySelector("#playerProfileLayer");
    const profile_observer = new MutationObserver(function() {
        if (profile_element.querySelector(".ppFooterOptionIcon, .startChat")) {
            profile_element.querySelector(".ppFooterOptionIcon, .startChat").classList.remove("disabled");
        }
    });
    profile_observer.observe(profile_element, {childList: true});
    AMQ_addScriptData({
        name: "Mega Commands",
        author: "kempanator",
        description: `<a href="https://kempanator.github.io/amq-mega-commands" target="_blank">https://kempanator.github.io/amq-mega-commands</a>`
    });
}

function parseChat(message) {
    if (checkRankedMode()) return;
    if (message.sender === selfName) {
        if (/^\/roll$/.test(message.message)) {
            sendChatMessage("roll commands: #, player, playerteam, spectator");
        }
        else if (/^\/roll [0-9]+$/.test(message.message)) {
            let number = parseInt(/^\S+ ([0-9]+)$/.exec(message.message)[1]);
            sendChatMessage("rolls " + (Math.floor(Math.random() * number) + 1));
        }
        else if (/^\/roll -?[0-9]+ -?[0-9]+$/.test(message.message)) {
            let low = parseInt(/^\S+ (-?[0-9]+) -?[0-9]+$/.exec(message.message)[1]);
            let high = parseInt(/^\S+ -?[0-9]+ (-?[0-9]+)$/.exec(message.message)[1]);
            sendChatMessage("rolls " + (Math.floor(Math.random() * (high - low + 1)) + low));
        }
        else if (/^\/roll (p|players?)$/.test(message.message)) {
            let player_list = getPlayerList();
            if (player_list.length > 0) {
                sendChatMessage(player_list[Math.floor(Math.random() * player_list.length)]);
            }
            else {
                sendChatMessage("no players");
            }
        }
        else if (/^\/roll (pt|playerteams?|teams?)$/.test(message.message)) {
            if (lobby.settings.teamSize > 1) {
                let teamDictionary = getTeamDictionary();
                if (Object.keys(teamDictionary).length > 0) {
                    let teams = Object.keys(teamDictionary);
                    teams.sort((a, b) => parseInt(a) - parseInt(b));
                    for (let team of teams) {
                        let name = teamDictionary[team][Math.floor(Math.random() * teamDictionary[team].length)];
                        sendChatMessage(`Team ${team}: ${name}`);
                    }
                }
            }
            else {
                sendChatMessage("team size must be greater than 1");
            }
        }
        else if (/^\/roll (s|spectators?)$/.test(message.message)) {
            let spectator_list = getSpectatorList();
            if (spectator_list.length > 0) {
                sendChatMessage(spectator_list[Math.floor(Math.random() * spectator_list.length)]);
            }
            else {
                sendChatMessage("no spectators");
            }
        }
        else if (/^\/size [0-9]+$/.test(message.message)) {
            let option = parseInt(/^\S+ ([0-9]+)$/.exec(message.message)[1]);
            let settings = hostModal.getSettings();
            settings.roomSize = option;
            changeGameSettings(settings);
        }
        else if (/^\/(t|types?|songtypes?) \w+$/.test(message.message)) {
            let option = /^\S+ (\w+)$/.exec(message.message)[1].toLowerCase();
            let settings = hostModal.getSettings();
            settings.songType.standardValue.openings = option.includes("o");
            settings.songType.standardValue.endings = option.includes("e");
            settings.songType.standardValue.inserts = option.includes("i");
            settings.songType.advancedValue.openings = 0;
            settings.songType.advancedValue.endings = 0;
            settings.songType.advancedValue.inserts = 0;
            settings.songType.advancedValue.random = settings.numberOfSongs;
            changeGameSettings(settings);
        }
        else if (/^\/watched$/.test(message.message)) {
            let settings = hostModal.getSettings();
            settings.songSelection.standardValue = 1;
            settings.songSelection.advancedValue["watched"] = 0;
            settings.songSelection.advancedValue["unwatched"] = 0;
            settings.songSelection.advancedValue["random"] = settings.numberOfSongs;
            changeGameSettings(settings);
        }
        else if (/^\/random$/.test(message.message)) {
            let settings = hostModal.getSettings();
            settings.songSelection.standardValue = 3;
            settings.songSelection.advancedValue["watched"] = settings.numberOfSongs;
            settings.songSelection.advancedValue["unwatched"] = 0;
            settings.songSelection.advancedValue["random"] = 0;
            changeGameSettings(settings);
        }
        else if (/^\/(s|speed) [0-9.]+$/.test(message.message)) {
            let option = parseFloat(/^\S+ ([0-9.]+)$/.exec(message.message)[1]);
            let settings = hostModal.getSettings();
            settings.playbackSpeed.randomOn = false;
            settings.playbackSpeed.standardValue = option;
            changeGameSettings(settings);
        }
        else if (/^\/time [0-9]+$/.test(message.message)) {
            let option = parseInt(/^\S+ ([0-9]+)$/.exec(message.message)[1]);
            let settings = hostModal.getSettings();
            settings.guessTime.randomOn = false;
            settings.guessTime.standardValue = option;
            changeGameSettings(settings);
        }
        else if (/^\/lives [0-9]+$/.test(message.message)) {
            let option = parseInt(/^\S+ ([0-9]+)$/.exec(message.message)[1]);
            let settings = hostModal.getSettings();
            settings.scoreType = 3;
            settings.lives = option;
            changeGameSettings(settings);
        }
        else if (/^\/team [0-9]+$/.test(message.message)) {
            let option = parseInt(/^\S+ ([0-9]+)$/.exec(message.message)[1]);
            let settings = hostModal.getSettings();
            settings.teamSize.randomOn = false;
            settings.teamSize.standardValue = option;
            changeGameSettings(settings);
        }
        else if (/^\/(n|songs) [0-9]+$/.test(message.message)) {
            let option = parseInt(/^\S+ ([0-9]+)$/.exec(message.message)[1]);
            let settings = hostModal.getSettings();
            settings.numberOfSongs = option;
            changeGameSettings(settings);
        }
        else if (/^\/(d|dif|difficulty) [0-9]+[ -][0-9]+$/.test(message.message)) {
            let low = parseInt(/^\S+ ([0-9]+)[ -][0-9]+$/.exec(message.message)[1]);
            let high = parseInt(/^\S+ [0-9]+[ -]([0-9]+)$/.exec(message.message)[1]);
            let settings = hostModal.getSettings();
            settings.songDifficulity.advancedOn = true;
            settings.songDifficulity.advancedValue = [low, high];
            changeGameSettings(settings);
        }
        else if (/^\/skip$/.test(message.message)) {
            quiz.skipClicked();
        }
        else if (/^\/pause$/.test(message.message)) {
            socket.sendCommand({ type:"quiz", command:"quiz " + (quiz.pauseButton.pauseOn ? "unpause" : "pause") });
        }
        else if (/^\/autoskip$/.test(message.message)) {
            auto_skip = !auto_skip;
            sendSystemMessage("auto skip " + (auto_skip ? "enabled" : "disabled"));
        }
        else if (/^\/autosubmit$/.test(message.message)) {
            auto_submit_answer = !auto_submit_answer;
            localStorage.setItem("mega_commands_auto_submit_answer", auto_submit_answer);
            sendSystemMessage("auto submit answer " + (auto_submit_answer ? "enabled" : "disabled"));
        }
        else if (/^\/autocopy$/.test(message.message)) {
            auto_copy_player = "";
            sendSystemMessage("auto copy disabled");
        }
        else if (/^\/autocopy \w+$/.test(message.message)) {
            auto_copy_player = /^\S+ (\w+)$/.exec(message.message)[1].toLowerCase();
            sendSystemMessage("auto copying " + auto_copy_player);
        }
        else if (/^\/(at|autothrow)$/.test(message.message)) {
            auto_throw = "";
            sendSystemMessage("auto throw disabled " + auto_copy_player);
        }
        else if (/^\/(at|autothrow) .+$/.test(message.message)) {
            auto_throw = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(message.message)[1]).text;
            sendSystemMessage("auto throwing: " + auto_throw);
        }
        else if (/^\/autoready$/.test(message.message)) {
            auto_ready = !auto_ready;
            localStorage.setItem("mega_commands_auto_ready", auto_ready);
            sendSystemMessage("auto ready " + (auto_ready ? "enabled" : "disabled"));
        }
        else if (/^\/autostart$/.test(message.message)) {
            auto_start = !auto_start;
            sendSystemMessage("auto start game " + (auto_start ? "enabled" : "disabled"));
            autoStart();
        }
        else if (/^\/ready$/.test(message.message)) {
            autoReady();
        }
        else if (/^\/(inv|invite) \w+$/.test(message.message)) {
            let name = /^\S+ (\w+)$/.exec(message.message)[1];
            socket.sendCommand({
                type: "social",
                command: "invite to game",
                data: { target: name }
            });
        }
        else if (/^\/(spec|spectate)$/.test(message.message)) {
            lobby.changeToSpectator(selfName);
        }
        else if (/^\/(spec|spectate) \w+$/.test(message.message)) {
            let name = /^\S+ (\w+)$/.exec(message.message)[1];
            lobby.changeToSpectator(name);
        }
        else if (/^\/join$/.test(message.message)) {
            socket.sendCommand({
                type: "lobby",
                command: "change to player"
            });
        }
        else if (/^\/queue$/.test(message.message)) {
            gameChat.joinLeaveQueue();
        }
        else if (/^\/host \w+$/.test(message.message)) {
            let name = /^\S+ (\w+)$/.exec(message.message)[1];
            lobby.promoteHost(name);
        }
        else if (/^\/kick \w+$/.test(message.message)) {
            let name = /^\S+ (\w+)$/.exec(message.message)[1];
            socket.sendCommand({
                type: "lobby",
                command: "kick player",
                data: { playerName: name }
            });
        }
        else if (/^\/(lb|lobby|returntolobby)$/.test(message.message)) {
            quiz.startReturnLobbyVote();
        }
        else if (/^\/(v|volume) [0-9]+$/.test(message.message)) {
            let option = parseFloat(/^\S+ ([0-9]+)$/.exec(message.message)[1]) / 100;
            volumeController.volume = option;
            volumeController.adjustVolume();
            volumeController.setMuted(false);
        }
        else if (/^\/password$/.test(message.message)) {
            let password = hostModal.getSettings().password;
            if (password) sendChatMessage(password);
        }
        else if (/^\/invisible$/.test(message.message)) {
            let handleAllOnlineMessage = new Listener("all online users", function (onlineUsers) {
                let list = [];
                Object.keys(socialTab.offlineFriends).forEach((name) => { if(onlineUsers.includes(name)) list.push(name) });
                sendChatMessage(list.length > 0 ? list.join(", ") : "no invisible friends detected");
                handleAllOnlineMessage.unbindListener();
            });
            handleAllOnlineMessage.bindListener();
            socket.sendCommand({
                type: "social",
                command: "get online users",
            });
        }
        else if (/^\/(pm|dm)$/.test(message.message)) {
            socialTab.startChat(selfName);
        }
        else if (/^\/(pm|dm) \w+$/.test(message.message)) {
            let name = /^\S+ (\w+)$/.exec(message.message)[1];
            socialTab.startChat(name);
        }
        else if (/^\/(pm|dm) \w+ .+$/.test(message.message)) {
            let name = /^\S+ (\w+) .+$/.exec(message.message)[1];
            let text = /^\S+ \w+ (.+)$/.exec(message.message)[1];
            socialTab.startChat(name);
            socket.sendCommand({
                type: "social",
                command: "chat message",
                data: { target: name, message: text }
            });
        }
        else if (/^\/(prof|profile) \w+$/.test(message.message)) {
            let name = /^\S+ (\w+)$/.exec(message.message)[1].toLowerCase();
            playerProfileController.loadProfileIfClosed(name, $("#gameChatContainer"), {}, () => {}, false, true);
        }
        else if (/^\/leaderboards?$/.test(message.message)) {
            leaderboardModule.show();
        }
        else if (/^\/rules$/.test(message.message)) {
            sendChatMessage(Object.keys(rules).join(", "));
        }
        else if (/^\/rules .+$/.test(message.message)) {
            let option = /^\S+ (.+)$/.exec(message.message)[1];
            if (option in rules) sendChatMessage(rules[option]);
        }
        else if (/^\/info$/.test(message.message)) {
            sendChatMessage(Object.keys(info).join(", "));
        }
        else if (/^\/info .+$/.test(message.message)) {
            let option = /^\S+ (.+)$/.exec(message.message)[1];
            if (option in info) sendChatMessage(info[option]);
        }
        else if (/^\/rejoin$/.test(message.message)) {
            rejoinRoom(100);
        }
        else if (/^\/rejoin ([0-9]+)$/.test(message.message)) {
            let time = parseInt((/^\S+ ([0-9]+)$/).exec(message.message)[1]) * 1000;
            rejoinRoom(time);
        }
        else if (/^\/leave$/.test(message.message)) {
            setTimeout(() => { viewChanger.changeView("main") }, 1);
        }
        else if (/^\/(logout|logoff)$/.test(message.message)) {
            setTimeout(() => { viewChanger.changeView("main") }, 1);
            setTimeout(() => { options.logout() }, 10);
        }
        else if (/^\/version$/.test(message.message)) {
            sendChatMessage("Mega Commands version " + version);
        }
    }
}

function parsePM(message) {
    if (/^\/roll$/.test(message.msg)) {
        sendPM(message.target, "roll commands: #, player, playerteam, spectator");
    }
    else if (/^\/roll [0-9]+$/.test(message.msg)) {
        let number = parseInt(/^\S+ ([0-9]+)$/.exec(message.msg)[1]);
        sendPM(message.target, "rolls " + (Math.floor(Math.random() * number) + 1));
    }
    else if (/^\/roll -?[0-9]+ -?[0-9]+$/.test(message.msg)) {
        let low = parseInt(/^\S+ (-?[0-9]+) -?[0-9]+$/.exec(message.msg)[1]);
        let high = parseInt(/^\S+ -?[0-9]+ (-?[0-9]+)$/.exec(message.msg)[1]);
        sendPM(message.target, "rolls " + (Math.floor(Math.random() * (high - low + 1)) + low));
    }
    else if (/^\/autoskip$/.test(message.msg)) {
        auto_skip = !auto_skip;
        sendSystemMessage("auto skip " + (auto_skip ? "enabled" : "disabled"));
    }
    else if (/^\/autosubmit$/.test(message.msg)) {
        auto_submit_answer = !auto_submit_answer;
        localStorage.setItem("mega_commands_auto_submit_answer", auto_submit_answer);
        sendSystemMessage("auto submit answer " + (auto_submit_answer ? "enabled" : "disabled"));
    }
    else if (/^\/autocopy$/.test(message.msg)) {
        auto_copy_player = "";
        sendSystemMessage("auto copy disabled");
    }
    else if (/^\/autocopy \w+$/.test(message.msg)) {
        auto_copy_player = /^\S+ (\w+)$/.exec(message.msg)[1].toLowerCase();
        sendSystemMessage("auto copying " + auto_copy_player);
    }
    else if (/^\/(at|autothrow)$/.test(message.msg)) {
        auto_throw = "";
        sendSystemMessage("auto throw disabled");
    }
    else if (/^\/(at|autothrow) .+$/.test(message.msg)) {
        auto_throw = translateShortcodeToUnicode(/^\S+ (.+)$/.exec(message.msg)[1]).text;
        sendSystemMessage("auto throwing: " + auto_throw);
    }
    else if (/^\/autoready$/.test(message.msg)) {
        auto_ready = !auto_ready;
        localStorage.setItem("mega_commands_auto_ready", auto_ready);
        sendSystemMessage("auto ready " + (auto_ready ? "enabled" : "disabled"));
    }
    else if (/^\/autostart$/.test(message.msg)) {
        auto_start = !auto_start;
        sendSystemMessage("auto start game " + (auto_start ? "enabled" : "disabled"));
        autoStart();
    }
    else if (/^\/(pm|dm)$/.test(message.msg)) {
        socialTab.startChat(selfName);
    }
    else if (/^\/(pm|dm) \w+$/.test(message.msg)) {
        let name = /^\S+ (\w+)$/.exec(message.msg)[1];
        socialTab.startChat(name);
    }
    else if (/^\/(pm|dm) \w+ .+$/.test(message.msg)) {
        let name = /^\S+ (\w+) .+$/.exec(message.msg)[1];
        let text = /^\S+ \w+ (.+)$/.exec(message.msg)[1];
        socialTab.startChat(name);
        sendPM(name, text);
    }
    else if (/^\/(prof|profile) \w+$/.test(message.msg)) {
        let name = /^\S+ (\w+)$/.exec(message.msg)[1].toLowerCase();
        playerProfileController.loadProfileIfClosed(name, $("#gameChatContainer"), {}, () => {}, false, true);
    }
    else if (/^\/leaderboards?$/.test(message.msg)) {
        leaderboardModule.show();
    }
    else if (/^\/invisible$/.test(message.msg)) {
        let handleAllOnlineMessage = new Listener("all online users", function (onlineUsers) {
            let list = [];
            Object.keys(socialTab.offlineFriends).forEach((name) => { if(onlineUsers.includes(name)) list.push(name) });
            sendPM(message.target, list.length > 0 ? list.join(", ") : "no invisible friends detected");
            handleAllOnlineMessage.unbindListener();
        });
        handleAllOnlineMessage.bindListener();
        socket.sendCommand({
            type: "social",
            command: "get online users",
        });
    }
    else if (/^\/rules$/.test(message.msg)) {
        sendPM(message.target, Object.keys(rules).join(", "));
    }
    else if (/^\/rules .+$/.test(message.msg)) {
        let option = /^\S+ (.+)$/.exec(message.msg)[1];
        if (option in rules) sendPM(message.target, rules[option]);
    }
    else if (/^\/info$/.test(message.msg)) {
        sendPM(message.target, Object.keys(info).join(", "));
    }
    else if (/^\/info .+$/.test(message.msg)) {
        let option = /^\S+ (.+)$/.exec(message.msg)[1];
        if (option in info) sendPM(message.target, info[option]);
    }
    else if (/^\/leave$/.test(message.msg)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
    }
    else if (/^\/(logout|logoff)$/.test(message.msg)) {
        setTimeout(() => { viewChanger.changeView("main") }, 1);
        setTimeout(() => { options.logout() }, 10);
    }
    else if (/^\/version$/.test(message.msg)) {
        sendPM(message.target, "Mega Commands version " + version);
    }
    if (lobby.inLobby || quiz.inQuiz || battleRoyal.inView) {
        if (/^\/roll (p|players?)$/.test(message.msg)) {
            let player_list = getPlayerList();
            if (player_list.length > 0) {
                sendPM(message.target, player_list[Math.floor(Math.random() * player_list.length)]);
            }
            else {
                sendPM(message.target, "no players");
            }
        }
        else if (/^\/roll (pt|playerteams?|teams?)$/.test(message.msg)) {
            if (lobby.settings.teamSize > 1) {
                let teamDictionary = getTeamDictionary();
                if (Object.keys(teamDictionary).length > 0) {
                    let teams = Object.keys(teamDictionary);
                    teams.sort((a, b) => parseInt(a) - parseInt(b));
                    for (let team of teams) {
                        let name = teamDictionary[team][Math.floor(Math.random() * teamDictionary[team].length)];
                        sendPM(message.target, `Team ${team}: ${name}`);
                    }
                }
            }
            else {
                sendPM(message.target, "team size must be greater than 1");
            }
        }
        else if (/^\/roll (s|spectators?)$/.test(message.msg)) {
            let spectator_list = getSpectatorList();
            if (spectator_list.length > 0) {
                sendPM(message.target, spectator_list[Math.floor(Math.random() * spectator_list.length)]);
            }
            else {
                sendPM(message.target, "no spectators");
            }
        }
        else if (/^\/ready$/.test(message.msg)) {
            if (lobby.inLobby && !lobby.isReady && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
                lobby.fireMainButtonEvent();
            }
        }
        else if (/^\/(inv|invite) \w+$/.test(message.msg)) {
            let name = /^\S+ (\w+)$/.exec(message.msg)[1];
            socket.sendCommand({
                type: "social",
                command: "invite to game",
                data: { target: name }
            });
        }
        else if (/^\/(spec|spectate)$/.test(message.msg)) {
            lobby.changeToSpectator(selfName);
        }
        else if (/^\/(spec|spectate) \w+$/.test(message.msg)) {
            let name = /^\S+ (\w+)$/.exec(message.msg)[1];
            lobby.changeToSpectator(name);
        }
        else if (/^\/join$/.test(message.msg)) {
            socket.sendCommand({
                type: "lobby",
                command: "change to player"
            });
        }
        else if (/^\/queue$/.test(message.msg)) {
            gameChat.joinLeaveQueue();
        }
        else if (/^\/host \w+$/.test(message.msg)) {
            let name = /^\S+ (\w+)$/.exec(message.msg)[1];
            lobby.promoteHost(name);
        }
        else if (/^\/kick \w+$/.test(message.msg)) {
            let name = /^\S+ (\w+)$/.exec(message.msg)[1];
            socket.sendCommand({
                type: "lobby",
                command: "kick player",
                data: { playerName: name }
            });
        }
        else if (/^\/(lb|lobby|returntolobby)$/.test(message.msg)) {
            socket.sendCommand({
                type: "quiz",
                command: "start return lobby vote",
            });
        }
        else if (/^\/rejoin$/.test(message.msg)) {
            rejoinRoom(100);
        }
        else if (/^\/rejoin ([0-9]+)$/.test(message.msg)) {
            let time = parseInt((/^\S+ ([0-9]+)$/).exec(message.msg)[1]) * 1000;
            rejoinRoom(time);
        }
        else if (/^\/password$/.test(message.msg)) {
            let password = hostModal.getSettings().password;
            if (password) sendPM(message.target, password);
        }
    }
}

// return array of names of players in game
function getPlayerList() {
    let player_list = [];
    if (lobby.inLobby) {
        for (let playerId in lobby.players) {
            player_list.push(lobby.players[playerId]._name);
        }
    }
    else if (quiz.inQuiz) {
        for (let playerId in quiz.players) {
            player_list.push(quiz.players[playerId]._name);
        }
    }
    else if (battleRoyal.inView) {
        for (let playerId in battleRoyal.players) {
            player_list.push(battleRoyal.players[playerId]._name);
        }
    }
    return player_list;
}

// return array of names of spectators
function getSpectatorList() {
    let spectator_list = [];
    for (let playerId in gameChat.spectators) {
        spectator_list.push(gameChat.spectators[playerId].name);
    }
    return spectator_list;
}

// return object with player names as keys and their team number as each value
function getTeamDictionary() {
    let teamDictionary = {};
    if (lobby.inLobby) {
        for (let lobbyAvatar of document.querySelectorAll(".lobbyAvatar")) {
            let name = lobbyAvatar.querySelector(".lobbyAvatarNameContainerInner").querySelector("h2").innerText;
            let team = lobbyAvatar.querySelector(".lobbyAvatarTeamContainer").querySelector("h3").innerText;
            if (isNaN(parseInt(team))) {
                sendChatMessage("Error: can't get team number for " + name);
                return {};
            }
            team in teamDictionary ? teamDictionary[team].push(name) : teamDictionary[team] = [name];
        }
    }
    else if (quiz.inQuiz) {
        for (let playerId in quiz.players) {
            let name = quiz.players[playerId]._name;
            let team = quiz.players[playerId].teamNumber.toString();
            team in teamDictionary ? teamDictionary[team].push(name) : teamDictionary[team] = [name];
        }
    }
    else if (battleRoyal.inView) {
        for (let playerId in battleRoyal.players) {
            let name = battleRoyal.players[playerId]._name;
            let team = battleRoyal.players[playerId].teamNumber.toString();
            team in teamDictionary ? teamDictionary[team].push(name) : teamDictionary[team] = [name];
        }
    }
    return teamDictionary;
}

// send a regular public message in game chat
function sendChatMessage(message) {
    socket.sendCommand({
        type: "lobby",
        command: "game chat message",
        data: { msg: message, teamMessage: false }
    });
}

// send a client side message to game chat
function sendSystemMessage(message) {
    setTimeout(() => { gameChat.systemMessage(message) }, 1);
}

// send a private message
function sendPM(target, message) {
    socket.sendCommand({
        type: "social",
        command: "chat message",
        data: { target: target, message: message }
    });
}

//return true if player is in solo lobby or quiz
function checkSoloMode() {
    return (lobby.inLobby && lobby.soloMode) || (quiz.inQuiz && quiz.soloMode) || (battleRoyal.inView && battleRoyal.soloMode);
}

//return true if player is in ranked lobby or quiz
function checkRankedMode() {
    return (lobby.inLobby && lobby.settings.gameMode === "Ranked") || (quiz.inQuiz && quiz.gameMode === "Ranked");
}

// return array of names of all friends
function getAllFriends() {
    return Object.keys(socialTab.onlineFriends).concat(Object.keys(socialTab.offlineFriends));
}

// change game settings
function changeGameSettings(settings) {
    let settingChanges = {};
    for (let key of Object.keys(settings)) {
        if (JSON.stringify(lobby.settings[key]) !== JSON.stringify(settings[key])) {
            settingChanges[key] = settings[key];
        }
    }
    if (Object.keys(settingChanges).length > 0) {
        hostModal.changeSettings(settingChanges);
        setTimeout(() => { lobby.changeGameSettings() }, 1);
    }
}

// check conditions and ready up in lobby
function autoReady() {
    if (auto_ready && lobby.inLobby && !lobby.isReady && !lobby.isHost && !lobby.isSpectator && lobby.settings.gameMode !== "Ranked") {
        lobby.fireMainButtonEvent();
    }
}

// check conditions and start game
function autoStart() {
    setTimeout(() => {
        if (auto_start) {
            for (let player of Object.values(lobby.players)) {
                if (!player.ready) return;
            }
            lobby.fireMainButtonEvent();
        }
    }, 1);
}

// overload changeView function for auto ready
ViewChanger.prototype.changeView = (function() {
    let old = ViewChanger.prototype.changeView;
    return function() {
        old.apply(this, arguments);
        setTimeout(() => {
            if (viewChanger.currentView === "lobby") {
                autoReady();
                autoStart();
            }
        }, 1);
    }
})();

const rules = {
    "alien": "https://pastebin.com/LxLMg1nA",
    "blackjack": "https://pastebin.com/kcq7hsJm",
    "dualraidboss": "https://pastebin.com/XkG7WWwj",
    "newgamemode": "https://pastebin.com/TAyYVsii",
    "password": "https://pastebin.com/17vKE78J",
    "pictionary": "https://pastebin.com/qc3NQJdX",
    "raidboss": "https://pastebin.com/NE28GUPq",
    "reversepassword": "https://pastebin.com/S8cQahNA",
    "spy": "https://pastebin.com/Q1Z35czX",
    "warlords": "https://pastebin.com/zWNRFsC3"
};

const info = {
    "draw": "https://aggie.io",
    "piano": "https://musiclab.chromeexperiments.com/Shared-Piano/#amqpiano",
    "turnofflist": "https://files.catbox.moe/hn1mhw.png"
};

const version = "0.8";
let auto_skip = false;
let auto_submit_answer;
let auto_throw = "";
let auto_copy_player = "";
let auto_ready;
let auto_start = false;
