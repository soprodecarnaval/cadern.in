import MidiPlayer from "midi-player-js";
import Soundfont from "soundfont-player";
import type { Instrument } from "../../types/instrument";

let player: MidiPlayer.Player | null = null;
const AudioContext = window.AudioContext || window.webkitAudioContext || false;
const ac = new AudioContext() || new window.webkitAudioContext();

const getFileFromUrl = async (url: string, name: string) => {
  const response = await fetch(url);
  const data = await response.blob();
  return new File([data], name, {
    type: data.type,
  });
};

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const t = [h, m > 9 ? m : h ? `0${m}` : m || "0", s > 9 ? s : `0${s}`]
    .filter(Boolean)
    .join(":");
  return t;
};

type InstrumentPlayers = {
  [K in Instrument]?: Soundfont.Player;
};
let instrumentPlayers: InstrumentPlayers | null = null;

const initializeSfInstruments = async () => {
  instrumentPlayers = {};
  const loadInstrument = async (
    key: Instrument,
    sfKey: Soundfont.InstrumentName,
  ) => {
    if (!instrumentPlayers) {
      return;
    }
    instrumentPlayers[key] = await Soundfont.instrument(ac, sfKey);
  };

  await Promise.all([
    loadInstrument("sax tenor", "tenor_sax"),
    loadInstrument("sax alto", "alto_sax"),
    loadInstrument("sax soprano", "soprano_sax"),
    loadInstrument("flauta", "flute"),
    loadInstrument("trombone", "trombone"),
    loadInstrument("trompete", "trumpet"),
    loadInstrument("tuba", "tuba"),
  ]);
};

const playMidiPart = async (midiUrl: string, instrument: Instrument) => {
  if (!instrumentPlayers) {
    await initializeSfInstruments();
  }
  if (player) {
    player.stop();
  }

  const file = await getFileFromUrl(midiUrl, instrument);

  const reader = new FileReader();
  if (file) {
    reader.readAsArrayBuffer(file);
  }

  reader.addEventListener(
    "load",
    () => {
      player = new MidiPlayer.Player(function (event: MidiPlayer.Event) {
        if (!instrumentPlayers || !instrumentPlayers[instrument]) {
          console.warn("Instrument SoundFont not available:", instrument);
          return;
        }
        if (event.name == "Note on" && event.noteName) {
          instrumentPlayers[instrument]?.play(event.noteName, ac.currentTime, {
            gain: (event.velocity ?? 0) / 100,
          });
        }

        const songTimeElement = document.getElementById(`song-time`);
        if (songTimeElement && player) {
          songTimeElement.innerHTML = formatTime(
            player.getSongTime() - player.getSongTimeRemaining(),
          );
        }
        document
          .getElementsByClassName("btn-close")[0]
          .addEventListener("click", () => {
            if (player) {
              player.stop();
              const playBarContainer =
                document.getElementById(`play-bar-container`);
              if (playBarContainer) {
                playBarContainer.style.visibility = "hidden";
              }
            }
          });
      });

      player.on("playing", (_currentTick: number) => {
        const playTrackSlider =
          document.querySelector<HTMLInputElement>("play-track");
        if (playTrackSlider && player) {
          // playTrackSlider is a RangeSlider
          playTrackSlider.value = `${100 - player.getSongPercentRemaining()}`;
        }
      });

      const playBarContainer = document.getElementById(`play-bar-container`);
      if (playBarContainer) {
        playBarContainer.style.visibility = "visible";
      }

      if (player) {
        const playTrackSlider =
          document.querySelector<HTMLInputElement>("play-track");
        if (playTrackSlider && player) {
          playTrackSlider.max = `${player.getSongTime()}`;
        }
        if (reader.result && reader.result instanceof ArrayBuffer) {
          player.loadArrayBuffer(reader.result);
        }
        player.play();
      }
    },
    false,
  );
};

const removeToastPlayer = () => {
  if (player) {
    player.stop();
  }
  const el = document.getElementById(`play-bar-container`);
  if (el) {
    el.style.visibility = "hidden";
  }
};

export { player as midiPlayer, playMidiPart, removeToastPlayer };
