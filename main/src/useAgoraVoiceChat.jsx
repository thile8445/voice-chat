import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import { useRef, useState } from "react";
import { ROLES, TYPE_ACTION } from "./constants";
import {
    ATTRIBUTES_VOICE_CHAT,
    ROLE_CAN_ACTION_ACCEPT_TO_SPEAK,
    ROLE_CAN_ACTION_MUTE_ALL,
    ROLE_CO_HOST_CAN_UPDATE_ROLE_USER,
    ROLE_ENABLE_MUTE_ALL,
    ROLE_HOST_CAN_UPDATE_ROLE_USER,
    ROLE_MUTED_BY_CO_HOST,
} from "./util";

export const useAgoraVoiceChat = ({ appId, token, setMembers }) => {
  const rtmClient = useRef(null);
  const channelClient = useRef(null);

  // rtc
  const [micMuted, setMicMuted] = useState(true);
  const [muteAllFromHost, setMuteAllFromHost] = useState("false");

  const [listRequest, setListRequest] = useState([]);
  const [requestedToSpeak, setRequestedToSpeak] = useState(false);

  const rtcClient = useRef(null);
  const audioTracks = useRef({
    localAudioTrack: null,
    remoteAudioTracks: {},
  });

  const setMembersWhenUpdate = async () => {
    const listMember = await getInfoMembers();
    setMembers(listMember);
  };

  const canActionFromRole = (type = TYPE_ACTION.MUTE_ALL, roleOtherUser) => {
    const roleUser = rtmClient.current?.attributes?.role;

    switch (type) {
      case TYPE_ACTION.MUTE_USER:
        if (roleUser === ROLES.HOST && roleOtherUser !== ROLES.HOST) {
          return true;
        } else if (
          roleUser === ROLES.CO_HOST &&
          ROLE_MUTED_BY_CO_HOST.includes(roleOtherUser)
        ) {
          return true;
        }
        return false;

      case TYPE_ACTION.TOGGLE_MUTE_SELF:
        if (
          ROLE_MUTED_BY_CO_HOST.includes(roleUser) &&
          muteAllFromHost === "true"
        ) {
          return false;
        }
        return true;

      case TYPE_ACTION.UPDATE_ROLE_USER:
        if (
          roleUser === ROLES.HOST &&
          ROLE_HOST_CAN_UPDATE_ROLE_USER.includes(roleOtherUser)
        ) {
          return ROLE_HOST_CAN_UPDATE_ROLE_USER;
        }
        if (
          roleUser === ROLES.CO_HOST &&
          ROLE_CO_HOST_CAN_UPDATE_ROLE_USER.includes(roleOtherUser)
        ) {
          return ROLE_CO_HOST_CAN_UPDATE_ROLE_USER;
        }
        return false;

      default:
        if (ROLE_CAN_ACTION_MUTE_ALL.includes(roleUser)) {
          return true;
        }
        return false;
    }
  };

  const initRtc = async (roomId, rtcUid, isMuted) => {
    try {
      rtcClient.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

      rtcClient.current.on("user-published", handleUserPublished);
      rtcClient.current.on("user-left", handleUserLeft);
      await rtcClient.current.join(appId, roomId, token, rtcUid);

      audioTracks.current.localAudioTrack =
        await AgoraRTC.createMicrophoneAudioTrack();
      setMicMuted(isMuted);
      audioTracks.current.localAudioTrack.setMuted(isMuted);
      await rtcClient.current.publish(audioTracks.current.localAudioTrack);

      initVolumeIndicator();
    } catch (error) {
      console.log("ccc error", error);
    }
  };

  const initVolumeIndicator = async (timeInterval = 200) => {
    AgoraRTC.setParameter("AUDIO_VOLUME_INDICATION_INTERVAL", timeInterval);
    rtcClient.current.enableAudioVolumeIndicator();

    rtcClient.current.on("volume-indicator", (volumes) => {
      volumes.forEach((volume) => {
        //3
        try {
          let item = document.getElementsByClassName(`avatar-${volume.uid}`)[0];

          if (volume.level >= 50 && item?.style) {
            item.style.borderColor = "#00ff00";
          } else {
            if (item?.style) {
              item.style.borderColor = "#fff";
            }
          }
        } catch (error) {
          console.error(error);
        }
      });
    });
  };

  const handleUserPublished = async (user, mediaType) => {
    await rtcClient.current.subscribe(user, mediaType);

    if (mediaType == "audio") {
      audioTracks.current.remoteAudioTracks[user.uid] = [user.audioTrack];
      user.audioTrack.play();
    }
  };

  const handleUserLeft = async (user) => {
    delete audioTracks.current.remoteAudioTracks[user.uid];
  };

  const handleSendNotificationUpdateAttributes = async () => {
    const message = JSON.stringify({
      type: TYPE_ACTION.UPDATE_ATTRIBUTES,
    });
    await channelClient.current?.sendMessage({ text: message });
  };

  const toggleMic = async (isMuted = micMuted) => {
    if (isMuted) {
      setMicMuted(false);
      audioTracks.current.localAudioTrack.setMuted(false);
      await addOrUpdateAttributes({
        micMuted: "false",
      });
    } else {
      setMicMuted(true);
      audioTracks.current.localAudioTrack.setMuted(true);
      await addOrUpdateAttributes({
        micMuted: "true",
      });
    }
    await setMembersWhenUpdate();
    await handleSendNotificationUpdateAttributes();
  };

  let leaveRoom = async () => {
    audioTracks.current.localAudioTrack?.stop();
    audioTracks.current.localAudioTrack?.close();
    rtcClient.current?.unpublish();
    rtcClient.current?.leave();
  };

  // rtm

  const getInfoMembers = async () => {
    const listChannelMember = await channelClient.current.getMembers();
    const listMember = [];
    for (let i = 0; listChannelMember.length > i; i++) {
      const item = await rtmClient.current.getUserAttributesByKeys(
        listChannelMember[i],
        ATTRIBUTES_VOICE_CHAT
      );

      listMember.push({
        ...item,
        id: listChannelMember[i],
      });
    }
    return listMember;
  };

  const handleMemberJoined = async (memberId) => {
    await setMembersWhenUpdate();
  };

  const handleMemberLeft = async (memberId) => {
    const listMember = await getInfoMembers();
    setMembers(listMember?.filter((item) => item?.id !== memberId));
  };

  const updateListRequestToSpeakWhenAcceptOrReject = async () => {
    const roleUser = rtmClient.current?.attributes?.role;
    if (ROLE_CAN_ACTION_ACCEPT_TO_SPEAK.includes(roleUser)) {
      const dataList = await getAttributesChannel(["listRequestSpeak"]);
      const listRequestSpeak = dataList?.listRequestSpeak
        ? JSON.parse(dataList?.listRequestSpeak?.value)
        : [];
      const newListRequest = listRequestSpeak?.filter(
        (item) => item?.rtcUid.toString() !== data?.rtcUid.toString()
      );
      setListRequest(newListRequest);
      await addOrUpdateAttributesChannel({
        listRequestSpeak: JSON.stringify(newListRequest),
      });
    }
  };

  const handleMessage = async (message) => {
    const data = JSON.parse(message?.text);
    const roleUser = rtmClient.current?.attributes?.role;
    switch (data?.type) {
      case TYPE_ACTION.MUTE_USER:
        if (data?.userId.toString() === rtcClient.current?.uid.toString()) {
          toggleMic(data?.isMuted === "true");
        }
        setMuteAllFromHost(muteAllFromHost === "true" ? "false" : "true");
        break;

      case TYPE_ACTION.MUTE_ALL:
        if (ROLE_ENABLE_MUTE_ALL.includes(roleUser)) {
          toggleMic(false);
        }
        setMuteAllFromHost("true");
        break;

      case TYPE_ACTION.UN_MUTE_ALL:
        setMuteAllFromHost("false");
        break;

      case TYPE_ACTION.REQUEST_TO_SPEAKER:
        if (ROLE_CAN_ACTION_ACCEPT_TO_SPEAK.includes(roleUser)) {
          const dataList = await getAttributesChannel(["listRequestSpeak"]);
          const newListRequest = dataList?.listRequestSpeak
            ? JSON.parse(dataList?.listRequestSpeak?.value)
            : [];

          newListRequest.push(data);
          await addOrUpdateAttributesChannel({
            listRequestSpeak: JSON.stringify(newListRequest),
          });
          setListRequest(newListRequest);
        }
        break;

      case TYPE_ACTION.ACCEPT_TO_SPEAKER:
        await updateListRequestToSpeakWhenAcceptOrReject();
        if (data?.rtcUid.toString() === rtcClient.current?.uid.toString()) {
          await addOrUpdateAttributes({
            role: ROLES.SPEAKER,
          });
          setRequestedToSpeak(false);
          await setMembersWhenUpdate();
          await handleSendNotificationUpdateAttributes();
        }
        break;

      case TYPE_ACTION.UPDATE_ROLE_USER:
        if (data?.rtcUid.toString() === rtcClient.current?.uid.toString()) {
          await addOrUpdateAttributes({
            role: data?.role?.toString(),
          });
          await setMembersWhenUpdate();
          await handleSendNotificationUpdateAttributes();
        }
        break;

      case TYPE_ACTION.REJECT_TO_SPEAKER:
        await updateListRequestToSpeakWhenAcceptOrReject();
        if (data?.rtcUid.toString() === rtcClient.current?.uid.toString()) {
          setRequestedToSpeak(false);
        }
        break;

      case TYPE_ACTION.UPDATE_ATTRIBUTES:
        await setMembersWhenUpdate();
        break;

      default:
        break;
    }
  };

  const initRtm = async (roomId, rtmUid) => {
    try {
      rtmClient.current = AgoraRTM.createInstance(appId);

      await rtmClient.current.login({ uid: rtmUid, token });

      channelClient.current = rtmClient.current.createChannel(roomId);
      await channelClient.current.join();
      window.addEventListener("beforeunload", leaveRtmChannel);

      channelClient.current.on("MemberJoined", handleMemberJoined);
      channelClient.current.on("MemberLeft", handleMemberLeft);
      channelClient.current.on("ChannelMessage", handleMessage);
    } catch (error) {
      console.log("ccc error", error);
    }
  };

  const addOrUpdateAttributes = async (data) => {
    await rtmClient.current.addOrUpdateLocalUserAttributes(data);
  };

  const addOrUpdateAttributesChannel = async (data) => {
    await rtmClient.current.addOrUpdateChannelAttributes(
      channelClient.current.channelId,
      data
    );
  };

  const getAttributes = async (memberId, arrAttributes) => {
    return await rtmClient.current.getUserAttributesByKeys(
      memberId,
      arrAttributes
    );
  };

  const getAttributesChannel = async (arrAttributes) => {
    return await rtmClient.current?.getChannelAttributesByKeys(
      channelClient.current?.channelId,
      arrAttributes
    );
  };

  const clearAttributesChannel = async (arrAttributes) => {
    await rtmClient.current?.deleteChannelAttributesByKeys(
      channelClient.current?.channelId,
      arrAttributes
    );
  };

  const getRole = () => {
    return rtmClient.current?.attributes?.role;
  };

  const getChanelMembers = async () => {
    return await channelClient.current.getMembers();
  };

  const leaveRtmChannel = async () => {
    await channelClient.current?.leave();
    await rtmClient.current?.logout();
  };

  const initVoiceChat = async (roomId, rtcUid, rtmUid, micMuted) => {
    await initRtc(roomId, rtcUid, micMuted);
    await initRtm(roomId, rtmUid);
  };

  return {
    rtcClient: rtcClient.current,
    audioTracks: audioTracks.current,
    rtmClient: rtmClient.current,
    channelClient: channelClient.current,
    getRole,
    micMuted,
    muteAllFromHost,
    setMuteAllFromHost,
    initVoiceChat,
    toggleMic,
    leaveRoom,
    addOrUpdateAttributes,
    getAttributes,
    getChanelMembers,
    canActionFromRole,
    leaveRtmChannel,
    getAttributesChannel,
    addOrUpdateAttributesChannel,
    listRequest,
    setListRequest,
    requestedToSpeak,
    setRequestedToSpeak,
  };
};
