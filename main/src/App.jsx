import { useCallback, useEffect, useState } from "react";
import "./App.css";
import LeaveIcon from "./assets/leave.svg";
import MicOffIcon from "./assets/mic-off.svg";
import MicOnIcon from "./assets/mic.svg";

import Male1 from "./assets/avatars/male-1.png";
import Male2 from "./assets/avatars/male-2.png";
import Male3 from "./assets/avatars/male-3.png";
import Male4 from "./assets/avatars/male-4.png";
import Male5 from "./assets/avatars/male-5.png";

import FeMale1 from "./assets/avatars/female-1.png";
import FeMale2 from "./assets/avatars/female-2.png";
import FeMale3 from "./assets/avatars/female-3.png";
import FeMale4 from "./assets/avatars/female-4.png";
import FeMale5 from "./assets/avatars/female-5.png";
import { useAgoraRTC } from "./useAgoraRTC";
import { useAgoraRTM } from "./useAgoraRTM";
import { roleCanMuteAll } from "./util";
import { ROLES } from "./constants";

function App() {
  const OPTIONS_AVATAR = [
    {
      id: "male1",
      Image: Male1,
    },
    {
      id: "male2",
      Image: Male2,
    },
    {
      id: "male3",
      Image: Male3,
    },
    {
      id: "male4",
      Image: Male4,
    },
    {
      id: "male5",
      Image: Male5,
    },
    {
      id: "female1",
      Image: FeMale1,
    },
    {
      id: "female2",
      Image: FeMale2,
    },
    {
      id: "female3",
      Image: FeMale3,
    },
    {
      id: "female4",
      Image: FeMale4,
    },
    {
      id: "female5",
      Image: FeMale5,
    },
  ];

  const token = null;
  const rtcUid = Math.floor(Math.random() * 2032);
  const appId = "f412b67c2b19405b8d12625c11f5e4bc";

  const rtmUid = String(Math.floor(Math.random() * 2032));

  const [avatarActive, setAvatarActive] = useState(null);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [userRole, setUserRole] = useState(ROLES.HOST); // Default role

  const [members, setMembers] = useState([]);

  const [isJoin, setIsJoin] = useState(false);

  const { initRtc, micMuted, toggleMic, leaveRoom, rtcClient } = useAgoraRTC({
    appId,
    token,
  });

  const handleMessage = useCallback(async (message) => {
    const data = JSON.parse(message?.text);

    if (data?.type?.includes("mute-user")) {
      if (data?.userId.toString() === rtcClient?.uid.toString()) {
        toggleMic();
      }
    } else if (data?.type?.includes("mute-all")) {
      toggleMic(false);
    }
  }, []);

  const {
    initRtm,
    getAttributes,
    addOrUpdateAttributes,
    getChanelMembers,
    leaveRtmChannel,
    channelClient,
  } = useAgoraRTM({
    appId,
    token,
    setMembers,
    handleMessage,
  });

  const getRoomId = () => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    if (urlParams.get("room")) {
      return urlParams.get("room").toLowerCase();
    }
  };

  const canMuteAll = roleCanMuteAll.includes(userRole);

  useEffect(() => {
    let idRoom = getRoomId() || "";
    setRoomId(idRoom);
  }, []);

  const handleGetMembers = async () => {
    const listChannelMember = await getChanelMembers();
    const listMember = [];

    for (let i = 0; listChannelMember.length > i; i++) {
      const data = await getAttributes(listChannelMember[i], [
        "username",
        "rtcUid",
        "avatar",
        "role"
      ]);
      listMember.push({
        ...data,
        id: listChannelMember[i],
      });
    }
    setMembers(listMember);
  };

  const enterRoom = async (e) => {
    e.preventDefault();
    if (!avatarActive) {
      alert("Please select an avatar");
      return;
    }
    window.history.replaceState(null, null, `?room=${roomId}`);
    await initRtc(roomId, rtcUid);

    await initRtm(roomId, rtmUid);
    await addOrUpdateAttributes({
      username,
      rtcUid: rtcUid?.toString(),
      avatar: avatarActive?.Image,
      role: userRole,
    });
    await handleGetMembers();

    setIsJoin(true);
  };

  const handleMuteAll = async () => {
    const message = JSON.stringify({
      type: "mute-all",
    });
    await channelClient?.sendMessage({ text: message });
  };

  return (
    <>
      <div id="container">
        {isJoin ? (
          <>
            <div id="room-header">
              <h1 id="room-name"></h1>

              <div id="room-header-controls">
                <button id="mic-mute-all" onClick={handleMuteAll}>
                  Mute all
                </button>
                <img
                  id="mic-icon"
                  className={`control-icon ${
                    micMuted ? "" : "control-icon-active"
                  }`}
                  src={micMuted ? MicOffIcon : MicOnIcon}
                  onClick={toggleMic}
                />
                <img
                  id="leave-icon"
                  className="control-icon"
                  src={LeaveIcon}
                  onClick={() => {
                    leaveRoom();
                    leaveRtmChannel();
                    setIsJoin(false);
                  }}
                />
              </div>
            </div>
            <div id="members">
              {members?.map((item) => {
                return (
                  <div
                    key={item?.id}
                    className={`speaker user-rtc-${item?.rtcUid}`}
                    id={item?.id}
                  >
                    <img
                      className={`user-avatar avatar-${item?.rtcUid}`}
                      src={item?.avatar}
                    />
                    <p>
                      {item?.username} - {item?.role}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <form id="form">
            <div>
              <h3>Select An Avatar:</h3>
            </div>
            <div id="avatars">
              {OPTIONS_AVATAR?.map((item) => {
                return (
                  <img
                    key={item?.id}
                    alt={item?.id}
                    className={`avatar-selection ${
                      item?.id === avatarActive?.id ? "avatar-active" : ""
                    }`}
                    src={item?.Image}
                    onClick={() => setAvatarActive(item)}
                  />
                );
              })}
            </div>
            <select
              id="role-select"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
            >
              {Object.entries(ROLES).map(([key, value]) => (
                <option key={key} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <div id="form-fields">
              <label>Display Name:</label>
              <input
                required
                name="displayname"
                type="text"
                value={username}
                placeholder="Enter username..."
                onChange={(e) => {
                  setUsername(e?.target?.value);
                }}
              />

              <label>Room Name:</label>
              <input
                required
                name="roomname"
                type="text"
                value={roomId}
                placeholder="Enter room name..."
                onChange={(e) => {
                  setRoomId(e?.target?.value);
                }}
              />

              <input
                disabled={!username || !roomId}
                name="username"
                type="submit"
                value="Enter Room"
                onClick={enterRoom}
              />
            </div>
          </form>
        )}
      </div>
    </>
  );
}

export default App;
