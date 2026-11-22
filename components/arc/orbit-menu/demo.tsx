"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, FolderPlus, Heart, RotateCcw, Share2, Trash2 } from "lucide-react";
import { Button } from "../button/button";
import { OrbitMenu, type OrbitMenuAction } from "./orbit-menu";
import styles from "./demo.module.css";

const HINT = "Press the button and drag to an action, or click it to keep the actions open.";
const ENTER = { type: "spring", duration: 0.4, bounce: 0.18 } as const;

interface Photo {
  liked: boolean;
  album: boolean;
  shared: boolean;
  deleted: boolean;
}

const PRISTINE: Photo = { liked: false, album: false, shared: false, deleted: false };

function Hut() {
  return (
    <svg className={styles.art} viewBox="0 0 358 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A dark wooden hut in fog on a rocky mountainside">
      <defs>
        <linearGradient id="om-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9ced0" />
          <stop offset="0.6" stopColor="#b3b9bb" />
          <stop offset="1" stopColor="#8f9694" />
        </linearGradient>
        <linearGradient id="om-fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c6cbcd" stopOpacity="0.95" />
          <stop offset="1" stopColor="#c6cbcd" stopOpacity="0" />
        </linearGradient>
        <filter id="om-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <rect width="358" height="200" fill="url(#om-sky)" />
      <path d="M0 96 L70 70 L150 88 L230 60 L358 84 V200 H0Z" fill="#a3aaab" filter="url(#om-blur)" />
      <path d="M0 132 L60 118 L130 126 L200 112 L280 124 L358 110 V200 H0Z" fill="#6f7673" />
      <path d="M0 158 L48 146 L96 156 L150 144 L214 154 L270 146 L358 156 V200 H0Z" fill="#555c58" />
      <path d="M0 178 L40 170 L92 180 L160 170 L220 182 L300 172 L358 180 V200 H0Z" fill="#3f4542" />
      <g>
        <path d="M150 124 L190 96 L230 124 Z" fill="#23211f" />
        <rect x="156" y="124" width="68" height="34" fill="#2d2925" />
        <path d="M156 132 H224 M156 140 H224 M156 148 H224" stroke="#1f1c19" strokeWidth="1.2" />
        <rect x="168" y="134" width="12" height="12" fill="#d9b36a" opacity="0.85" />
        <rect x="198" y="136" width="12" height="22" fill="#191715" />
        <rect x="205" y="90" width="6" height="14" fill="#23211f" />
      </g>
      <rect width="358" height="120" fill="url(#om-fog)" />
      <ellipse cx="90" cy="120" rx="120" ry="16" fill="#cfd4d5" opacity="0.55" filter="url(#om-blur)" />
      <ellipse cx="290" cy="138" rx="110" ry="12" fill="#cfd4d5" opacity="0.4" filter="url(#om-blur)" />
    </svg>
  );
}

export default function Demo() {
  const [photo, setPhoto] = useState<Photo>(PRISTINE);
  const [status, setStatus] = useState(HINT);
  const [open, setOpen] = useState(false);
  const pristine = !photo.liked && !photo.album && !photo.shared && !photo.deleted;

  const actions: OrbitMenuAction[] = [
    { id: "like", label: photo.liked ? "Unlike" : "Like", icon: <Heart />, done: photo.liked ? "Unliked" : "Liked" },
    { id: "album", label: photo.album ? "Remove from album" : "Add to album", icon: <FolderPlus />, done: photo.album ? "Removed" : "Added to Fall trips" },
    { id: "share", label: photo.shared ? "Stop sharing" : "Share with Ryan", icon: <Share2 />, done: photo.shared ? "Not shared" : "Shared" },
    { id: "download", label: "Download", icon: <Download />, done: "Downloaded" },
    { id: "delete", label: "Delete", icon: <Trash2 />, done: "Deleted", tone: "danger" },
  ];

  const onAction = (id: string) => {
    if (id === "like") {
      setStatus(photo.liked ? "Removed your like" : "Liked the photo, 129 likes now");
      setPhoto({ ...photo, liked: !photo.liked });
    } else if (id === "album") {
      setStatus(photo.album ? "Removed from the Fall trips album" : "Added to the Fall trips album");
      setPhoto({ ...photo, album: !photo.album });
    } else if (id === "share") {
      setStatus(photo.shared ? "Stopped sharing with Ryan Torres" : "Shared with Ryan Torres");
      setPhoto({ ...photo, shared: !photo.shared });
    } else if (id === "download") {
      setStatus("Saved hut-below-snezka.jpg, 4.2 MB");
    } else if (id === "delete") {
      setStatus("Deleted the photo");
      setPhoto({ ...photo, deleted: true });
    }
  };

  const chips = photo.liked || photo.album || photo.shared;

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <motion.div className={styles.cardArea} initial={false} animate={{ opacity: open ? 0.55 : 1, scale: open ? 0.985 : 1 }} transition={ENTER}>
          <AnimatePresence mode="popLayout" initial={false}>
            {photo.deleted ? (
              <motion.div
                key="empty"
                className={styles.empty}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={ENTER}
              >
                <p className={styles.emptyTitle}>Photo deleted</p>
                <p className={styles.emptyBody}>Hut below Śnieżka stays in Recently deleted for 30 days.</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPhoto({ ...photo, deleted: false });
                    setStatus("Restored the photo");
                  }}
                >
                  <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
                  Restore photo
                </Button>
              </motion.div>
            ) : (
              <motion.article
                key="card"
                className={styles.card}
                aria-label="Hut below Śnieżka"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={ENTER}
              >
                <div className={styles.photo}>
                  <Hut />
                </div>
                <div className={styles.body}>
                  <div className={styles.byline}>
                    <span className={`${styles.avatar} ${styles.olivia}`} aria-hidden="true" />
                    <div className={styles.names}>
                      <h3 className={styles.title}>Hut below Śnieżka</h3>
                      <p className={styles.meta}>Olivia Bennett, Karkonosze, Poland</p>
                    </div>
                  </div>
                  <div className={styles.chips}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {!chips ? (
                        <motion.span key="none" className={styles.placeholder} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          128 likes, not in an album
                        </motion.span>
                      ) : null}
                      {photo.liked ? (
                        <Chip key="likes">
                          <Heart size={13} strokeWidth={2} aria-hidden="true" />
                          <span className={styles.chipText}>129 likes</span>
                        </Chip>
                      ) : null}
                      {photo.album ? (
                        <Chip key="album">
                          <FolderPlus size={13} strokeWidth={2} aria-hidden="true" />
                          <span className={styles.chipText}>Fall trips</span>
                        </Chip>
                      ) : null}
                      {photo.shared ? (
                        <Chip key="share">
                          <span className={`${styles.chipAvatar} ${styles.ryan}`} aria-hidden="true" />
                          <span className={styles.chipText}>Ryan Torres</span>
                        </Chip>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.article>
            )}
          </AnimatePresence>
        </motion.div>
        <div className={styles.orbit}>
          <OrbitMenu label="Photo actions" actions={actions} onAction={onAction} announce={false} onOpenChange={setOpen} disabled={photo.deleted} />
        </div>
      </div>
      <div className={styles.footer}>
        <p className={styles.srOnly} role="status" aria-live="polite">
          <span className={styles.statusText}>{status}</span>
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={pristine}
          onClick={() => {
            setPhoto(PRISTINE);
            setStatus("Photo reset");
          }}
        >
          <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
          Reset photo
        </Button>
      </div>
    </div>
  );
}

function Chip({ children, ref }: { children: React.ReactNode; ref?: React.Ref<HTMLSpanElement> }) {
  return (
    <motion.span
      ref={ref}
      layout
      className={styles.chip}
      initial={{ opacity: 0, filter: "blur(4px)", scale: 0.8 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, filter: "blur(4px)", scale: 0.8 }}
      transition={ENTER}
    >
      {children}
    </motion.span>
  );
}
