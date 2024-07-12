import AgoraRTC from "agora-rtc-sdk-ng";
import { useRef, useState } from "react";

export const useAgoraRTC = ({ appId, token }) => {
  const [micMuted, setMicMuted] = useState(true);
  const rtcClient = useRef(null);
  const audioTracks = useRef({
    localAudioTrack: null,
    remoteAudioTracks: {},
  });

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

  const initRtc = async (roomId, rtcUid) => {
    rtcClient.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    rtcClient.current.on("user-published", handleUserPublished);
    rtcClient.current.on("user-left", handleUserLeft);
    await rtcClient.current.join(appId, roomId, token, rtcUid);

    audioTracks.current.localAudioTrack =
      await AgoraRTC.createMicrophoneAudioTrack();
    audioTracks.current.localAudioTrack.setMuted(micMuted);
    await rtcClient.current.publish(audioTracks.current.localAudioTrack);

    initVolumeIndicator();
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

  const toggleMic = async (isMuted = micMuted) => {
    if (isMuted) {
      setMicMuted(false);
      audioTracks.current.localAudioTrack.setMuted(false);
    } else {
      setMicMuted(true);
      audioTracks.current.localAudioTrack.setMuted(true);
    }
  };

  let leaveRoom = async () => {
    audioTracks.current.localAudioTrack?.stop();
    audioTracks.current.localAudioTrack?.close();
    rtcClient.current?.unpublish();
    rtcClient.current?.leave();
  };

  return {
    rtcClient: rtcClient.current,
    audioTracks: audioTracks.current,
    initRtc,
    micMuted,
    setMicMuted,
    initVolumeIndicator,
    leaveRoom,
    toggleMic,
  };
};
