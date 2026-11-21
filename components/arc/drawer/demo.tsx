"use client";

import { Drawer, DrawerTrigger, DrawerContent, DrawerClose } from "./drawer";
import { Button } from "../button/button";

export default function FiltersDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary">Filters</Button>
      </DrawerTrigger>
      <DrawerContent title="Filters" description="Narrow the list of projects.">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
            <input type="checkbox" defaultChecked /> Active projects
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
            <input type="checkbox" /> Archived
          </label>
        </div>
        <DrawerClose asChild>
          <Button>Apply</Button>
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  );
}
