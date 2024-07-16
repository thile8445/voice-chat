import { useEffect, useMemo, useRef, useState } from "react";
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
import { ROLES, TYPE_ACTION } from "./constants";
import { useAgoraVoiceChat } from "./useAgoraVoiceChat";
import { ATTRIBUTES_VOICE_CHAT, ROLE_CAN_ACTION_ACCEPT_TO_SPEAK } from "./util";

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

  const rtmUid = useRef(String(Math.floor(Math.random() * 2032)));
  const rtcUid = useRef(Math.floor(Math.random() * 2032));
  const token = null;
  const appId = "f412b67c2b19405b8d12625c11f5e4bc";

  const [avatarActive, setAvatarActive] = useState(null);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [userRole, setUserRole] = useState(ROLES.HOST); // Default role

  const [members, setMembers] = useState([]);

  const [isJoin, setIsJoin] = useState(false);

  const {
    initVoiceChat,
    getChanelMembers,
    getAttributes,
    getRole,
    micMuted,
    toggleMic,
    leaveRoom,
    leaveRtmChannel,
    channelClient,
    rtmClient,
    addOrUpdateAttributes,
    canActionFromRole,
    muteAllFromHost,
    setMuteAllFromHost,
    getAttributesChannel,
    addOrUpdateAttributesChannel,
    listRequest,
    setListRequest,
    requestedToSpeak,
    setRequestedToSpeak,
  } = useAgoraVoiceChat({
    appId,
    token,
    setMembers,
  });

  const getRoomId = () => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    if (urlParams.get("room")) {
      return urlParams.get("room").toLowerCase();
    }
  };

  useEffect(() => {
    let idRoom = getRoomId() || "";
    setRoomId(idRoom);
  }, []);

  const handleGetMembers = async () => {
    const listChannelMember = await getChanelMembers();
    const listMember = [];

    for (let i = 0; listChannelMember.length > i; i++) {
      const data = await getAttributes(
        listChannelMember[i],
        ATTRIBUTES_VOICE_CHAT
      );
      listMember.push({
        ...data,
        id: listChannelMember[i],
      });
    }
    setMembers(listMember);
  };

  const handleAttributesChannel = async () => {
    const dataAttributes = await getAttributesChannel([
      "muteAllFromHost",
      "listRequestSpeak",
    ]);
    if (dataAttributes?.muteAllFromHost?.value === "true") {
      setMuteAllFromHost("true");
    } else {
      setMuteAllFromHost("false");
    }
    if (dataAttributes?.listRequestSpeak?.value) {
      const arrRequest = JSON.parse(dataAttributes?.listRequestSpeak?.value);
      const role = getRole();
      if (ROLE_CAN_ACTION_ACCEPT_TO_SPEAK.includes(role)) {
        setListRequest(arrRequest);
      }
    }
  };

  const enterRoom = async (e) => {
    e.preventDefault();
    if (!avatarActive) {
      alert("Please select an avatar");
      return;
    }
    window.history.replaceState(null, null, `?room=${roomId}`);
    const micMuted = [ROLES.HOST, ROLES.CO_HOST]?.includes(userRole)
      ? false
      : true;

    await initVoiceChat(roomId, rtcUid.current, rtmUid.current, micMuted);
    await addOrUpdateAttributes({
      username,
      rtcUid: rtcUid?.current?.toString(),
      avatar: avatarActive?.Image,
      role: userRole,
      micMuted: micMuted?.toString(),
    });

    await handleAttributesChannel();

    await handleGetMembers();

    setIsJoin(true);
  };

  const handleToggleMuteAll = async () => {
    await addOrUpdateAttributesChannel({
      muteAllFromHost: muteAllFromHost === "true" ? "false" : "true",
    });
    setMuteAllFromHost(muteAllFromHost === "true" ? "false" : "true");
    const message = JSON.stringify({
      type:
        muteAllFromHost === "true"
          ? TYPE_ACTION.UN_MUTE_ALL
          : TYPE_ACTION.MUTE_ALL,
    });
    await channelClient?.sendMessage({ text: message });
  };
  const handleMuteAnotherUser = async (userId, isMuted) => {
    const message = JSON.stringify({
      type: TYPE_ACTION.MUTE_USER,
      userId,
      isMuted,
    });
    await channelClient?.sendMessage({ text: message });
    await handleGetMembers();
  };

  const canActionMuteUser = (role) => {
    return canActionFromRole(TYPE_ACTION.MUTE_USER, role);
  };

  const handleRequestToSpeaker = async () => {
    await addOrUpdateAttributes({
      status: TYPE_ACTION.REQUEST_TO_SPEAKER,
    });
    const message = JSON.stringify({
      type: TYPE_ACTION.REQUEST_TO_SPEAKER,
      rtcUid: rtcUid?.current?.toString(),
      username,
    });
    await channelClient?.sendMessage({ text: message });
    setRequestedToSpeak(true);
  };

  const handleAcceptOrRejectToSpeaker = async (type, rtcUid) => {
    const newListRequest = [...listRequest]?.filter(
      (item) => item?.rtcUid.toString() !== rtcUid
    );
    setListRequest(newListRequest);
    await addOrUpdateAttributesChannel({
      listRequestSpeak: JSON.stringify(newListRequest),
    });
    const message = JSON.stringify({
      type,
      rtcUid,
      username,
    });
    await channelClient?.sendMessage({ text: message });
  };

  const canActionUpdateRoleUser = (role) => {
    return canActionFromRole(TYPE_ACTION.UPDATE_ROLE_USER, role);
  };

  const handleUpdateRole = async (role, rtcUid) => {
    const message = JSON.stringify({
      type: TYPE_ACTION.UPDATE_ROLE_USER,
      rtcUid,
      role,
    });
    await channelClient?.sendMessage({ text: message });
  };

  const renderUpdateRole = (role, rtcUid) => {
    const arrRole = canActionUpdateRoleUser(role);
    return (
      <div>
        {arrRole && arrRole?.length > 0 && (
          <>
            {arrRole?.map((item) => {
              if (item !== role) {
                return (
                  <button
                    onClick={() => handleUpdateRole(item, rtcUid)}
                    key={item}
                  >
                    {item}
                  </button>
                );
              }
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div id="container">
        {isJoin ? (
          <>
            <div id="room-header">
              <h1 id="room-name"></h1>

              <div id="room-header-controls">
                {canActionFromRole(TYPE_ACTION.MUTE_ALL) && (
                  <button id="mic-mute-all" onClick={handleToggleMuteAll}>
                    {muteAllFromHost === "true" ? "Un Mute all" : "Mute all"}
                  </button>
                )}
                {canActionFromRole(TYPE_ACTION.TOGGLE_MUTE_SELF) ? (
                  <>
                    {rtmClient?.attributes?.role === ROLES?.LISTENER ? (
                      <button onClick={handleRequestToSpeaker}>
                        {requestedToSpeak ? "Requested" : "Request to speaker"}
                      </button>
                    ) : (
                      <img
                        id="mic-icon"
                        className={`control-icon ${
                          micMuted ? "" : "control-icon-active"
                        }`}
                        src={micMuted ? MicOffIcon : MicOnIcon}
                        onClick={() => toggleMic()}
                      />
                    )}
                  </>
                ) : (
                  "Block Mute From Host"
                )}

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
                      {rtcUid?.current?.toString() !== item?.rtcUid && (
                        <div>
                          <img
                            id="mic-icon"
                            className={`control-icon ${
                              item?.micMuted === "true"
                                ? ""
                                : "control-icon-active"
                            } ${
                              canActionMuteUser(item?.role)
                                ? ""
                                : "control-icon-disable"
                            }`}
                            src={
                              item?.micMuted === "true" ? MicOffIcon : MicOnIcon
                            }
                            onClick={() => {
                              if (canActionMuteUser(item?.role)) {
                                handleMuteAnotherUser(
                                  item?.rtcUid,
                                  item?.micMuted
                                );
                              }
                            }}
                          />
                        </div>
                      )}
                      {renderUpdateRole(item?.role, item?.rtcUid)}
                    </p>
                  </div>
                );
              })}
            </div>
            {ROLE_CAN_ACTION_ACCEPT_TO_SPEAK?.includes(
              rtmClient?.attributes?.role
            ) && (
              <div id="list-request">
                {listRequest?.map((item) => {
                  return (
                    <div key={item?.rtcUid} className="item-request">
                      <div className="title">
                        {item?.username} request to speaker
                      </div>
                      <button
                        onClick={() =>
                          handleAcceptOrRejectToSpeaker(
                            TYPE_ACTION.ACCEPT_TO_SPEAKER,
                            item?.rtcUid
                          )
                        }
                      >
                        accept
                      </button>
                      <button
                        onClick={() =>
                          handleAcceptOrRejectToSpeaker(
                            TYPE_ACTION.REJECT_TO_SPEAKER,
                            item?.rtcUid
                          )
                        }
                      >
                        reject
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
