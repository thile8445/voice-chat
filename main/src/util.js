import { ROLES } from "./constants";

// role can action
export const ROLE_CAN_ACTION_MUTE_ALL = [ROLES.HOST, ROLES.CO_HOST];

export const ROLE_CAN_ACTION_ACCEPT_TO_SPEAK = [ROLES.HOST, ROLES.CO_HOST];

export const ROLE_HOST_CAN_UPDATE_ROLE_USER = [
  ROLES.CO_HOST,
  ROLES.LISTENER,
  ROLES.SPEAKER,
];

export const ROLE_CO_HOST_CAN_UPDATE_ROLE_USER = [
  ROLES.LISTENER,
  ROLES.SPEAKER,
];

// role status
export const ROLE_ENABLE_MUTE_ALL = [ROLES.LISTENER, ROLES.SPEAKER];

export const ROLE_MUTED_BY_CO_HOST = [ROLES.LISTENER, ROLES.SPEAKER];

export const ATTRIBUTES_VOICE_CHAT = [
  "username",
  "rtcUid",
  "avatar",
  "role",
  "micMuted",
  "status",
];
