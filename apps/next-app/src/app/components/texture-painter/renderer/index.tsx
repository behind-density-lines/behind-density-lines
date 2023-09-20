import * as THREE from "three";
import { useCallback, useContext, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { fragmentShader, vertexShader } from "./shaders";
import { EffectComposer, ShaderPass } from "three-stdlib";
import { ControlsState } from "../canvas";
import { TexturePainterStateContext } from "../context";
import { usePinch } from "@use-gesture/react";

/**
 * The parameters passed to the three.js render loop callback.
 */
export type FrameCallbackParams = {
  /**
   * The time in seconds since the last frame.
   */
  delta: number;

  /**
   * The resolution of the background image.
   */
  resolution: THREE.Vector2;

  /**
   * The cursor position in screen coordinates at the end of
   * the previous frame and at the start of the current frame.
   */
  cursor: {
    previous: THREE.Vector2;
    current: THREE.Vector2;
  };

  /**
   * The drawing layer. This is a flattened array of RGBA values.
   * Writing to this array will update the drawing.
   *
   * length = resolution.width * resolution.height * 4
   */
  drawingPoints: Uint8Array;

  /**
   * The current state of the controls.
   */
  controls: ControlsState;
};

/**
 * A function that is called every frame to update the renderer state.
 */
export type FrameCallback = (params: FrameCallbackParams) => void;

const kMaxZoom = 5.0;
const kMinZoom = 1.0;

export function TexturePainterRenderer(props: {
  controls: ControlsState;
  background: THREE.Texture;
}): null {
  const { gl, mouse } = useThree();

  const painterState = useContext(TexturePainterStateContext);

  if (!painterState) {
    throw new Error("No painter state found");
  }

  const [resolution, composer, uniforms] = useMemo(() => {
    gl.setClearAlpha(0.0);
    const resolution = new THREE.Vector2(
      Math.round(props.background.image.width),
      Math.round(props.background.image.height)
    );
    const cursorPosUniform = new THREE.Uniform(
      new THREE.Vector2(mouse.x, mouse.y)
    );
    const drawingUniform = new THREE.Uniform(
      new THREE.DataTexture(
        painterState.drawingPoints,
        resolution.width,
        resolution.height
      )
    );
    const cursorOverlayUniform = new THREE.Uniform(
      painterState.tool.cursorOverlay()
    );
    const hideCursorUniform = new THREE.Uniform(painterState.hideCursor);
    const zoomUniform = new THREE.Uniform(1.0);
    const panUniform = new THREE.Uniform(new THREE.Vector2(0.0, 0.0));

    const composer = new EffectComposer(gl);
    composer.addPass(
      new ShaderPass(
        new THREE.ShaderMaterial({
          transparent: true,
          vertexShader,
          fragmentShader,
          uniforms: {
            cursorOverlay: cursorOverlayUniform,
            drawing: drawingUniform,
            cursorPos: cursorPosUniform,
            hideCursorOverlay: hideCursorUniform,
            zoom: zoomUniform,
            pan: panUniform,
            background: { value: props.background },
          },
        })
      )
    );
    return [
      resolution,
      composer,
      {
        cursorPosUniform,
        drawingUniform,
        cursorOverlayUniform,
        hideCursorUniform,
        panUniform,
        zoomUniform,
      },
    ] as const;
  }, []);

  useEffect(() => {
    uniforms.hideCursorUniform.value = painterState.hideCursor;
  }, [painterState.hideCursor]);

  useEffect(() => {
    uniforms.cursorOverlayUniform.value = painterState.tool.cursorOverlay();
  }, [painterState.tool]);

  const panBounds = useCallback((zoom: number) => {
    return new THREE.Vector2(1.0, 1.0).multiplyScalar(
      1 - 1.0 / Math.sqrt(zoom)
    );
  }, []);

  usePinch(
    (pinch) => {
      uniforms.zoomUniform.value = pinch.offset[0];
      const max = panBounds(uniforms.zoomUniform.value);
      uniforms.panUniform.value = mouse
        .clone()
        .divideScalar(uniforms.zoomUniform.value)
        .multiplyScalar(Math.max(pinch.delta[0] * 0.5, 0))
        .add(uniforms.panUniform.value)
        .clamp(max.clone().negate(), max);
    },
    {
      pinchOnWheel: true,
      pointer: {
        touch: true,
      },
      scaleBounds: {
        min: kMinZoom,
        max: kMaxZoom,
      },
      target: gl.domElement,
    }
  );

  return useFrame((_, delta) => {
    const currentMouse = mouse
      .clone()
      .divideScalar(Math.sqrt(uniforms.zoomUniform.value))
      .add(uniforms.panUniform.value);

    painterState.tool.frameHandler({
      delta,
      resolution,
      controls: props.controls,
      drawingPoints: painterState.drawingPoints,
      cursor: {
        previous: uniforms.cursorPosUniform.value,
        current: currentMouse,
      },
    });

    uniforms.cursorPosUniform.value = currentMouse;
    uniforms.drawingUniform.value = new THREE.DataTexture(
      painterState.drawingPoints,
      resolution.width,
      resolution.height
    );
    uniforms.drawingUniform.value.needsUpdate = true;

    gl.clear();
    gl.autoClear = false;

    composer.render();
  });
}