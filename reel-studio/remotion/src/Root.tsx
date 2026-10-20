import {Composition} from 'remotion';
import {Reel} from './Reel';
import type {EditSpec} from './types';

const empty: EditSpec = {
  fps: 30,
  clips: [],
  words: [],
  brand: {accent: '#FFD60A', dark: '#0B0F14', handle: ''},
  captions: {y: 0.615, maxWords: 3, maxChars: 18},
  overlays: [],
};

export const RemotionRoot = () => (
  <Composition
    id="Reel"
    component={Reel}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30}
    defaultProps={empty}
    calculateMetadata={({props}) => ({
      fps: props.fps,
      durationInFrames: Math.max(1, Math.round(props.clips.reduce((d, c) => d + c.to - c.from, 0) * props.fps)),
    })}
  />
);
