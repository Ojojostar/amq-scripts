// ==UserScript==
// @name         AMQ Show Room Players
// @namespace    https://github.com/kempanator
// @version      0.23
// @description  Adds extra functionality to room tiles
// @author       kempanator
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js
// ==/UserScript==

/*
New room tile features:
1. Mouse over players bar to show full player list (friends & blocked have color)
2. Click name in player list to open profile
3. Click host name to open profile
4. Invisible friends are no longer hidden
5. Bug fix for friends list and host avatar not getting updated
*/

"use strict";
if (typeof Listener === "undefined") return;
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);

const version = "0.23";
//const saveData = validateLocalStorage("showRoomPlayers");
let showPlayerColors = true;
let showCustomColors = true;
let customColorMap = {};

function setup() {
    new Listener("New Rooms", (payload) => {
        payload.forEach((item) => {
            setTimeout(() => {
                let room = roomBrowser.activeRooms[item.id];
                if (room) {
                    room.createRoomPlayers();
                    room.clickHostName(item.host);
                }
            }, 1);
        });
    }).bindListener();
    new Listener("Room Change", (payload) => {
        if (payload.changeType === "players" || payload.changeType === "spectators") {
            setTimeout(() => {
                let room = roomBrowser.activeRooms[payload.roomId];
                if (room) {
                    room.updateFriends();
                    room.updateRoomPlayers();
                    if (payload.newHost) {
                        room.updateAvatar(payload.newHost.avatar);
                        room.clickHostName(payload.newHost.name);
                    }
                }
            }, 1);
        }
    }).bindListener();
    AMQ_addScriptData({
        name: "Show Room Players",
        author: "kempanator",
        version: version,
        link: "https://github.com/kempanator/amq-scripts/raw/main/amqShowRoomPlayers.user.js",
        description: `
            <ul><b>New room tile features:</b>
                <li>1. Mouse over players bar to show full player list (friends & blocked have color)</li>
                <li>2. Click name in player list to open profile</li>
                <li>3. Click host name to open profile</li>
                <li>4. Invisible friends are no longer hidden</li>
                <li>5. Bug fix for friends list and host avatar not getting updated</li>
            </ul>
        `
    });
    applyStyles();
}

// override updateFriends function to also show invisible friends
RoomTile.prototype.updateFriends = function() {
    this._friendsInGameMap = {};
    for (let player of this._players) {
        if (socialTab.isFriend(player))  {
            this._friendsInGameMap[player] = true;
        }
    }
    this.updateFriendInfo();
};

// override removeRoomTile function to also remove room players popover
const oldRemoveRoomTile = RoomBrowser.prototype.removeRoomTile;
RoomBrowser.prototype.removeRoomTile = function(tileId) {
    $(`#rbRoom-${tileId} .rbrProgressContainer`).popover("destroy");
    oldRemoveRoomTile.apply(this, arguments);
};

// add click event to host name to open player profile
RoomTile.prototype.clickHostName = function(host) {
    this.$tile.find(".rbrHost").css("cursor", "pointer").off("click").click(() => {
        playerProfileController.loadProfile(host, $(`#rbRoom-${this.id}`), {}, () => {}, false, true);
    });
};

// create room players popover
RoomTile.prototype.createRoomPlayers = function() {
    let thisRoomTile = this;
    let $playerList = $("<ul></ul>");
    let players = this._players.sort((a, b) => a.localeCompare(b));
    for (let player of players) {
        let li = $("<li></li>").addClass("srpPlayer").text(player);
        if (player === selfName) li.addClass("self");
        else if (socialTab.isFriend(player)) li.addClass("friend");
        else if (socialTab.isBlocked(player)) li.addClass("blocked");
        if (customColorMap.hasOwnProperty(player.toLowerCase())) li.addClass("customColor" + customColorMap[player.toLowerCase()]);
        $playerList.append(li);
    }
    this.$tile.find(".rbrFriendPopover").data("bs.popover").options.placement = "bottom";
    this.$tile.find(".rbrProgressContainer").tooltip("destroy").removeAttr("data-toggle data-placement data-original-title")
    .popover({
        container: "#roomBrowserPage",
        placement: "bottom",
        trigger: "manual",
        html: true,
        title: `${players.length} Player${players.length === 1 ? "" : "s"}`,
        content: $playerList[0].outerHTML
    })
    .off("mouseenter").on("mouseenter", function() {
        $(this).popover("show");
        $(".popover").off("mouseleave").on("mouseleave", () => {
            if (!$(`#rbRoom-${thisRoomTile.id}:hover`).length) {
                $(thisRoomTile.$tile).off("mouseleave");
                $(".popover").off("mouseleave click");
                $(this).popover("hide");
            }
        });
        $(thisRoomTile.$tile).off("mouseleave").on("mouseleave", () => {
            if (!$(".popover:hover").length) {
                $(thisRoomTile.$tile).off("mouseleave");
                $(".popover").off("mouseleave click");
                $(this).popover("hide");
            }
        });
        $(".popover").off("click").on("click", "li", function(e) {
            playerProfileController.loadProfile(e.target.innerText, $(thisRoomTile.$tile), {}, () => {}, false, true);
        });
    });
};

// update room players popover
RoomTile.prototype.updateRoomPlayers = function() {
    let $playerList = $("<ul></ul>");
    let players = this._players.sort((a, b) => a.localeCompare(b));
    for (let player of players) {
        let li = $("<li></li>").addClass("srpPlayer").text(player);
        if (player === selfName) li.addClass("self");
        else if (socialTab.isFriend(player)) li.addClass("friend");
        else if (socialTab.isBlocked(player)) li.addClass("blocked");
        if (customColorMap.hasOwnProperty(player.toLowerCase())) li.addClass("customColor" + customColorMap[player.toLowerCase()]);
        $playerList.append(li);
    }
    let options = this.$tile.find(".rbrProgressContainer").data("bs.popover").options;
    options.content = $playerList;
    options.title = `${players.length} Player${players.length === 1 ? "" : "s"}`;
};

// update the room tile avatar when a new host is promoted
RoomTile.prototype.updateAvatar = function(avatarInfo) {
    if (this.avatarPreloadImage) this.avatarPreloadImage.cancel();
    this.$tile.find(".rbrRoomImage").removeAttr("src srcset sizes").removeClass().addClass(`rbrRoomImage sizeMod${avatarInfo.avatar.sizeModifier}`);
    let avatarSrc = cdnFormater.newAvatarSrc(
        avatarInfo.avatar.avatarName,
        avatarInfo.avatar.outfitName,
        avatarInfo.avatar.optionName,
        avatarInfo.avatar.optionActive,
        avatarInfo.avatar.colorName,
        cdnFormater.AVATAR_POSE_IDS.BASE
    );
    let avatarSrcSet = cdnFormater.newAvatarSrcSet(
        avatarInfo.avatar.avatarName,
        avatarInfo.avatar.outfitName,
        avatarInfo.avatar.optionName,
        avatarInfo.avatar.optionActive,
        avatarInfo.avatar.colorName,
        cdnFormater.AVATAR_POSE_IDS.BASE
    );
    this.avatarPreloadImage = new PreloadImage(
        this.$tile.find(".rbrRoomImage"),
        avatarSrc,
        avatarSrcSet,
        false,
        this.AVATAR_SIZE_MOD_SIZES[avatarInfo.avatar.sizeModifier],
        () => {this.$tile.find(".rbrRoomImageContainer").css("background-image", `url("${cdnFormater.newAvatarBackgroundSrc(avatarInfo.background.backgroundHori, cdnFormater.BACKGROUND_ROOM_BROWSER_SIZE)}")`)},
        false,
        $("#rbRoomHider"),
        false,
        this.$tile
    );
};

// validate json data in local storage
function validateLocalStorage(name) {
    try {
        return JSON.parse(localStorage.getItem(name)) || {};
    }
    catch {
        return {};
    }
}

// apply styles
function applyStyles() {
    //$("#showRoomPlayersStyle").remove();
    const saveData2 = validateLocalStorage("highlightFriendsSettings");
    let selfColor = saveData2.smColorSelfColor ?? "#80c7ff";
    let friendColor = saveData2.smColorFriendColor ?? "#80ff80";
    let blockedColor = saveData2.smColorBlockedColor ?? "#ff8080";
    let customColors = saveData2.customColors ?? [];
    customColorMap = {};
    customColors.forEach((item, index) => {
        for (let player of item.players) {
            customColorMap[player] = index;
        }
    });
    let style = document.createElement("style");
    style.type = "text/css";
    style.id = "showRoomPlayersStyle";
    let text = `
        li.srpPlayer {
            cursor: pointer;
        }
        li.srpPlayer:hover {
            text-shadow: 0 0 6px white;
        }
    `;
    if (showPlayerColors) text += `
        li.srpPlayer.self {
            color: ${selfColor};
        }
        li.srpPlayer.friend {
            color: ${friendColor};
        }
        li.srpPlayer.blocked {
            color: ${blockedColor};
        }
    `;
    if (showCustomColors) {
        customColors.forEach((item, index) => {
            text += `
                li.srpPlayer.customColor${index} {
                    color: ${item.color};
                }
            `;
        });
    }
    style.appendChild(document.createTextNode(text));
    document.head.appendChild(style);
}
