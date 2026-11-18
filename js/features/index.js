/* The enabled features, in mount order. To add a feature, create a file in this folder that
   exports the feature object (see js/main.js for the interface) and add one line here.
   Order matters in two ways: services are provided before later features use them at tick
   time, and features that add buttons to the same slot appear in this order. */
import settingsFile from './settings-file.js';
import masjidFeed from './masjid-feed.js';
import prayerTimes from './prayer-times.js';
import pattern from './pattern.js';
import backgrounds from './backgrounds.js';
import sky from './sky.js';
import dates from './dates.js';
import clock from './clock.js';
import textSize from './text-size.js';
import countdown from './countdown.js';
import dayBar from './day-bar.js';
import prayerPanel from './prayer-panel.js';
import burnIn from './burn-in.js';
import slides from './slides.js';
import prePrayer from './pre-prayer.js';
import nightDim from './night-dim.js';
import adhanAudio from './adhan-audio.js';
import kiosk from './kiosk.js';
import updates from './updates.js';
import settings from './settings.js';

export default [
  settingsFile,
  masjidFeed,
  prayerTimes,
  pattern,
  backgrounds,
  sky,
  dates,
  clock,
  textSize,
  countdown,
  dayBar,
  prayerPanel,
  burnIn,
  slides,
  prePrayer,
  nightDim,
  adhanAudio,
  kiosk,
  updates,
  settings
];
