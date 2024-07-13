import AgoraRTM from "agora-rtm-sdk";
import { useRef } from "react";

export const useAgoraRTM = ({
  appId,
  token,
  setMembers,
  handleMessage = () => {},
}) => {
  const rtmClient = useRef(null);
  const channelClient = useRef(null);

  const getInfoMembers = async () => {
    const listChannelMember = await channelClient.current.getMembers();
    const listMember = [];

    for (let i = 0; listChannelMember.length > i; i++) {
      const item = await rtmClient.current.getUserAttributesByKeys(
        listChannelMember[i],
        ["username", "rtcUid", "avatar"]
      );
      listMember.push({
        ...item,
        id: listChannelMember[i],
      });
    }
    return listMember;
  };

  const handleMemberJoined = async () => {
    const listMember = await getInfoMembers();
    setMembers(listMember);
  };

  const handleMemberLeft = async (memberId) => {
    const listMember = await getInfoMembers();
    setMembers(listMember?.filter((item) => item?.id !== memberId));
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

  return {
    initRtm,
    rtmClient: rtmClient.current,
    channelClient: channelClient.current,
    addOrUpdateAttributes,
    getAttributes,
    getChanelMembers,
    leaveRtmChannel,
  };
};
