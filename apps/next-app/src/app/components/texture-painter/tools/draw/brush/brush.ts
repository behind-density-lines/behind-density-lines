import * as THREE from "three";
import { DrawTool } from "../draw";

const kBrushAlpha = 0.5;

export abstract class Brush extends DrawTool {
  constructor(size: number, color: THREE.Color) {
    super(size, color, kBrushAlpha);
  }

  protected paintCursorOverlay(drawingPoints: Uint8Array): void {
    this.paint(
      drawingPoints,
      new THREE.Vector2(this.size / 2, this.size / 2),
      this.size,
      new THREE.Vector2(this.size, this.size),
      this.color,
      kBrushAlpha
    );
  }
}