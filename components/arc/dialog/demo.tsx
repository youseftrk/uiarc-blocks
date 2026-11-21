"use client";

import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";
import { Button } from "../button/button";

export default function RenameProject() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button>Rename</Button></DialogTrigger>
      <DialogContent title="Rename project" description="This changes the URL too.">
        <input defaultValue="Arc" aria-label="Project name" />
        <DialogClose asChild><Button>Save</Button></DialogClose>
      </DialogContent>
    </Dialog>
  );
}
