# Reminder content

The clock's full-screen slides cycle through these files. Each is a plain JSON list, so items
can be added, removed or corrected without touching the code. `npm test` checks every file.

**Please have the English meanings reviewed by someone qualified (your imam or a teacher)
before the clock goes up.** The Arabic was checked word for word against the sources below;
the English for hadith and duas was written for this project as a plain meaning, not taken
from a published translation.

| File | What | Arabic text | English |
|---|---|---|---|
| `hadith.json` | 28 short hadith | Excerpted word for word from the hadith collections in [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) (the Prophet's words only, without the chain of narrators) | Plain meaning written for this project |
| `adhkar.json` | 11 duas and adhkar, tagged by when to show them | Same source and method as the hadith | Plain meaning written for this project |
| `quran.json` | 25 verses and short surahs | Tanzil "Quran Simple" text (tanzil.net), via [fawazahmed0/quran-api](https://github.com/fawazahmed0/quran-api), unchanged | Marmaduke Pickthall (1930), public domain, unchanged |
| `names.json` | 40 of the Names of Allah | Each name checked to appear in the verse given as its reference | Short meanings written for this project |

## Fields

- **hadith.json**: `ar`, `en`, `ref` (collection and number), `grade` (al-Albani's grading for
  collections outside Bukhari and Muslim), `tags` (`prayer` marks hadith about the prayer).
- **adhkar.json**: `ar`, `en`, `ref`, `grade`, `title`, `count` (how many times it is said),
  `when`: `after-adhan` (shown when the adhan ends), `after-prayer` (shown after the prayer),
  `morning` (Fajr to Dhuhr), `evening` (Asr to Isha), `both` (morning and evening).
- **quran.json**: `ar` and `en` are lists with one entry per verse, `first` is the first verse
  number, `ref`, `surah`, `tags` (`friday` items are shown on Fridays only).
- **names.json**: `ar`, `translit`, `en`, `ref`.

## Numbering

Bukhari, Tirmidhi and Abu Dawud follow the common sunnah.com numbering. Muslim follows the
standard Muhammad Fu'ad Abd al-Baqi numbering (for example Muslim 2564).

## Licenses

The Arabic of the Quran and the hadith is in the public domain. The Tanzil Quran text may be
used freely provided it is not changed and Tanzil is credited, which this file does. Pickthall's
translation (1930) is in the public domain.
