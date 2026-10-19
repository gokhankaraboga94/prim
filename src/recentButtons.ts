import { ARENA_ID, ARENA_MODE, ARENA_SECONDS } from "./arenaReel";
import { BOUT_ID, BOUT_MODE, BOUT_SECONDS } from "./boutReel";
import { DEV10_ID, DEV10_MODE, DEV10_SECONDS, DEV4_ID, DEV4_MODE, DEV4_SECONDS, DEV5_ID, DEV5_MODE, DEV5_SECONDS, DEV6_ID, DEV6_MODE, DEV6_SECONDS, DEV7_ID, DEV7_MODE, DEV7_SECONDS, DEV8_ID, DEV8_MODE, DEV8_SECONDS, DEV9_ID, DEV9_MODE, DEV9_SECONDS, DEVS_ID, DEVS_MODE, DEVS_SECONDS, SNAKE_ID, SNAKE_MODE, SNAKE_SECONDS } from "./devReel";
import { HERO_ID, HERO_MODE, HERO_SECONDS } from "./heroReel";
import { DRAGON_ID, DRAGON_MODE, DRAGON_SECONDS } from "./dragonReel";
import { KALKAN_ID, KALKAN_MODE, KALKAN_SECONDS } from "./kalkanReel";
import { OK_ID, OK_MODE, OK_SECONDS } from "./okReel";
import { ORDU_ID, ORDU_MODE, ORDU_SECONDS } from "./orduReel";
import { WARS_ID, WARS_MODE, WARS_SECONDS } from "./warsReel";
import { DEFEND5_ID, DEFEND5_MODE, DEFEND5_SECONDS } from "./defendReel";
import { LAB_ID, LAB_MODE, LAB_SECONDS } from "./mazeReel";
import { FILM_ID, FILM_MODE, FILM_SECONDS } from "./filmReel";

export const RECENT_BUTTON_LIMIT = 20;

/** Yeniden eskiye. Bir buton güncellenirse en üste alınır, en alttaki 20'nin dışına düşer. */
export const RECENT_BUTTONS = [
  { id: BOUT_ID, label: `${BOUT_MODE.label} — ${BOUT_SECONDS}s`, seconds: BOUT_SECONDS },
  { id: ARENA_ID, label: `${ARENA_MODE.label} — ${ARENA_SECONDS}s`, seconds: ARENA_SECONDS },
  { id: DEV10_ID, label: `${DEV10_MODE.label} — ${DEV10_SECONDS}s`, seconds: DEV10_SECONDS },
  { id: DEV9_ID, label: `${DEV9_MODE.label} — ${DEV9_SECONDS}s`, seconds: DEV9_SECONDS },
  { id: HERO_ID, label: `${HERO_MODE.label} — ${HERO_SECONDS}s`, seconds: HERO_SECONDS },
  { id: DRAGON_ID, label: `${DRAGON_MODE.label} — ${DRAGON_SECONDS}s`, seconds: DRAGON_SECONDS },
  { id: DEV8_ID, label: `${DEV8_MODE.label} — ${DEV8_SECONDS}s`, seconds: DEV8_SECONDS },
  { id: KALKAN_ID, label: `${KALKAN_MODE.label} — ${KALKAN_SECONDS}s`, seconds: KALKAN_SECONDS },
  { id: OK_ID, label: `${OK_MODE.label} — ${OK_SECONDS}s`, seconds: OK_SECONDS },
  { id: ORDU_ID, label: `${ORDU_MODE.label} — ${ORDU_SECONDS}s`, seconds: ORDU_SECONDS },
  { id: WARS_ID, label: `${WARS_MODE.label} — ${WARS_SECONDS}s`, seconds: WARS_SECONDS },
  { id: DEV7_ID, label: `${DEV7_MODE.label} — ${DEV7_SECONDS}s`, seconds: DEV7_SECONDS },
  { id: DEV6_ID, label: `${DEV6_MODE.label} — ${DEV6_SECONDS}s`, seconds: DEV6_SECONDS },
  { id: DEFEND5_ID, label: `${DEFEND5_MODE.label} — ${DEFEND5_SECONDS}s`, seconds: DEFEND5_SECONDS },
  { id: DEVS_ID, label: `${DEVS_MODE.label} — ${DEVS_SECONDS}s`, seconds: DEVS_SECONDS },
  { id: SNAKE_ID, label: `${SNAKE_MODE.label} — ${SNAKE_SECONDS}s`, seconds: SNAKE_SECONDS },
  { id: LAB_ID, label: `${LAB_MODE.label} — ${LAB_SECONDS}s`, seconds: LAB_SECONDS },
  { id: DEV5_ID, label: `${DEV5_MODE.label} — ${DEV5_SECONDS}s`, seconds: DEV5_SECONDS },
  { id: DEV4_ID, label: `${DEV4_MODE.label} — ${DEV4_SECONDS}s`, seconds: DEV4_SECONDS },
  { id: FILM_ID, label: `${FILM_MODE.label} — ${FILM_SECONDS}s`, seconds: FILM_SECONDS },
] as const;
