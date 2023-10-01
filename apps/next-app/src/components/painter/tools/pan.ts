import * as THREE from "three";
import { Tool } from "./tool";
import { Controls } from "../controls";
import { DrawingLayer } from "../drawing-layer";
import { Dispatch, SetStateAction } from "react";

export const kPanMultiplier = 3.5;

export class PanTool extends Tool {
  readonly name = "Pan";

  private anchor: THREE.Vector2 | null = null;

  constructor(size: number) {
    super(size);
  }

  public frameCallback(
    cursorDown: boolean,
    zooming: boolean,
    mousePos: THREE.Vector2,
    controls: Controls,
    setControls: Dispatch<SetStateAction<Controls>>,
    drawingLayer: DrawingLayer
  ): void {
    if (cursorDown && this.anchor) {
      applyPan(controls, setControls, mousePos, this.anchor, drawingLayer);
    }
    this.anchor = mousePos.clone();
  }
}

export function applyPan(
  controls: Controls,
  setControls: Dispatch<SetStateAction<Controls>>,
  mousePos: THREE.Vector2,
  anchor: THREE.Vector2,
  drawingLayer: DrawingLayer
): void {
  const maxPan = new THREE.Vector2(1, 1)
    .subScalar(1.0 / Math.sqrt(controls.zoom))
    .divideScalar(kPanMultiplier);
  setControls({
    ...controls,
    pan: controls.pan
      .clone()
      .add(anchor.clone().sub(mousePos).divide(drawingLayer.pixelSize))
      .clamp(maxPan.clone().negate(), maxPan),
  });
}
