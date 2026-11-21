"use client";

import { useState } from "react";

import { Rating } from "./rating";

export default function ReviewForm() {
  const [stars, setStars] = useState(0);
  return (
    <form>
      <Rating label="Overall experience" value={stars} onChange={setStars} name="rating" />
    </form>
  );
}
