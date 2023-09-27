"use client";

import { useContext } from "react";
import { TexturePainterActionDispatchContext } from "../context";
import { SetToolSizeAction, kDefaultToolSize } from "../state";

export function BrushSizeSlider(): JSX.Element {
  const painterDispatch = useContext(TexturePainterActionDispatchContext);
  if (!painterDispatch) {
    throw new Error("No painter dispatch found");
  }

  return (
    <input
      type="range"
      className="opacity-80 hover:opacity-100 bg-cyan-800 transition outline-none"
      min={30}
      max={300}
      defaultValue={kDefaultToolSize}
      onChange={(e) => {
        painterDispatch(
          new SetToolSizeAction(Number.parseInt(e.currentTarget.value))
        );
      }}
    />
  );
}