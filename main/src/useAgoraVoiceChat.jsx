import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import { useCallback, useRef, useState } from "react";
import {
  ATTRIBUTES_VOICE_CHAT,
  ROLE_CAN_ACTION_MUTE_ALL,
  ROLE_ENABLE_MUTE_ALL,
  ROLE_MUTED_BY_CO_HOST,
} from "./util";
import { ROLES, TYPE_ACTION } from "./constants";

export const useAgoraVoiceChat = ({ appId, token, setMembers }) => {
  const rtmClient = useRef(null);
  const channelClient = useRef(null);

  // rtc
  const [micMuted, setMicMuted] = useState(true);
  const [muteAllFromHost, setMuteAllFromHost] = useState(false);

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
    const roleUser = rtmClient.current.attributes?.role;
    if (type === TYPE_ACTION.MUTE_USER) {
      if (roleUser === ROLES.HOST && roleOtherUser !== ROLES.HOST) {
        return true;
      } else if (
        roleUser === ROLES.CO_HOST &&
        ROLE_MUTED_BY_CO_HOST.includes(roleOtherUser)
      ) {
        return true;
      }
      return false;
    } else {
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
      type: "update-attributes",
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

  const handleMemberJoined = async () => {
    await setMembersWhenUpdate();
  };

  const handleMemberLeft = async (memberId) => {
    const listMember = await getInfoMembers();
    setMembers(listMember?.filter((item) => item?.id !== memberId));
  };

  const handleMessage = async (message) => {
    const data = JSON.parse(message?.text);
    if (data?.type?.includes("mute-user")) {
      if (data?.userId.toString() === rtcClient.current?.uid.toString()) {
        toggleMic(data?.isMuted === "true");
      }
    } else if (data?.type?.includes("mute-all")) {
      if (ROLE_ENABLE_MUTE_ALL.includes(rtmClient.current.attributes?.role)) {
        setMuteAllFromHost(true);
        toggleMic(false);
      }
    } else if (data?.type?.includes("update-attributes")) {
      await setMembersWhenUpdate();
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

  const getAttributes = async (memberId, arrAttributes) => {
    return await rtmClient.current.getUserAttributesByKeys(
      memberId,
      arrAttributes
    );
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
    micMuted,
    initVoiceChat,
    toggleMic,
    leaveRoom,
    addOrUpdateAttributes,
    getAttributes,
    getChanelMembers,
    canActionFromRole,
    leaveRtmChannel,
  };
};
