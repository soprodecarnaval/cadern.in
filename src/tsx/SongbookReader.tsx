import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Button,
  Form,
  InputGroup,
  Modal,
  Offcanvas,
  Spinner,
} from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import {
  BsAspectRatio,
  BsChevronDown,
  BsChevronLeft,
  BsChevronRight,
  BsDownload,
  BsSearch,
  BsX,
} from "react-icons/bs";
import { zInstrument, type Instrument } from "../../types/instrument";
import type {
  NumberedSongbookItemViewModel,
  PartViewModel,
} from "../../types/viewModels";
import {
  REMOVED_SCORES_NOTE,
  getScoreRevision,
  isSongbookSection,
} from "../lib/songbook";
import "../css/SongbookReader.css";

interface Song {
  // Position among the songbook's openable scores, for prev/next.
  pos: number;
  number: number;
  title: string;
  composer: string;
  section: number;
  parts: PartViewModel[];
}

type Entry =
  | { kind: "song"; song: Song }
  | { kind: "deleted"; number: number; title: string };

interface Group {
  // Scores listed before the first section have no title.
  title: string | null;
  entries: Entry[];
}

function buildBook(items: NumberedSongbookItemViewModel[]) {
  const groups: Group[] = [];
  const songs: Song[] = [];
  const current = () => {
    if (groups.length === 0) {
      groups.push({ title: null, entries: [] });
    }
    return groups[groups.length - 1];
  };
  for (const item of items) {
    if (isSongbookSection(item)) {
      groups.push({ title: item.title, entries: [] });
      continue;
    }
    if (item.deleted) {
      current().entries.push({
        kind: "deleted",
        number: item.index,
        title: item.score.title,
      });
      continue;
    }
    const group = current();
    const song: Song = {
      pos: songs.length,
      number: item.index,
      title: item.score.title,
      composer: item.score.composer,
      section: groups.length - 1,
      parts: getScoreRevision(item).parts,
    };
    songs.push(song);
    group.entries.push({ kind: "song", song });
  }
  return { groups, songs };
}

const INSTRUMENT_KEY = "cadernin:instrumento";
const SONG_PARAM = "musica";
const BAR_HIDE_MS = 3500;
const SWIPE_MIN_PX = 50;
const MAX_ZOOM = 4;

// The primary pointer is a finger: phones and tablets, not laptops with a
// touchscreen.
const TOUCH_QUERY = "(pointer: coarse)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const instrumentLabel = (i: string) => i.charAt(0).toUpperCase() + i.slice(1);

function readStoredInstrument(): string | null {
  try {
    return localStorage.getItem(INSTRUMENT_KEY);
  } catch {
    return null;
  }
}

function storeInstrument(instrument: string) {
  try {
    localStorage.setItem(INSTRUMENT_KEY, instrument);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

/**
 * The public way to read a songbook: an index with collapsible sections is the
 * landing view; opening a song shows its score for the chosen instrument,
 * always in landscape. Swipe turns the page, a tap toggles the top bar, pinch
 * zooms. Phones show the score full screen and search through a drawer over
 * it; wide screens open the score in a landscape modal over the index.
 */
export function SongbookReader({
  title,
  badges,
  items,
  actions,
  onDownloadPdf,
}: {
  title: string;
  badges?: ReactNode;
  items: NumberedSongbookItemViewModel[];
  // Shown under the index header, e.g. a link to the songbook's details.
  actions?: ReactNode;
  // Builds and downloads the songbook's PDF for one instrument.
  onDownloadPdf?: (instrument: Instrument) => Promise<void>;
}) {
  const { groups, songs } = useMemo(() => buildBook(items), [items]);
  const instruments = useMemo(
    () =>
      zInstrument.options.filter((i) =>
        songs.some((s) => s.parts.some((p) => p.instrument === i)),
      ),
    [songs],
  );

  const [params, setParams] = useSearchParams();
  const songParam = params.get(SONG_PARAM);
  const cur = songs.find((s) => String(s.number) === songParam) ?? null;

  const [instrument, setInstrumentState] = useState<Instrument | null>(() => {
    const stored = readStoredInstrument();
    return instruments.find((i) => i === stored) ?? instruments[0] ?? null;
  });
  const setInstrument = (i: Instrument) => {
    setInstrumentState(i);
    storeInstrument(i);
  };

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [lastOpened, setLastOpened] = useState<number | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [fit, setFit] = useState<"w" | "h">("w");
  const [bar, setBar] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // The score's scroll area mounts in the page on phones and in a modal on
  // wide screens, so gestures attach through a callback ref.
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [paperEl, setPaperEl] = useState<HTMLDivElement | null>(null);
  const attachPaper = useCallback((el: HTMLDivElement | null) => {
    paperRef.current = el;
    // A freshly mounted score starts unzoomed.
    zoomRef.current = 1;
    setPaperEl(el);
  }, []);
  const drawerInputRef = useRef<HTMLInputElement>(null);
  const drawerListRef = useRef<HTMLDivElement>(null);
  const indexListRef = useRef<HTMLElement>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Desktop only: tablets get the phone layout (full-screen score, no modal)
  // whatever their size.
  const touch = useMediaQuery(TOUCH_QUERY);
  const wide = !touch && size.w >= 900 && size.w > size.h;
  // On phones and tablets the open score takes the whole screen.
  const immersive = !wide && cur !== null;
  const rotated = immersive && size.h > size.w;

  // The reader fills the viewport below the app's navbar.
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    if (!immersive && rootRef.current) {
      setTop(rootRef.current.getBoundingClientRect().top + window.scrollY);
    }
  }, [immersive]);

  const openSong = useCallback(
    (song: Song, replace = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(SONG_PARAM, String(song.number));
          return next;
        },
        { replace },
      );
      setDrawer(false);
    },
    [setParams],
  );

  const closeSong = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SONG_PARAM);
        return next;
      },
      { replace: true },
    );

  const go = useCallback(
    (delta: number) => {
      if (!cur) {
        return;
      }
      const next = songs[cur.pos + delta];
      if (next) {
        openSong(next, true);
      }
    },
    [cur, songs, openSong],
  );

  // Top bar: hides itself on phones a moment after it's shown.
  const hideTimer = useRef<number>();
  const wideRef = useRef(wide);
  wideRef.current = wide;
  const hideSoon = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    if (!wideRef.current) {
      hideTimer.current = window.setTimeout(() => setBar(false), BAR_HIDE_MS);
    }
  }, []);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  // Zoom is applied straight to the DOM so pinch can keep its focal point in
  // place within the same frame.
  const zoomRef = useRef(1);
  const setZoom = useCallback((z: number, focus?: [number, number]) => {
    const paper = paperRef.current;
    if (!paper) {
      return;
    }
    const scale = z / zoomRef.current;
    const left = paper.scrollLeft;
    const top = paper.scrollTop;
    zoomRef.current = z;
    paper.style.setProperty("--reader-zoom", String(z));
    if (focus) {
      paper.scrollLeft = (left + focus[0]) * scale - focus[0];
      paper.scrollTop = (top + focus[1]) * scale - focus[1];
    }
  }, []);

  const curNumber = cur?.number ?? null;
  const curSection = cur?.section ?? null;
  useEffect(() => {
    if (curNumber === null) {
      return;
    }
    setLastOpened(curNumber);
    setCollapsed((prev) => {
      if (curSection === null || !prev.has(curSection)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(curSection);
      return next;
    });
    setZoom(1);
    if (paperRef.current) {
      paperRef.current.scrollTop = 0;
      paperRef.current.scrollLeft = 0;
    }
    setBar(true);
    hideSoon();
  }, [curNumber, curSection, setZoom, hideSoon]);

  // Back on the index, keep the last opened song in view.
  useEffect(() => {
    if (curNumber === null) {
      scrollToCurrent(indexListRef.current);
    }
  }, [curNumber]);

  // Gestures. Handlers read the latest values through a ref so the listeners
  // stay attached for as long as the score is open.
  const lastSwipe = useRef(0);
  const live = useRef({ go, rotated, setZoom });
  live.current = { go, rotated, setZoom };
  const hasCur = cur !== null;
  useEffect(() => {
    const paper = paperEl;
    if (!paper) {
      return;
    }
    let sx: number | null = null;
    let sy = 0;
    let pinch: { d: number; z: number } | null = null;

    const local = (cx: number, cy: number): [number, number] => {
      const r = paper.getBoundingClientRect();
      return live.current.rotated
        ? [cy - r.top, r.right - cx]
        : [cx - r.left, cy - r.top];
    };
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) =>
      local(
        (t[0].clientX + t[1].clientX) / 2,
        (t[0].clientY + t[1].clientY) / 2,
      );
    const clampZoom = (z: number) => Math.max(1, Math.min(MAX_ZOOM, z));

    const start = (x: number, y: number) => {
      sx = x;
      sy = y;
    };
    const end = (x: number, y: number) => {
      if (sx === null) {
        return;
      }
      let dx = x - sx;
      let dy = y - sy;
      sx = null;
      if (zoomRef.current > 1.05) {
        return;
      }
      if (live.current.rotated) {
        [dx, dy] = [dy, -dx];
      }
      if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        lastSwipe.current = Date.now();
        live.current.go(dx < 0 ? 1 : -1);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        sx = null;
        pinch = { d: dist(e.touches), z: zoomRef.current };
      } else if (e.touches.length === 1 && !pinch) {
        start(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) {
        return;
      }
      e.preventDefault();
      live.current.setZoom(
        clampZoom((pinch.z * dist(e.touches)) / pinch.d),
        mid(e.touches),
      );
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (pinch) {
        lastSwipe.current = Date.now();
        if (e.touches.length === 0) {
          pinch = null;
        }
        return;
      }
      const t = e.changedTouches[0];
      end(t.clientX, t.clientY);
    };
    const onTouchCancel = () => {
      pinch = null;
      sx = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) {
        return;
      }
      e.preventDefault();
      live.current.setZoom(
        clampZoom(zoomRef.current * Math.exp(-e.deltaY * 0.01)),
        local(e.clientX, e.clientY),
      );
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        start(e.clientX, e.clientY);
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        end(e.clientX, e.clientY);
      }
    };
    const onGestureStart = (e: Event) => e.preventDefault();

    paper.addEventListener("touchstart", onTouchStart, { passive: true });
    paper.addEventListener("touchmove", onTouchMove, { passive: false });
    paper.addEventListener("touchend", onTouchEnd, { passive: true });
    paper.addEventListener("touchcancel", onTouchCancel);
    paper.addEventListener("wheel", onWheel, { passive: false });
    paper.addEventListener("mousedown", onMouseDown);
    paper.addEventListener("mouseup", onMouseUp);
    paper.addEventListener("gesturestart", onGestureStart);
    return () => {
      paper.removeEventListener("touchstart", onTouchStart);
      paper.removeEventListener("touchmove", onTouchMove);
      paper.removeEventListener("touchend", onTouchEnd);
      paper.removeEventListener("touchcancel", onTouchCancel);
      paper.removeEventListener("wheel", onWheel);
      paper.removeEventListener("mousedown", onMouseDown);
      paper.removeEventListener("mouseup", onMouseUp);
      paper.removeEventListener("gesturestart", onGestureStart);
    };
  }, [paperEl]);

  // Arrow keys turn the page.
  useEffect(() => {
    if (!hasCur) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (drawer || target.closest("input, select, textarea")) {
        return;
      }
      if (e.key === "ArrowRight") {
        go(1);
      } else if (e.key === "ArrowLeft") {
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasCur, drawer, go]);

  const handlePaperClick = () => {
    if (wide || Date.now() - lastSwipe.current < 400) {
      return;
    }
    const show = !bar;
    setBar(show);
    if (show) {
      hideSoon();
    } else {
      window.clearTimeout(hideTimer.current);
    }
  };

  const openDrawer = () => {
    window.clearTimeout(hideTimer.current);
    setDrawer(true);
  };
  const closeDrawer = () => {
    setDrawer(false);
    hideSoon();
  };

  const toggleSection = (i: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });

  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const downloadPdf = async () => {
    if (!onDownloadPdf || !instrument) {
      return;
    }
    setPdfBusy(true);
    setPdfError("");
    try {
      await onDownloadPdf(instrument);
    } catch {
      setPdfError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setPdfBusy(false);
    }
  };
  const pdfButton = onDownloadPdf && instrument && (
    <Button
      size="sm"
      variant="outline-primary"
      className="reader-pdf"
      disabled={pdfBusy}
      onClick={() => void downloadPdf()}
      aria-label={`Baixar PDF de ${instrumentLabel(instrument)}`}
    >
      {pdfBusy ? (
        <>
          <Spinner animation="border" size="sm" aria-hidden /> Gerando…
        </>
      ) : (
        <>
          <BsDownload aria-hidden /> PDF
        </>
      )}
    </Button>
  );

  const index = (
    inputRef?: RefObject<HTMLInputElement>,
    onClose?: () => void,
  ) => (
    <SongIndex
      title={title}
      badges={badges}
      groups={groups}
      songs={songs}
      highlighted={cur?.number ?? lastOpened}
      query={query}
      onQuery={setQuery}
      instrument={instrument}
      instruments={instruments}
      onInstrument={setInstrument}
      collapsed={collapsed}
      onToggleSection={toggleSection}
      onOpen={(song) => openSong(song)}
      onClose={onClose}
      actions={onClose ? undefined : actions}
      pdf={onClose ? undefined : pdfButton}
      pdfError={onClose ? undefined : pdfError}
      inputRef={inputRef}
    />
  );

  const barShown = wide || bar;
  const showIndex = wide || cur === null;
  // Keeps the modal's content while it fades out after closing.
  const modalSong =
    cur ?? songs.find((s) => s.number === lastOpened) ?? null;

  const sheet = (song: Song) => {
    const part = instrument
      ? song.parts.find((p) => p.instrument === instrument)
      : undefined;
    if (!part) {
      return (
        <p className="reader-missing">
          {instrument
            ? `Esta música não tem parte de ${instrumentLabel(instrument)}.`
            : "Esta música não tem partes."}
        </p>
      );
    }
    return (
      <div className={`reader-sheet fit-${fit}`}>
        {part.svg.map((url, i) => (
          <img
            key={url}
            src={url}
            alt={
              i === 0
                ? `Partitura de ${song.title}, ${part.name}`
                : `${song.title}, página ${i + 1}`
            }
            draggable={false}
          />
        ))}
      </div>
    );
  };

  const songTitle = (song: Song, id?: string) => (
    <div className="reader-bar-title">
      <b id={id}>
        {song.number} · {song.title}
      </b>
      <span>
        {[
          groups[song.section]?.title,
          instrument && instrumentLabel(instrument),
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </div>
  );

  const pager = (song: Song) => (
    <>
      <Button
        variant="link"
        className="reader-icon"
        aria-label="Música anterior"
        disabled={song.pos === 0}
        onClick={() => go(-1)}
      >
        <BsChevronLeft />
      </Button>
      <span className="reader-count">
        {song.pos + 1}/{songs.length}
      </span>
      <Button
        variant="link"
        className="reader-icon"
        aria-label="Próxima música"
        disabled={song.pos === songs.length - 1}
        onClick={() => go(1)}
      >
        <BsChevronRight />
      </Button>
      <Button
        variant="link"
        className="reader-icon"
        aria-label={fit === "w" ? "Ajustar à altura" : "Ajustar à largura"}
        onClick={() => {
          setFit(fit === "w" ? "h" : "w");
          setZoom(1);
        }}
      >
        <BsAspectRatio />
      </Button>
    </>
  );

  return (
    <div
      ref={rootRef}
      className={[
        "reader",
        wide ? "wide" : "narrow",
        immersive ? "immersive" : "",
      ].join(" ")}
      style={immersive ? undefined : { height: `calc(100dvh - ${top}px)` }}
    >
      {showIndex && (
        <aside className="reader-index" ref={indexListRef}>
          {index()}
        </aside>
      )}
      {!wide && cur && (
        <div className="reader-main">
          <div
            ref={stageRef}
            className="reader-stage"
            style={
              rotated
                ? {
                    inset: "auto",
                    left: size.w,
                    top: 0,
                    width: size.h,
                    height: size.w,
                    transform: "rotate(90deg)",
                    transformOrigin: "0 0",
                  }
                : undefined
            }
          >
            <div
              ref={attachPaper}
              className="reader-paper"
              onClick={handlePaperClick}
            >
              {sheet(cur)}
            </div>
            <div className={`reader-bar${barShown ? "" : " hidden"}`}>
              <Button
                variant="link"
                className="reader-icon"
                aria-label="Voltar ao índice"
                onClick={closeSong}
              >
                <BsChevronLeft />
              </Button>
              <Button
                variant="link"
                className="reader-icon"
                aria-label="Buscar música"
                onClick={openDrawer}
              >
                <BsSearch />
              </Button>
              {songTitle(cur)}
              {pager(cur)}
            </div>
            <Offcanvas
              show={drawer}
              onHide={closeDrawer}
              placement="start"
              container={stageRef}
              className="reader-drawer"
              aria-label="Índice"
              onEntered={() => {
                scrollToCurrent(drawerListRef.current);
                drawerInputRef.current?.focus({ preventScroll: true });
              }}
            >
              <div className="reader-drawer-body" ref={drawerListRef}>
                {index(drawerInputRef, closeDrawer)}
              </div>
            </Offcanvas>
          </div>
        </div>
      )}
      {wide && (
        <Modal
          show={cur !== null}
          onHide={closeSong}
          centered
          dialogClassName="reader-modal"
          aria-labelledby="reader-modal-title"
        >
          {modalSong && (
            <>
              <div className="reader-bar static">
                {songTitle(modalSong, "reader-modal-title")}
                {pager(modalSong)}
                <Button
                  variant="link"
                  className="reader-icon"
                  aria-label="Fechar partitura"
                  onClick={closeSong}
                >
                  <BsX />
                </Button>
              </div>
              <div className="reader-stage">
                <div ref={attachPaper} className="reader-paper">
                  {sheet(modalSong)}
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function scrollToCurrent(container: HTMLElement | null) {
  container
    ?.querySelector('[aria-current="true"]')
    ?.scrollIntoView({ block: "center" });
}

function SongIndex({
  title,
  badges,
  groups,
  songs,
  highlighted,
  query,
  onQuery,
  instrument,
  instruments,
  onInstrument,
  collapsed,
  onToggleSection,
  onOpen,
  onClose,
  actions,
  pdf,
  pdfError,
  inputRef,
}: {
  title: string;
  badges?: ReactNode;
  groups: Group[];
  songs: Song[];
  highlighted: number | null;
  query: string;
  onQuery: (q: string) => void;
  instrument: Instrument | null;
  instruments: Instrument[];
  onInstrument: (i: Instrument) => void;
  collapsed: Set<number>;
  onToggleSection: (i: number) => void;
  onOpen: (song: Song) => void;
  onClose?: () => void;
  actions?: ReactNode;
  // Download button, shown after the instrument menu.
  pdf?: ReactNode;
  pdfError?: string;
  inputRef?: RefObject<HTMLInputElement>;
}) {
  const q = query.trim();
  const nq = normalize(q);
  const anyDeleted = groups.some((g) =>
    g.entries.some((e) => e.kind === "deleted"),
  );

  const row = (song: Song, showSection: boolean) => (
    <button
      key={song.number}
      type="button"
      className="reader-row"
      aria-current={song.number === highlighted}
      onClick={() => onOpen(song)}
    >
      <span className="reader-row-n">{song.number}</span>
      <span className="reader-row-t">{song.title}</span>
      {showSection && groups[song.section].title && (
        <span className="reader-row-s">{groups[song.section].title}</span>
      )}
    </button>
  );

  let list: ReactNode;
  if (q) {
    const results = songs.filter(
      (s) =>
        normalize(s.title).includes(nq) ||
        normalize(s.composer).includes(nq) ||
        String(s.number).startsWith(q),
    );
    list = results.length ? (
      <div className="reader-rows">{results.map((s) => row(s, true))}</div>
    ) : (
      <p className="reader-none">
        Nenhuma música encontrada para “{q}”. Tente um número ou parte do nome.
      </p>
    );
  } else {
    list = groups.map((group, i) => {
      const open = !collapsed.has(i);
      const rows = (
        <div className="reader-rows">
          {group.entries.map((entry) =>
            entry.kind === "song" ? (
              row(entry.song, false)
            ) : (
              <div key={`d-${entry.number}`} className="reader-row deleted">
                <span className="reader-row-n">{entry.number}</span>
                <s className="reader-row-t">{entry.title}</s>
              </div>
            ),
          )}
        </div>
      );
      if (group.title === null) {
        return <section key={i}>{rows}</section>;
      }
      return (
        <section key={i}>
          <button
            type="button"
            className="reader-section"
            aria-expanded={open}
            onClick={() => onToggleSection(i)}
          >
            <BsChevronDown aria-hidden />
            <span>{group.title}</span>
            <em>{group.entries.length}</em>
          </button>
          {open && rows}
        </section>
      );
    });
  }

  return (
    <>
      <div className="reader-index-head">
        <div className="d-flex align-items-center gap-2 mb-2">
          <h1 className="reader-index-title">{title}</h1>
          {badges}
          {instruments.length > 0 && instrument && (
            <Form.Select
              size="sm"
              className="w-auto"
              aria-label="Instrumento"
              value={instrument}
              onChange={(e) => onInstrument(e.target.value as Instrument)}
            >
              {instruments.map((i) => (
                <option key={i} value={i}>
                  {instrumentLabel(i)}
                </option>
              ))}
            </Form.Select>
          )}
          {pdf}
          {onClose && (
            <Button
              variant="link"
              className="reader-icon"
              aria-label="Fechar"
              onClick={onClose}
            >
              <BsX />
            </Button>
          )}
        </div>
        <InputGroup>
          <InputGroup.Text>
            <BsSearch aria-hidden />
          </InputGroup.Text>
          <Form.Control
            ref={inputRef}
            type="search"
            placeholder="Buscar por nome ou número"
            aria-label="Buscar música"
            autoComplete="off"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </InputGroup>
        {pdfError && (
          <div className="text-danger small mt-2" role="alert">
            {pdfError}
          </div>
        )}
        {actions && <div className="mt-2 small">{actions}</div>}
      </div>
      {list}
      {anyDeleted && !q && (
        <p className="reader-none small">{REMOVED_SCORES_NOTE}</p>
      )}
    </>
  );
}
