import parentAvif1200 from './parent-and-child-1200.avif';
import parentJpg1200 from './parent-and-child-1200.jpg';
import parentWebp1200 from './parent-and-child-1200.webp';
import parentAvif600 from './parent-and-child-600.avif';
import parentJpg600 from './parent-and-child-600.jpg';
import parentWebp600 from './parent-and-child-600.webp';
import parentAvif900 from './parent-and-child-900.avif';
import parentJpg900 from './parent-and-child-900.jpg';
import parentWebp900 from './parent-and-child-900.webp';
import trialAvif1200 from './trial-class-1200.avif';
import trialJpg1200 from './trial-class-1200.jpg';
import trialWebp1200 from './trial-class-1200.webp';
import trialAvif1600 from './trial-class-1600.avif';
import trialJpg1600 from './trial-class-1600.jpg';
import trialWebp1600 from './trial-class-1600.webp';
import trialAvif800 from './trial-class-800.avif';
import trialJpg800 from './trial-class-800.jpg';
import trialWebp800 from './trial-class-800.webp';

/** One photo in three formats and widths; credits live in the README (Pexels License). */
export interface PhotoAsset {
  alt: string;
  width: number;
  height: number;
  avif: string;
  webp: string;
  jpg: string;
  /** The largest JPEG, used as the <img> src for browsers without srcset support. */
  fallback: string;
}

const srcset = (entries: [url: string, width: number][]) =>
  entries.map(([url, width]) => `${url} ${String(width)}w`).join(', ');

/** Asset #1 (doc 07 §10): a child in a live class at home, mentor on screen. 4:3. */
export const trialClassPhoto: PhotoAsset = {
  alt: 'A child at a desk at home taking a live class, with the mentor smiling on the laptop screen',
  width: 1600,
  height: 1200,
  avif: srcset([
    [trialAvif800, 800],
    [trialAvif1200, 1200],
    [trialAvif1600, 1600],
  ]),
  webp: srcset([
    [trialWebp800, 800],
    [trialWebp1200, 1200],
    [trialWebp1600, 1600],
  ]),
  jpg: srcset([
    [trialJpg800, 800],
    [trialJpg1200, 1200],
    [trialJpg1600, 1600],
  ]),
  fallback: trialJpg1600,
};

/** Asset #2 (doc 07 §10): a parent and child looking at a laptop together. 4:5. */
export const parentAndChildPhoto: PhotoAsset = {
  alt: 'A father and his young son looking at a laptop together at home',
  width: 1200,
  height: 1500,
  avif: srcset([
    [parentAvif600, 600],
    [parentAvif900, 900],
    [parentAvif1200, 1200],
  ]),
  webp: srcset([
    [parentWebp600, 600],
    [parentWebp900, 900],
    [parentWebp1200, 1200],
  ]),
  jpg: srcset([
    [parentJpg600, 600],
    [parentJpg900, 900],
    [parentJpg1200, 1200],
  ]),
  fallback: parentJpg1200,
};
