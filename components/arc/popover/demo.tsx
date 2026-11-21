"use client";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "../button/button";

export default function ShareMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="secondary">Share</Button></PopoverTrigger>
      <PopoverContent>
        <p>Anyone with the link can view.</p>
      </PopoverContent>
    </Popover>
  );
}
