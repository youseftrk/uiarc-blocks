"use client";

import { useState } from "react";
import { Pagination } from "./pagination";

export default function Results() {
  const [page, setPage] = useState(1);
  return <Pagination page={page} pageCount={12} onPageChange={setPage} />;
}
