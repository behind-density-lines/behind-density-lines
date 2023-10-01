import * as THREE from "three";
import { Controls } from "../controls";
import { DrawingLayer } from "../drawing-layer";
import { Dispatch, SetStateAction } from "react";

export type ToolNames =
  | "Circle Eraser"
  | "Square Eraser"
  | "Circle Brush"
  | "Square Brush"
  | "Pan";

export abstract class Tool {
  public abstract readonly name: ToolNames;
  public readonly color: THREE.Color;
  public readonly size: number;

  protected lastMousePos: THREE.Vector2 | null = null;

  public handleFrame(
    cursorDown: boolean,
    zooming: boolean,
    mousePos: THREE.Vector2,
    setControls: Dispatch<SetStateAction<Controls>>,
    drawingLayer: DrawingLayer
  ): void {
    this.frameCallback(
      cursorDown,
      zooming,
      mousePos,
      setControls,
      drawingLayer
    );
    this.lastMousePos = mousePos.clone();
  }

  public abstract frameCallback(
    cursorDown: boolean,
    zooming: boolean,
    mousePos: THREE.Vector2,
    setControls: Dispatch<SetStateAction<Controls>>,
    drawingLayer: DrawingLayer
  ): void;

  constructor(color: THREE.Color, size: number) {
    this.color = color;
    this.size = size;
  }
}
