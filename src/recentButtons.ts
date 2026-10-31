import { ARENA2_ID, ARENA2_MODE, ARENA2_SECONDS, ARENA3_ID, ARENA3_MODE, ARENA3_SECONDS, ARENA_ID, ARENA_MODE, ARENA_SECONDS } from "./arenaReel";
import { BOUT2_ID, BOUT2_MODE, BOUT2_SECONDS, BOUT_ID, BOUT_MODE, BOUT_SECONDS } from "./boutReel";
import { DEV10_ID, DEV10_MODE, DEV10_SECONDS, DEV11_ID, DEV11_MODE, DEV11_SECONDS, DEV12_ID, DEV12_MODE, DEV12_SECONDS, DEV13_ID, DEV13_MODE, DEV13_SECONDS, DEV14_ID, DEV14_MODE, DEV14_SECONDS, DEV15_ID, DEV15_MODE, DEV15_SECONDS, DEV8_ID, DEV8_MODE, DEV8_SECONDS, DEV9_ID, DEV9_MODE, DEV9_SECONDS } from "./devReel";
import { KARSI_ID, KARSI_MODE, KARSI_SECONDS, KARSI0_ID, KARSI0_MODE, KARSI0_SECONDS, KARSI2_ID, KARSI2_MODE, KARSI2_SECONDS, KARSI3_ID, KARSI3_MODE, KARSI3_SECONDS, YEDI_ID, YEDI_MODE, YEDI_SECONDS } from "./karsiReel";
import { KAYIT_ID, KAYIT_MODE, KAYIT_SECONDS } from "./kayitReel";
import { HERO_ID, HERO_MODE, HERO_SECONDS } from "./heroReel";
import { LOOP_ID, LOOP_MODE, LOOP_SECONDS } from "./loopReel";
import { KURTAR_ID, KURTAR_MODE, KURTAR_SECONDS } from "./kurtarReel";
import { GECME_ID, GECME_MODE, GECME_SECONDS } from "./gecmeReel";
import { KUYU_ID, KUYU_MODE, KUYU_SECONDS } from "./kuyuReel";
import { KAPI2_ID, KAPI2_MODE, KAPI2_SECONDS, KAPI3_ID, KAPI3_MODE, KAPI3_SECONDS, KAPI_ID, KAPI_MODE, KAPI_SECONDS } from "./kapiReel";
import { MAGDUR_ID, MAGDUR_MODE, MAGDUR_SECONDS } from "./magdurReel";
import { KARE_ID, KARE_MODE, KARE_SECONDS } from "./kareReel";
import { DEVKONG_ID, DEVKONG_MODE, DEVKONG_SECONDS } from "./devKongReel";
import { SAVAS_ID, SAVAS_MODE, SAVAS_SECONDS } from "./savasReel";
import { KIRMIZI_ID, KIRMIZI_MODE, KIRMIZI_SECONDS } from "./kirmiziReel";
import { BASKA_ID, BASKA_MODE, BASKA_SECONDS } from "./baskaReel";
import { ARAGORN_ID, ARAGORN_MODE, ARAGORN_SECONDS } from "./aragornTestReel";
import { DOVUS_ID, DOVUS_MODE, DOVUS_SECONDS } from "./dovusReel";
import { KUYULAR_ID, KUYULAR_MODE, KUYULAR_SECONDS } from "./kuyularReel";
import { TEK_ID, TEK_MODE, TEK_SECONDS } from "./tekReel";
import { TEK2_ID, TEK2_MODE, TEK2_SECONDS } from "./tek2Reel";
import { TEK3_ID, TEK3_MODE, TEK3_SECONDS } from "./tek3Reel";
import { KALE_ID, KALE_MODE, KALE_SECONDS } from "./kaleReel";
import { DRAGON_ID, DRAGON_MODE, DRAGON_SECONDS } from "./dragonReel";
import { ELF_ID, ELF_MODE, ELF_SECONDS } from "./elfReel";
export const RECENT_BUTTON_LIMIT = 20;

/** Yeniden eskiye. Bir buton güncellenirse en üste alınır, en alttaki 20'nin dışına düşer. */
export const RECENT_BUTTONS = [
  { id: KALE_ID, label: `${KALE_MODE.label} — ${KALE_SECONDS}s`, seconds: KALE_SECONDS },
  { id: TEK3_ID, label: `${TEK3_MODE.label} — ${TEK3_SECONDS}s`, seconds: TEK3_SECONDS },
  { id: TEK2_ID, label: `${TEK2_MODE.label} — ${TEK2_SECONDS}s`, seconds: TEK2_SECONDS },
  { id: TEK_ID, label: `${TEK_MODE.label} — ${TEK_SECONDS}s`, seconds: TEK_SECONDS },
  { id: KUYULAR_ID, label: `${KUYULAR_MODE.label} — ${KUYULAR_SECONDS}s`, seconds: KUYULAR_SECONDS },
  { id: DOVUS_ID, label: `${DOVUS_MODE.label} — ${DOVUS_SECONDS}s`, seconds: DOVUS_SECONDS },
  { id: ARAGORN_ID, label: `${ARAGORN_MODE.label} — ${ARAGORN_SECONDS}s`, seconds: ARAGORN_SECONDS },
  { id: BASKA_ID, label: `${BASKA_MODE.label} — ${BASKA_SECONDS}s`, seconds: BASKA_SECONDS },
  { id: KIRMIZI_ID, label: `${KIRMIZI_MODE.label} — ${KIRMIZI_SECONDS}s`, seconds: KIRMIZI_SECONDS },
  { id: DEV15_ID, label: `${DEV15_MODE.label} — ${DEV15_SECONDS}s`, seconds: DEV15_SECONDS },
  { id: SAVAS_ID, label: `${SAVAS_MODE.label} — ${SAVAS_SECONDS}s`, seconds: SAVAS_SECONDS },
  { id: DEVKONG_ID, label: `${DEVKONG_MODE.label} — ${DEVKONG_SECONDS}s`, seconds: DEVKONG_SECONDS },
  { id: KARE_ID, label: `${KARE_MODE.label} — ${KARE_SECONDS}s`, seconds: KARE_SECONDS },
  { id: MAGDUR_ID, label: `${MAGDUR_MODE.label} — ${MAGDUR_SECONDS}s`, seconds: MAGDUR_SECONDS },
  { id: KAPI3_ID, label: `${KAPI3_MODE.label} — ${KAPI3_SECONDS}s`, seconds: KAPI3_SECONDS },
  { id: KAPI2_ID, label: `${KAPI2_MODE.label} — ${KAPI2_SECONDS}s`, seconds: KAPI2_SECONDS },
  { id: KAPI_ID, label: `${KAPI_MODE.label} — ${KAPI_SECONDS}s`, seconds: KAPI_SECONDS },
  { id: KUYU_ID, label: `${KUYU_MODE.label} — ${KUYU_SECONDS}s`, seconds: KUYU_SECONDS },
  { id: GECME_ID, label: `${GECME_MODE.label} — ${GECME_SECONDS}s`, seconds: GECME_SECONDS },
  { id: KURTAR_ID, label: `${KURTAR_MODE.label} — ${KURTAR_SECONDS}s`, seconds: KURTAR_SECONDS },
  { id: LOOP_ID, label: `${LOOP_MODE.label} — ${LOOP_SECONDS}s`, seconds: LOOP_SECONDS },
  { id: YEDI_ID, label: `${YEDI_MODE.label} — ${YEDI_SECONDS}s`, seconds: YEDI_SECONDS },
  { id: KARSI3_ID, label: `${KARSI3_MODE.label} — ${KARSI3_SECONDS}s`, seconds: KARSI3_SECONDS },
  { id: ELF_ID, label: `${ELF_MODE.label} — ${ELF_SECONDS}s`, seconds: ELF_SECONDS },
  { id: KARSI2_ID, label: `${KARSI2_MODE.label} — ${KARSI2_SECONDS}s`, seconds: KARSI2_SECONDS },
  { id: KARSI0_ID, label: `${KARSI0_MODE.label} — ${KARSI0_SECONDS}s`, seconds: KARSI0_SECONDS },
  { id: KARSI_ID, label: `${KARSI_MODE.label} — ${KARSI_SECONDS}s`, seconds: KARSI_SECONDS },
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
] as const;
