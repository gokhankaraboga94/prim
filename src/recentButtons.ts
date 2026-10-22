import { ARENA2_ID, ARENA2_MODE, ARENA2_SECONDS, ARENA3_ID, ARENA3_MODE, ARENA3_SECONDS, ARENA_ID, ARENA_MODE, ARENA_SECONDS } from "./arenaReel";
import { BOUT2_ID, BOUT2_MODE, BOUT2_SECONDS, BOUT_ID, BOUT_MODE, BOUT_SECONDS } from "./boutReel";
import { DEV10_ID, DEV10_MODE, DEV10_SECONDS, DEV11_ID, DEV11_MODE, DEV11_SECONDS, DEV12_ID, DEV12_MODE, DEV12_SECONDS, DEV13_ID, DEV13_MODE, DEV13_SECONDS, DEV14_ID, DEV14_MODE, DEV14_SECONDS, DEV15_ID, DEV15_MODE, DEV15_SECONDS, DEV8_ID, DEV8_MODE, DEV8_SECONDS, DEV9_ID, DEV9_MODE, DEV9_SECONDS } from "./devReel";
import { KAYIT_ID, KAYIT_MODE, KAYIT_SECONDS } from "./kayitReel";
import { HERO_ID, HERO_MODE, HERO_SECONDS } from "./heroReel";
import { DRAGON_ID, DRAGON_MODE, DRAGON_SECONDS } from "./dragonReel";
import { KALKAN_ID, KALKAN_MODE, KALKAN_SECONDS } from "./kalkanReel";
import { OK_ID, OK_MODE, OK_SECONDS } from "./okReel";
import { ORDU_ID, ORDU_MODE, ORDU_SECONDS } from "./orduReel";
import { WARS_ID, WARS_MODE, WARS_SECONDS } from "./warsReel";
export const RECENT_BUTTON_LIMIT = 20;

/** Yeniden eskiye. Bir buton güncellenirse en üste alınır, en alttaki 20'nin dışına düşer. */
export const RECENT_BUTTONS = [
  { id: DEV15_ID, label: `${DEV15_MODE.label} — ${DEV15_SECONDS}s`, seconds: DEV15_SECONDS },
  { id: DEV14_ID, label: `${DEV14_MODE.label} — ${DEV14_SECONDS}s`, seconds: DEV14_SECONDS },
  { id: DEV13_ID, label: `${DEV13_MODE.label} — ${DEV13_SECONDS}s`, seconds: DEV13_SECONDS },
  { id: DEV12_ID, label: `${DEV12_MODE.label} — ${DEV12_SECONDS}s`, seconds: DEV12_SECONDS },
  { id: ARENA3_ID, label: `${ARENA3_MODE.label} — ${ARENA3_SECONDS}s`, seconds: ARENA3_SECONDS },
  { id: ARENA2_ID, label: `${ARENA2_MODE.label} — ${ARENA2_SECONDS}s`, seconds: ARENA2_SECONDS },
  { id: KAYIT_ID, label: `${KAYIT_MODE.label} — ${KAYIT_SECONDS}s`, seconds: KAYIT_SECONDS },
  { id: BOUT2_ID, label: `${BOUT2_MODE.label} — ${BOUT2_SECONDS}s`, seconds: BOUT2_SECONDS },
  { id: DEV11_ID, label: `${DEV11_MODE.label} — ${DEV11_SECONDS}s`, seconds: DEV11_SECONDS },
  { id: ARENA_ID, label: `${ARENA_MODE.label} — ${ARENA_SECONDS}s`, seconds: ARENA_SECONDS },
  { id: BOUT_ID, label: `${BOUT_MODE.label} — ${BOUT_SECONDS}s`, seconds: BOUT_SECONDS },
  { id: DEV10_ID, label: `${DEV10_MODE.label} — ${DEV10_SECONDS}s`, seconds: DEV10_SECONDS },
  { id: DEV9_ID, label: `${DEV9_MODE.label} — ${DEV9_SECONDS}s`, seconds: DEV9_SECONDS },
  { id: HERO_ID, label: `${HERO_MODE.label} — ${HERO_SECONDS}s`, seconds: HERO_SECONDS },
  { id: DRAGON_ID, label: `${DRAGON_MODE.label} — ${DRAGON_SECONDS}s`, seconds: DRAGON_SECONDS },
  { id: DEV8_ID, label: `${DEV8_MODE.label} — ${DEV8_SECONDS}s`, seconds: DEV8_SECONDS },
  { id: KALKAN_ID, label: `${KALKAN_MODE.label} — ${KALKAN_SECONDS}s`, seconds: KALKAN_SECONDS },
  { id: OK_ID, label: `${OK_MODE.label} — ${OK_SECONDS}s`, seconds: OK_SECONDS },
  { id: ORDU_ID, label: `${ORDU_MODE.label} — ${ORDU_SECONDS}s`, seconds: ORDU_SECONDS },
  { id: WARS_ID, label: `${WARS_MODE.label} — ${WARS_SECONDS}s`, seconds: WARS_SECONDS },
] as const;
