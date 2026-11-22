"use client";

import { useState } from "react";
import { Check, RotateCcw, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ProductGallery,
  type ProductColor,
  type ProductSize,
} from "./product-gallery";
import styles from "./product-gallery.module.css";

const PHOTOS = {
  bedroom: {
    src: "https://uiarc.dev/media/photos/bedroom.jpg",
    alt: "A made bed with striped linen pillows against an oak headboard",
  },
  linenThrow: {
    src: "https://uiarc.dev/media/photos/linen-throw.jpg",
    alt: "Close-up texture of folded stonewashed European flax linen",
  },
  livingRoom: {
    src: "/media/photos/living-room.jpg",
    alt: "Sunlit room draped with natural washed linen textiles",
  },
  loungeChair: {
    src: "https://uiarc.dev/media/photos/lounge-chair.jpg",
    alt: "Woven linen throw folded across a minimalist oak chair",
  },
};

const DEMO_COLORS: ProductColor[] = [
  {
    id: "oat",
    name: "Oat",
    swatch: "oklch(86% 0.03 80)",
    photos: [
      PHOTOS.bedroom,
      PHOTOS.linenThrow,
      PHOTOS.livingRoom,
      PHOTOS.loungeChair,
    ],
    soldOut: ["cal-king"],
  },
  {
    id: "forest",
    name: "Forest",
    swatch: "oklch(42% 0.05 155)",
    photos: [
      PHOTOS.livingRoom,
      PHOTOS.bedroom,
      PHOTOS.loungeChair,
      PHOTOS.linenThrow,
    ],
    soldOut: ["twin"],
  },
  {
    id: "walnut",
    name: "Walnut",
    swatch: "oklch(43% 0.06 50)",
    photos: [
      PHOTOS.loungeChair,
      PHOTOS.linenThrow,
      PHOTOS.bedroom,
      PHOTOS.livingRoom,
    ],
    soldOut: ["full", "cal-king"],
  },
];

const DEMO_SIZES: ProductSize[] = [
  { id: "twin", label: "Twin" },
  { id: "full", label: "Full" },
  { id: "queen", label: "Queen" },
  { id: "king", label: "King" },
  { id: "cal-king", label: "Cal king" },
];

const PRICES: Record<string, number> = {
  twin: 188,
  full: 218,
  queen: 248,
  king: 278,
  "cal-king": 298,
};

export default function ProductGalleryDemo() {
  const prefersReduced = Boolean(useReducedMotion());
  const [color, setColor] = useState("oat");
  const [size, setSize] = useState<string | null>(null);
  const [bagCount, setBagCount] = useState(0);
  const [addStatus, setAddStatus] = useState<"idle" | "added" | "missing">("idle");

  const activeColor = DEMO_COLORS.find((c) => c.id === color) ?? DEMO_COLORS[0];
  const price = size ? PRICES[size] : 248;
  const soldOutLabels = (activeColor.soldOut ?? [])
    .map((id) => DEMO_SIZES.find((s) => s.id === id)?.label)
    .filter(Boolean)
    .join(", ");

  const handleAdd = () => {
    if (!size) {
      setAddStatus("missing");
      window.setTimeout(() => setAddStatus("idle"), 1600);
      return;
    }
    setBagCount((c) => c + 1);
    setAddStatus("added");
    window.setTimeout(() => setAddStatus("idle"), 1500);
  };

  return (
    <div className={styles.demo}>
      <ProductGallery
        colors={DEMO_COLORS}
        sizes={DEMO_SIZES}
        color={color}
        onColorChange={setColor}
        size={size}
        onSizeChange={setSize}
        label="Washed linen duvet set"
        header={
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <h3 className={styles.title}>Washed linen duvet set</h3>
              <span
                className={styles.bag}
                aria-live="polite"
                aria-label={`${bagCount} items in bag`}
              >
                <ShoppingBag size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.bagCount}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={bagCount}
                      initial={
                        prefersReduced ? { opacity: 1 } : { opacity: 0, y: 6 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        prefersReduced ? { opacity: 1 } : { opacity: 0, y: -6 }
                      }
                      transition={{ duration: prefersReduced ? 0 : 0.16 }}
                    >
                      {bagCount}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
            </div>

            <p className={styles.price}>
              <span className={styles.priceValue}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={price}
                    initial={
                      prefersReduced
                        ? { opacity: 1 }
                        : { opacity: 0, filter: "blur(3px)" }
                    }
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={
                      prefersReduced
                        ? { opacity: 1 }
                        : { opacity: 0, filter: "blur(3px)" }
                    }
                    transition={{ duration: prefersReduced ? 0 : 0.16 }}
                  >
                    ${price}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className={styles.priceNote}>
                {size
                  ? `${DEMO_SIZES.find((s) => s.id === size)?.label} · ${activeColor.name.toLowerCase()}`
                  : "From $188 · queen shown"}
              </span>
            </p>

            <p className={styles.copy}>
              Stonewashed European flax that softens with every wash. Hover the
              photo to look closer, or open it fullscreen.
            </p>
          </div>
        }
        footer={
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.add}
              data-status={addStatus}
              onClick={handleAdd}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={addStatus}
                  className={styles.addLabel}
                  initial={
                    prefersReduced
                      ? { opacity: 1 }
                      : { opacity: 0, filter: "blur(3px)" }
                  }
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={
                    prefersReduced
                      ? { opacity: 1 }
                      : { opacity: 0, filter: "blur(3px)" }
                  }
                  transition={{ duration: prefersReduced ? 0 : 0.16 }}
                >
                  {addStatus === "added" ? (
                    <>
                      <Check size={16} strokeWidth={2} aria-hidden="true" />
                      Added to bag
                    </>
                  ) : addStatus === "missing" ? (
                    "Select a size first"
                  ) : (
                    "Add to bag"
                  )}
                </motion.span>
              </AnimatePresence>
            </button>

            <div className={styles.meta}>
              <span>
                {soldOutLabels
                  ? `Sold out in ${activeColor.name.toLowerCase()}: ${soldOutLabels}`
                  : `All sizes in stock in ${activeColor.name.toLowerCase()}`}
              </span>
              {bagCount > 0 && (
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() => setBagCount(0)}
                >
                  <RotateCcw size={12} strokeWidth={1.75} aria-hidden="true" />
                  Clear bag
                </button>
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}
