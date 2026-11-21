"use client";

import { ImageCompare } from "./image-compare";

export default function Retouch() {
  return (
    <ImageCompare
      before={<img src="/photo-raw.jpg" alt="Unedited photo" />}
      after={<img src="/photo-edit.jpg" alt="Retouched photo" />}
      aspectRatio="4 / 3"
    />
  );
}
