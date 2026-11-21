"use client";

import { Carousel } from "./carousel";

export default function Suites() {
  return (
    <Carousel label="Harbour suites" interval={5000}>
      <img src="/suite-1.jpg" alt="Sea view suite" />
      <img src="/suite-2.jpg" alt="Garden suite" />
      <img src="/suite-3.jpg" alt="Loft suite" />
    </Carousel>
  );
}
